import { pgTable, text, serial, integer, boolean, timestamp, date, decimal, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

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
  receivedDate: timestamp("received_date").defaultNow(),
  status: text("status").default("in_stock").notNull(), // 'in_stock', 'sold', 'defective', 'transferred'
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  quantity: integer("quantity").notNull().default(0),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  birthDate: date("birth_date"),
  passport: text("passport"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  doctorName: text("doctor_name"),
  date: timestamp("date").defaultNow(),
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
  status: text("status").default("completed").notNull(), // 'draft', 'completed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const monthlyClosures = pgTable("monthly_closures", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  closedAt: timestamp("closed_at").defaultNow().notNull(),
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(),
  description: text("description"),
  date: timestamp("date").defaultNow(),
});

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
  paymentMethod: z.string(),
  discount: z.string().optional(),
  items: z.array(z.object({
    productId: z.number(),
    quantity: z.number(),
  })),
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

export const shipmentStatus = ["pending", "partially_received", "received", "cancelled"] as const;

export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  fromWarehouseId: integer("from_warehouse_id").references(() => branches.id).notNull(),
  toBranchId: integer("to_branch_id").references(() => branches.id).notNull(),
  status: text("status").notNull().default("pending"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
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
