import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  date,
  decimal,
  varchar,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from "./models/auth";
export * from "./models/auth";

// === CONFIGURATION CONSTANTS ===

export const SALE_STATUSES = {
  DRAFT: "draft",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type SaleStatus = (typeof SALE_STATUSES)[keyof typeof SALE_STATUSES];

export const CLIENT_REQUIRED_CATEGORIES = [
  "lenses",
  "contact_lenses",
  "prescription_glasses",
  "medical_devices",
] as const;

export const ADJUSTMENT_TYPES = {
  WRITEOFF: "writeoff",
  DEFECTIVE: "defective",
  TRANSFER: "transfer",
  ADJUSTMENT: "adjustment",
} as const;

export type AdjustmentType =
  (typeof ADJUSTMENT_TYPES)[keyof typeof ADJUSTMENT_TYPES];

// === TABLES ===

export const branches = pgTable(
  "branches",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    discountLimitPercent: integer("discount_limit_percent")
      .notNull()
      .default(10),
    isWarehouse: boolean("is_warehouse").notNull().default(false),
  },
  (t) => ({
    nameIdx: index("branches_name_idx").on(t.name),
    discountLimitCheck: check(
      "branches_discount_limit_check",
      sql`${t.discountLimitPercent} >= 0 AND ${t.discountLimitPercent} <= 100`,
    ),
  }),
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (t) => ({
    nameUnique: uniqueIndex("categories_name_unique").on(t.name),
    slugUnique: uniqueIndex("categories_slug_unique").on(t.slug),
  }),
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    sku: text("sku"),
    categoryId: integer("category_id")
      .references(() => categories.id)
      .notNull(),
    brand: text("brand"),
    model: text("model"),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    costPrice: decimal("cost_price", { precision: 12, scale: 2 }).notNull(),
    imageUrl: text("image_url"),

    supplier: text("supplier"),
    unit: text("unit").notNull(), // "dona", "juft", "quti", ...
    minStock: integer("min_stock").notNull().default(0),

    receivedDate: timestamp("received_date", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),

    // 'in_stock', 'sold', 'defective', 'transferred'
    status: text("status").notNull().default("in_stock"),
  },
  (t) => ({
    skuUnique: uniqueIndex("products_sku_unique").on(t.sku),
    categoryIdx: index("products_category_idx").on(t.categoryId),
    minStockCheck: check("products_min_stock_check", sql`${t.minStock} >= 0`),
    priceCheck: check("products_price_check", sql`${t.price} >= 0`),
    costCheck: check("products_cost_check", sql`${t.costPrice} >= 0`),
  }),
);

export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .references(() => products.id)
      .notNull(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    quantity: integer("quantity").notNull().default(0),
  },
  (t) => ({
    qtyCheck: check("inventory_quantity_check", sql`${t.quantity} >= 0`),
    branchProductUnique: uniqueIndex("inventory_branch_product_unique").on(
      t.branchId,
      t.productId,
    ),
    productIdx: index("inventory_product_idx").on(t.productId),
    branchIdx: index("inventory_branch_idx").on(t.branchId),
  }),
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .references(() => products.id)
      .notNull(),

    // context
    branchId: integer("branch_id").references(() => branches.id),

    fromBranchId: integer("from_branch_id").references(() => branches.id),
    toBranchId: integer("to_branch_id").references(() => branches.id),

    quantity: integer("quantity").notNull(),

    // 'sale', 'transfer', 'adjustment', 'received'
    type: text("type").notNull(),
    reason: text("reason"),

    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
  },
  (t) => ({
    qtyNonZero: check("inventory_movements_qty_nonzero", sql`${t.quantity} <> 0`),
    productIdx: index("inventory_movements_product_idx").on(t.productId),
    branchIdx: index("inventory_movements_branch_idx").on(t.branchId),
    userIdx: index("inventory_movements_user_idx").on(t.userId),
  }),
);

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone").notNull(),
    birthDate: date("birth_date"),
    passport: text("passport"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
  },
  (t) => ({
    phoneIdx: index("clients_phone_idx").on(t.phone),
  }),
);

export const prescriptions = pgTable(
  "prescriptions",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .references(() => clients.id)
      .notNull(),
    doctorName: text("doctor_name"),
    date: timestamp("date", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),

    sphRight: text("sph_right"),
    cylRight: text("cyl_right"),
    axisRight: text("axis_right"),
    pdRight: text("pd_right"),

    sphLeft: text("sph_left"),
    cylLeft: text("cyl_left"),
    axisLeft: text("axis_left"),
    pdLeft: text("pd_left"),

    notes: text("notes"),
  },
  (t) => ({
    clientIdx: index("prescriptions_client_idx").on(t.clientId),
  }),
);

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    clientId: integer("client_id").references(() => clients.id),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),

    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),

    // for single-payment legacy support
    paymentMethod: text("payment_method").notNull(),

    status: text("status").notNull().default(SALE_STATUSES.DRAFT),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    statusCheck: check(
      "sales_status_check",
      sql`${t.status} in ('draft','completed','cancelled')`,
    ),
    totalAmountCheck: check("sales_total_amount_check", sql`${t.totalAmount} >= 0`),
    discountCheck: check("sales_discount_check", sql`${t.discount} >= 0`),
    branchIdx: index("sales_branch_idx").on(t.branchId),
    userIdx: index("sales_user_idx").on(t.userId),
    clientIdx: index("sales_client_idx").on(t.clientId),
    createdAtIdx: index("sales_created_at_idx").on(t.createdAt),
  }),
);

export const monthlyClosures = pgTable(
  "monthly_closures",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    closedBy: varchar("closed_by")
      .references(() => users.id)
      .notNull(),
  },
  (t) => ({
    onePerMonth: uniqueIndex("monthly_closures_branch_month_year_unique").on(
      t.branchId,
      t.month,
      t.year,
    ),
    monthRange: check("monthly_closures_month_range", sql`${t.month} between 1 and 12`),
  }),
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .references(() => sales.id)
      .notNull(),
    productId: integer("product_id")
      .references(() => products.id)
      .notNull(),
    quantity: integer("quantity").notNull(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    total: decimal("total", { precision: 12, scale: 2 }).notNull(),
    discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  },
  (t) => ({
    qtyCheck: check("sale_items_qty_check", sql`${t.quantity} > 0`),
    totalCheck: check("sale_items_total_check", sql`${t.total} >= 0`),
    saleIdx: index("sale_items_sale_idx").on(t.saleId),
    productIdx: index("sale_items_product_idx").on(t.productId),
  }),
);

export const employeeKpi = pgTable(
  "employee_kpi",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    totalSales: decimal("total_sales", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalBonus: decimal("total_bonus", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
  },
  (t) => ({
    onePerUserMonth: uniqueIndex("employee_kpi_user_branch_month_year_unique").on(
      t.userId,
      t.branchId,
      t.month,
      t.year,
    ),
    monthRange: check("employee_kpi_month_range", sql`${t.month} between 1 and 12`),
  }),
);

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category").notNull(),
    description: text("description"),
    date: timestamp("date", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    amountCheck: check("expenses_amount_check", sql`${t.amount} > 0`),
    branchIdx: index("expenses_branch_idx").on(t.branchId),
    userIdx: index("expenses_user_idx").on(t.userId),
    dateIdx: index("expenses_date_idx").on(t.date),
  }),
);

// --- Shipments / Warehouse -> Branch

export const shipmentStatus = [
  "pending",
  "partially_received",
  "received",
  "cancelled",
] as const;

export const shipments = pgTable(
  "shipments",
  {
    id: serial("id").primaryKey(),
    fromWarehouseId: integer("from_warehouse_id")
      .references(() => branches.id)
      .notNull(),
    toBranchId: integer("to_branch_id")
      .references(() => branches.id)
      .notNull(),
    status: text("status").notNull().default("pending"),
    createdBy: varchar("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
  },
  (t) => ({
    statusCheck: check(
      "shipments_status_check",
      sql`${t.status} in ('pending','partially_received','received','cancelled')`,
    ),
    fromIdx: index("shipments_from_idx").on(t.fromWarehouseId),
    toIdx: index("shipments_to_idx").on(t.toBranchId),
    createdAtIdx: index("shipments_created_at_idx").on(t.createdAt),
  }),
);

export const shipmentItems = pgTable(
  "shipment_items",
  {
    id: serial("id").primaryKey(),
    shipmentId: integer("shipment_id")
      .references(() => shipments.id)
      .notNull(),
    productId: integer("product_id")
      .references(() => products.id)
      .notNull(),
    qtySent: integer("qty_sent").notNull(),
    qtyReceived: integer("qty_received").notNull().default(0),
  },
  (t) => ({
    sentCheck: check("shipment_items_qty_sent_check", sql`${t.qtySent} > 0`),
    receivedCheck: check(
      "shipment_items_qty_received_check",
      sql`${t.qtyReceived} >= 0 AND ${t.qtyReceived} <= ${t.qtySent}`,
    ),
    shipmentIdx: index("shipment_items_shipment_idx").on(t.shipmentId),
    productIdx: index("shipment_items_product_idx").on(t.productId),
  }),
);

export const shipmentReceiveOps = pgTable(
  "shipment_receive_ops",
  {
    id: serial("id").primaryKey(),
    shipmentId: integer("shipment_id")
      .references(() => shipments.id)
      .notNull(),
    requestId: text("request_id").notNull(),
    actorUserId: varchar("actor_user_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
  },
  (t) => ({
    uniqueRequest: uniqueIndex("shipment_receive_ops_request_unique").on(t.requestId),
    shipmentIdx: index("shipment_receive_ops_shipment_idx").on(t.shipmentId),
    actorIdx: index("shipment_receive_ops_actor_idx").on(t.actorUserId),
  }),
);

// --- Audit logs

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUserId: varchar("actor_user_id")
      .references(() => users.id)
      .notNull(),
    branchId: integer("branch_id").references(() => branches.id),
    actionType: text("action_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    metadata: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
  },
  (t) => ({
    actorIdx: index("audit_logs_actor_idx").on(t.actorUserId),
    branchIdx: index("audit_logs_branch_idx").on(t.branchId),
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
  }),
);

// --- Price history

export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .references(() => products.id)
      .notNull(),
    oldPrice: decimal("old_price", { precision: 12, scale: 2 }).notNull(),
    newPrice: decimal("new_price", { precision: 12, scale: 2 }).notNull(),
    oldCost: decimal("old_cost", { precision: 12, scale: 2 }).notNull(),
    newCost: decimal("new_cost", { precision: 12, scale: 2 }).notNull(),
    changedByUserId: varchar("changed_by_user_id")
      .references(() => users.id)
      .notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
    reason: text("reason"),
  },
  (t) => ({
    productIdx: index("price_history_product_idx").on(t.productId),
    userIdx: index("price_history_user_idx").on(t.changedByUserId),
    changedAtIdx: index("price_history_changed_at_idx").on(t.changedAt),
    priceCheck: check("price_history_new_price_check", sql`${t.newPrice} >= 0`),
    costCheck: check("price_history_new_cost_check", sql`${t.newCost} >= 0`),
  }),
);

// --- Sale payments (mixed payments)

export const salesPayments = pgTable(
  "sales_payments",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .references(() => sales.id)
      .notNull(),
    method: text("method").notNull(), // cash/card/click/payme/transfer
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
  },
  (t) => ({
    amountCheck: check("sales_payments_amount_check", sql`${t.amount} > 0`),
    saleIdx: index("sales_payments_sale_idx").on(t.saleId),
  }),
);

// --- Stock adjustments

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    productId: integer("product_id")
      .references(() => products.id)
      .notNull(),
    quantity: integer("quantity").notNull(), // non-zero, can be +/- (adjustment)
    type: text("type").notNull(), // writeoff/defective/transfer/adjustment
    status: text("status").notNull().default("pending"), // pending/approved/rejected
    reason: text("reason").notNull(),
    createdBy: varchar("created_by")
      .references(() => users.id)
      .notNull(),
    approvedBy: varchar("approved_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => ({
    qtyNonZero: check("stock_adjustments_qty_nonzero", sql`${t.quantity} <> 0`),
    statusCheck: check(
      "stock_adjustments_status_check",
      sql`${t.status} in ('pending','approved','rejected')`,
    ),
    typeCheck: check(
      "stock_adjustments_type_check",
      sql`${t.type} in ('writeoff','defective','transfer','adjustment')`,
    ),
    branchIdx: index("stock_adjustments_branch_idx").on(t.branchId),
    productIdx: index("stock_adjustments_product_idx").on(t.productId),
    createdAtIdx: index("stock_adjustments_created_at_idx").on(t.createdAt),
  }),
);

// === RELATIONS ===

export const branchesRelations = relations(branches, ({ many }) => ({
  inventory: many(inventory),
  sales: many(sales),
  expenses: many(expenses),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  inventory: many(inventory),
  saleItems: many(saleItems),
  movements: many(inventoryMovements),
  shipmentItems: many(shipmentItems),
  priceHistory: many(priceHistory),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
  branch: one(branches, {
    fields: [inventory.branchId],
    references: [branches.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  prescriptions: many(prescriptions),
  sales: many(sales),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  client: one(clients, {
    fields: [prescriptions.clientId],
    references: [clients.id],
  }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  branch: one(branches, {
    fields: [sales.branchId],
    references: [branches.id],
  }),
  client: one(clients, {
    fields: [sales.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
  }),
  items: many(saleItems),
  payments: many(salesPayments),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [auditLogs.branchId],
    references: [branches.id],
  }),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  fromWarehouse: one(branches, {
    fields: [shipments.fromWarehouseId],
    references: [branches.id],
  }),
  toBranch: one(branches, {
    fields: [shipments.toBranchId],
    references: [branches.id],
  }),
  creator: one(users, {
    fields: [shipments.createdBy],
    references: [users.id],
  }),
  items: many(shipmentItems),
}));

export const shipmentItemsRelations = relations(shipmentItems, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentItems.shipmentId],
    references: [shipments.id],
  }),
  product: one(products, {
    fields: [shipmentItems.productId],
    references: [products.id],
  }),
}));

export const shipmentReceiveOpsRelations = relations(shipmentReceiveOps, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentReceiveOps.shipmentId],
    references: [shipments.id],
  }),
  actor: one(users, {
    fields: [shipmentReceiveOps.actorUserId],
    references: [users.id],
  }),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  product: one(products, {
    fields: [priceHistory.productId],
    references: [products.id],
  }),
  changedByUser: one(users, {
    fields: [priceHistory.changedByUserId],
    references: [users.id],
  }),
}));

export const salesPaymentsRelations = relations(salesPayments, ({ one }) => ({
  sale: one(sales, {
    fields: [salesPayments.saleId],
    references: [sales.id],
  }),
}));

export const stockAdjustmentsRelations = relations(stockAdjustments, ({ one }) => ({
  branch: one(branches, {
    fields: [stockAdjustments.branchId],
    references: [branches.id],
  }),
  product: one(products, {
    fields: [stockAdjustments.productId],
    references: [products.id],
  }),
  createdByUser: one(users, {
    fields: [stockAdjustments.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [stockAdjustments.approvedBy],
    references: [users.id],
  }),
}));

// === INSERT SCHEMAS ===

export const insertBranchSchema = createInsertSchema(branches).omit({ id: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});
export const insertPrescriptionSchema = createInsertSchema(prescriptions).omit({
  id: true,
  date: true,
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});
export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true });

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  date: true,
});

export const insertMonthlyClosureSchema = createInsertSchema(monthlyClosures).omit({
  id: true,
  closedAt: true,
});

export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
  createdAt: true,
});
export const insertShipmentItemSchema = createInsertSchema(shipmentItems).omit({
  id: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  changedAt: true,
});

export const insertSalesPaymentSchema = createInsertSchema(salesPayments).omit({
  id: true,
  createdAt: true,
});

export const insertStockAdjustmentSchema = createInsertSchema(stockAdjustments).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});

// === Sale input validation (single vs mixed payments) ===

export const SaleInputSchema = z
  .object({
    branchId: z.number(),
    clientId: z.number().optional(),
    paymentMethod: z.string().optional(), // legacy single payment
    payments: z
      .array(
        z.object({
          method: z.string(),
          amount: z
            .string()
            .refine((val) => parseFloat(val) >= 0, "Payment amount cannot be negative"),
        }),
      )
      .optional(),
    discount: z.string().optional(),
    items: z.array(
      z.object({
        productId: z.number(),
        quantity: z.number(),
      }),
    ),
  })
  .refine(
    (data) => {
      if (!data.paymentMethod && (!data.payments || data.payments.length === 0)) return false;
      if (data.paymentMethod && data.payments && data.payments.length > 0) return false;
      return true;
    },
    {
      message:
        "Either paymentMethod (single payment) or payments array (mixed payments) must be provided, but not both",
    },
  );

export type SaleInput = z.infer<typeof SaleInputSchema>;

// === API TYPES ===

export type Branch = typeof branches.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type Prescription = typeof prescriptions.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type EmployeeKpi = typeof employeeKpi.$inferSelect;
export type MonthlyClosure = typeof monthlyClosures.$inferSelect;

export type Shipment = typeof shipments.$inferSelect;
export type ShipmentItem = typeof shipmentItems.$inferSelect;

export type AuditLog = typeof auditLogs.$inferSelect;

export type PriceHistory = typeof priceHistory.$inferSelect;

export type SalesPayment = typeof salesPayments.$inferSelect;

export type StockAdjustment = typeof stockAdjustments.$inferSelect;
