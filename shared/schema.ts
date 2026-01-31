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
  name: text("name").notNull().unique(), // Frames, Lenses, Sunglasses, Accessories, Services
  slug: text("slug").notNull().unique(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").unique(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  brand: text("brand"),
  model: text("model"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(), // Sale price
  costPrice: decimal("cost_price", { precision: 12, scale: 2 }).notNull(), // Purchase price
  imageUrl: text("image_url"),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  quantity: integer("quantity").notNull().default(0),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  birthDate: date("birth_date"),
  passport: text("passport"), // Optional
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  doctorName: text("doctor_name"),
  date: timestamp("date").defaultNow(),
  
  // Right Eye (OD)
  sphRight: text("sph_right"),
  cylRight: text("cyl_right"),
  axisRight: text("axis_right"),
  pdRight: text("pd_right"),
  
  // Left Eye (OS)
  sphLeft: text("sph_left"),
  cylLeft: text("cyl_left"),
  axisLeft: text("axis_left"),
  pdLeft: text("pd_left"),
  
  notes: text("notes"),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  clientId: integer("client_id").references(() => clients.id), // Optional for walk-ins
  userId: varchar("user_id").references(() => users.id).notNull(), // Seller
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  paymentMethod: text("payment_method").notNull(), // cash, card, click, payme, transfer
  status: text("status").default("completed"), // completed, refunded
  createdAt: timestamp("created_at").defaultNow(),
});

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(), // Price at moment of sale
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(), // rent, salary, utilities, other
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

export type ProductWithCategory = Product & { category: Category };
export type InventoryWithProduct = Inventory & { product: ProductWithCategory; branch: Branch };
export type SaleWithDetails = Sale & { client: Client | null; user: User; items: (SaleItem & { product: Product })[] };

export const SaleInputSchema = z.object({
  clientId: z.number().optional(),
  branchId: z.number(),
  items: z.array(z.object({
    productId: z.number(),
    quantity: z.number(),
    price: z.number(), // Override price or use standard
    discount: z.number().default(0),
  })),
  paymentMethod: z.enum(["cash", "card", "click", "payme", "transfer"]),
  discount: z.number().default(0),
});

export type SaleInput = z.infer<typeof SaleInputSchema>;
