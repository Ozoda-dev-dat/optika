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
  fromBranchId: integer("from_branch_id").references(() => branches.id),
  toBranchId: integer("to_branch_id").references(() => branches.id),
  quantity: integer("quantity").notNull(),
  type: text("type").notNull(), // 'sale', 'return', 'transfer', 'adjustment'
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
  status: text("status").default("completed"), // 'completed', 'returned'
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const saleReturns = pgTable("sale_returns", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  reason: text("reason"),
  totalRefunded: decimal("total_refunded", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
  returns: many(saleReturns),
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
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({ id: true, createdAt: true });
export const insertSaleReturnSchema = createInsertSchema(saleReturns).omit({ id: true, createdAt: true });

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
export type SaleReturn = typeof saleReturns.$inferSelect;
export type EmployeeKpi = typeof employeeKpi.$inferSelect;

export const SaleInputSchema = z.object({
  clientId: z.number().optional(),
  branchId: z.number(),
  items: z.array(z.object({
    productId: z.number(),
    quantity: z.number(),
    price: z.number(),
    discount: z.number().default(0),
  })),
  paymentMethod: z.enum(["cash", "card", "click", "payme", "transfer"]),
  discount: z.number().default(0),
});

export type SaleInput = z.infer<typeof SaleInputSchema>;
