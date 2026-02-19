import { pgTable, text, serial, integer, boolean, timestamp, date, decimal, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

// === CONFIGURATION CONSTANTS ===

// Sales status enum for strict validation
export const SALE_STATUSES = {
  DRAFT: 'draft',
  COMPLETED: 'completed', 
  CANCELLED: 'cancelled'
} as const;

export type SaleStatus = typeof SALE_STATUSES[keyof typeof SALE_STATUSES];

// Product categories requiring client ID
export const CLIENT_REQUIRED_CATEGORIES = [
  'lenses',
  'contact_lenses',
  'prescription_glasses',
  'medical_devices'
] as const;

// Stock adjustment types
export const ADJUSTMENT_TYPES = {
  WRITEOFF: 'writeoff',
  DEFECTIVE: 'defective',
  TRANSFER: 'transfer',
  ADJUSTMENT: 'adjustment'
} as const;

export type AdjustmentType = typeof ADJUSTMENT_TYPES[keyof typeof ADJUSTMENT_TYPES];

// === TABLES ===

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  discountLimitPercent: integer("discount_limit_percent").notNull().default(10),
  isWarehouse: boolean("is_warehouse").notNull().default(false),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").unique(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  brand: text("brand"),
  model: text("model"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 12, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  // STEP 2: Product fields
  supplier: text("supplier"),
  unit: text("unit").notNull(), // e.g., "dona", "juft", "quti", etc.
  minStock: integer("min_stock").notNull().default(0), // Minimum stock level for alerts
  receivedDate: timestamp("received_date", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  status: text("status").default("in_stock").notNull(), // 'in_stock', 'sold', 'defective', 'transferred'
}, (table) => {
  return {
    minStockCheck: sql`check (${table.minStock} >= 0)`,
  };
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  quantity: integer("quantity").notNull().default(0),
}, (table) => {
  return {
    quantityCheck: sql`check (${table.quantity} >= 0)`,
    uniqueBranchProduct: sql`unique (${table.branchId}, ${table.productId})`,
  };
});

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id), // Context of the movement
  fromBranchId: integer("from_branch_id").references(() => branches.id),
  toBranchId: integer("to_branch_id").references(() => branches.id),
  quantity: integer("quantity").notNull(),
  type: text("type").notNull(), // 'sale', 'transfer', 'adjustment', 'received'
  reason: text("reason"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  birthDate: date("birth_date"),
  passport: text("passport"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  doctorName: text("doctor_name"),
  date: timestamp("date", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  sphRight: text("sph_right"),
  cylRight: text("cyl_right"),
  axisRight: text("axis_right"),
  pdRight: text("pd_right"),
  sphLeft: text("sph_left"),
  cylLeft: text("cyl_left"),
  axisLeft: text("axis_left"),
  pdLeft: text("pd_left"),
  notes: text("notes"),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  clientId: integer("client_id").references(() => clients.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").default(SALE_STATUSES.DRAFT).notNull(), // 'draft', 'completed', 'cancelled'
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => {
  return {
    statusCheck: sql`check (${table.status} in ('draft', 'completed', 'cancelled'))`,
    totalAmountCheck: sql`check (${table.totalAmount} >= 0)`,
    discountCheck: sql`check (${table.discount} >= 0)`,
  };
});

export const monthlyClosures = pgTable("monthly_closures", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  closedBy: varchar("closed_by").references(() => users.id).notNull(),
});

export const insertMonthlyClosureSchema = createInsertSchema(monthlyClosures).omit({ id: true, closedAt: true });
export type MonthlyClosure = typeof monthlyClosures.$inferSelect;

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
});

export const employeeKpi = pgTable("employee_kpi", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  totalBonus: decimal("total_bonus", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(),
  description: text("description"),
  date: timestamp("date", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

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
}));

// === INSERT SCHEMAS ===

export const insertBranchSchema = createInsertSchema(branches).omit({ id: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertPrescriptionSchema = createInsertSchema(prescriptions).omit({ id: true, date: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, date: true });

export const SaleInputSchema = z.object({
  branchId: z.number(),
  clientId: z.number().optional(),
  paymentMethod: z.string().optional(), // Optional for backward compatibility
  payments: z.array(z.object({
    method: z.string(),
    amount: z.string().refine(val => parseFloat(val) >= 0, "Payment amount cannot be negative")
  })).optional(),
  discount: z.string().optional(),
  items: z.array(z.object({
    productId: z.number(),
    quantity: z.number(),
  })),
}).refine(data => {
  // Either paymentMethod (single payment) or payments (mixed payments) must be provided
  if (!data.paymentMethod && (!data.payments || data.payments.length === 0)) {
    return false;
  }
  // Cannot have both paymentMethod and payments array
  if (data.paymentMethod && data.payments && data.payments.length > 0) {
    return false;
  }
  return true;
}, {
  message: "Either paymentMethod (single payment) or payments array (mixed payments) must be provided, but not both"
});

export type SaleInput = z.infer<typeof SaleInputSchema>;

// === API TYPES ===
export type Branch = typeof branches.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Prescription = typeof prescriptions.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type EmployeeKpi = typeof employeeKpi.$inferSelect;
export type PriceHistory = typeof priceHistory.$inferSelect;
export type SalesPayment = typeof salesPayments.$inferSelect;
export type StockAdjustment = typeof stockAdjustments.$inferSelect;

export const shipmentStatus = ["pending", "partially_received", "received", "cancelled"] as const;

export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  fromWarehouseId: integer("from_warehouse_id").references(() => branches.id).notNull(),
  toBranchId: integer("to_branch_id").references(() => branches.id).notNull(),
  status: text("status").notNull().default("pending"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

export const shipmentItems = pgTable("shipment_items", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").references(() => shipments.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  qtySent: integer("qty_sent").notNull(),
  qtyReceived: integer("qty_received").notNull().default(0),
});

export const insertShipmentSchema = createInsertSchema(shipments).omit({ id: true, createdAt: true });
export const insertShipmentItemSchema = createInsertSchema(shipmentItems).omit({ id: true });

export type Shipment = typeof shipments.$inferSelect;
export type ShipmentItem = typeof shipmentItems.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: varchar("actor_user_id").references(() => users.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  metadata: text("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type AuditLog = typeof auditLogs.$inferSelect;

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

export const shipmentReceiveOps = pgTable("shipment_receive_ops", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").references(() => shipments.id).notNull(),
  requestId: text("request_id").notNull(),
  actorUserId: varchar("actor_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

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

export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  oldPrice: decimal("old_price", { precision: 12, scale: 2 }).notNull(),
  newPrice: decimal("new_price", { precision: 12, scale: 2 }).notNull(),
  oldCost: decimal("old_cost", { precision: 12, scale: 2 }).notNull(),
  newCost: decimal("new_cost", { precision: 12, scale: 2 }).notNull(),
  changedByUserId: varchar("changed_by_user_id").references(() => users.id).notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  reason: text("reason"),
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({ id: true, changedAt: true });
export type PriceHistory = typeof priceHistory.$inferSelect;

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

export const salesPayments = pgTable("sales_payments", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  method: text("method").notNull(), // 'cash', 'card', 'click', 'payme', 'transfer'
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    amountCheck: sql`check (${table.amount} > 0)`,
  };
});

export const insertSalesPaymentSchema = createInsertSchema(salesPayments).omit({ id: true, createdAt: true });
export type SalesPayment = typeof salesPayments.$inferSelect;

export const salesPaymentsRelations = relations(salesPayments, ({ one }) => ({
  sale: one(sales, {
    fields: [salesPayments.saleId],
    references: [sales.id],
  }),
}));

export const stockAdjustments = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(), // Can be positive or negative
  type: text("type").notNull(), // 'adjust', 'writeoff', 'return'
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  reason: text("reason").notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id), // nullable for pending/rejected
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  approvedAt: timestamp("approved_at", { withTimezone: true }), // nullable until approved
}, (table) => {
  return {
    quantityCheck: sql`check (${table.quantity} != 0)`,
    statusCheck: sql`check (${table.status} in ('pending', 'approved', 'rejected'))`,
    typeCheck: sql`check (${table.type} in ('writeoff', 'defective', 'transfer', 'adjustment'))`,
  };
});

export const insertStockAdjustmentSchema = createInsertSchema(stockAdjustments).omit({ id: true, createdAt: true, approvedAt: true });
export type StockAdjustment = typeof stockAdjustments.$inferSelect;

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

// === PERFORMANCE INDEXES ===
// Indexes will be added later when needed
