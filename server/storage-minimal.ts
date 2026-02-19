import bcrypt from "bcryptjs";
import { 
  users, branches, products, inventory, clients, prescriptions, sales, saleItems, expenses, categories,
  inventoryMovements, employeeKpi, shipments, shipmentItems, auditLogs, monthlyClosures, priceHistory, salesPayments, stockAdjustments,
  type User, type Branch, type Product, type Inventory, type Client, type Prescription, type Sale, type SaleItem, type Expense,
  type UpsertUser, type InventoryMovement, type EmployeeKpi,
  type SaleInput, type Category, type Shipment, type ShipmentItem, type AuditLog, type MonthlyClosure, type PriceHistory, type SalesPayment, type StockAdjustment
} from "@shared/schema";
import { getCurrentTimestamp, getLocalStartOfDay, getLocalEndOfDay } from "@shared/timezone";
import { db } from "./db";
import { eq, like, and, sql, desc, sum, gte, lte, or } from "drizzle-orm";
import { IAuthStorage } from "./replit_integrations/auth/storage";

export interface IStorage extends IAuthStorage {
  // Branches
  getBranches(): Promise<Branch[]>;
  getWarehouseBranch(): Promise<Branch | undefined>;
  getWarehouseBranchId(): Promise<number | undefined>;
  createBranch(branch: typeof branches.$inferInsert): Promise<Branch>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: typeof categories.$inferInsert): Promise<Category>;

  // Products
  getProducts(categoryId?: number, search?: string): Promise<(Product & { category: Category })[]>;
  createProduct(product: typeof products.$inferInsert): Promise<Product>;
  updateProduct(id: number, data: Partial<typeof products.$inferInsert>, changedByUserId: string, reason?: string): Promise<Product>;
  
  // Inventory
  getInventory(branchId?: number, search?: string): Promise<(Inventory & { product: Product, branch: Branch })[]>;
  updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void>;
  adjustInventory(userId: string, productId: number, branchId: number, quantityChange: number, reason: string): Promise<void>;

  // Shipments
  getShipments(branchId?: number): Promise<(Shipment & { fromWarehouse: Branch, toBranch: Branch, items: (ShipmentItem & { product: Product })[] })[]>;
  createShipment(userId: string, fromWarehouseId: number, toBranchId: number, items: { productId: number, qtySent: number }[]): Promise<Shipment>;
  receiveShipment(shipmentId: number, receivedItems: { productId: number, qtyReceived: number }[]): Promise<Shipment>;

  // Clients
  getClients(search?: string): Promise<(Client & { totalSpent: number })[]>;
  getClient(id: number): Promise<(Client & { prescriptions: Prescription[], salesHistory: any[], totalSpent: number }) | undefined>;
  createClient(client: typeof clients.$inferInsert): Promise<Client>;
  updateClient(id: number, data: Partial<typeof clients.$inferInsert>): Promise<Client>;
  addPrescription(prescription: typeof prescriptions.$inferInsert): Promise<Prescription>;

  // Sales
  createSale(userId: string, input: SaleInput): Promise<Sale>;
  getSale(id: number): Promise<Sale | undefined>;
  getSales(options: { startDate?: Date, endDate?: Date, branchId?: number, saleId?: number }): Promise<(Sale & { client: Client | null, user: User, items: (SaleItem & { product: Product })[] })[]>;
  updateSaleStatus(id: number, status: string): Promise<Sale>;

  // Price History
  createPriceHistory(entry: typeof priceHistory.$inferInsert): Promise<PriceHistory>;
  getPriceHistory(productId: number): Promise<(PriceHistory & { changedByUser: User })[]>;

  // Sales Payments
  createSalesPayment(payment: typeof salesPayments.$inferInsert): Promise<SalesPayment>;
  getSalesPayments(saleId: number): Promise<SalesPayment[]>;

  // Stock Adjustments
  createStockAdjustment(adjustment: typeof stockAdjustments.$inferInsert): Promise<StockAdjustment>;
  getStockAdjustments(branchId?: number, status?: string): Promise<(StockAdjustment & { 
    branch: Branch, 
    product: Product, 
    createdByUser: User, 
    approvedByUser: User | null 
  })[]>;
  approveStockAdjustment(id: number, approvedBy: string): Promise<StockAdjustment>;
  rejectStockAdjustment(id: number, approvedBy: string): Promise<StockAdjustment>;

  // Reports
  getLowStockProducts(): Promise<(Product & { inventory: Inventory, branch: Branch })[]>;
  getNonMovingProducts(days: number): Promise<(Product & { lastSaleDate?: Date })[]>;
  getPaymentBreakdown(startDate?: Date, endDate?: Date, branchId?: number): Promise<{ method: string, totalAmount: string, countSales: number }[]>;
  getWriteoffs(startDate?: Date, endDate?: Date, branchId?: number): Promise<(StockAdjustment & { 
    product: Product, 
    branch: Branch, 
    approvedByUser: User 
  })[]>;

  // CSV Export/Import
  exportSalesToCSV(startDate?: Date, endDate?: Date): Promise<string>;
  exportInventoryToCSV(branchId?: number): Promise<string>;
  importProductsFromCSV(csvContent: string): Promise<{ 
    success: boolean; 
    message: string; 
    createdCount?: number; 
    updatedCount?: number; 
    inventoryUpdatedCount?: number;
    errors?: Array<{ row: number; field: string; message: string }> 
  }>;

  // Monthly Closures
  isMonthClosed(branchId: number, month: number, year: number): Promise<boolean>;
  closeMonth(branchId: number, month: number, year: number, userId: string): Promise<MonthlyClosure>;

  // Audit Logs
  getAuditLogs(options: { 
    startDate?: Date, 
    endDate?: Date, 
    branchId?: number, 
    actionType?: string, 
    entityType?: string, 
    offset?: number,
    limit?: number
  }): Promise<(AuditLog & { actor: User })[]>;
  createAuditLog(log: typeof auditLogs.$inferInsert): Promise<AuditLog>;

  // Expenses
  getExpenses(options: { startDate?: Date, endDate?: Date }): Promise<Expense[]>;
  createExpense(expense: typeof expenses.$inferInsert): Promise<Expense>;
}

export class DatabaseStorage implements IStorage {
  // Branches
  async getBranches(): Promise<Branch[]> {
    return await db.select().from(branches);
  }

  async getWarehouseBranch(): Promise<Branch | undefined> {
    const [warehouse] = await db.select().from(branches).where(eq(branches.isWarehouse, true));
    return warehouse;
  }

  async getWarehouseBranchId(): Promise<number | undefined> {
    const warehouse = await this.getWarehouseBranch();
    return warehouse?.id;
  }

  async createBranch(branch: typeof branches.$inferInsert): Promise<Branch> {
    const [newBranch] = await db.insert(branches).values(branch).returning();
    return newBranch;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: typeof categories.$inferInsert): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  // Products
  async getProducts(categoryId?: number, search?: string): Promise<(Product & { category: Category })[]> {
    let query = db.select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id));

    const conditions = [];
    if (categoryId) conditions.push(eq(products.categoryId, categoryId));
    if (search) conditions.push(or(like(products.name, `%${search}%`), like(products.sku, `%${search}%`)));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query;
    return results.map(r => ({ ...r.products, category: r.categories }));
  }

  async createProduct(product: typeof products.$inferInsert): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, data: Partial<typeof products.$inferInsert>, changedByUserId: string, reason?: string): Promise<Product> {
    const [updated] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return updated;
  }

  // Inventory
  async getInventory(branchId?: number, search?: string): Promise<(Inventory & { product: Product, branch: Branch })[]> {
    let query = db.select()
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(branches, eq(inventory.branchId, branches.id));

    const conditions = [];
    if (branchId) conditions.push(eq(inventory.branchId, branchId));
    if (search) conditions.push(or(like(products.name, `%${search}%`), like(products.sku, `%${search}%`)));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query;
    return results.map(r => ({ 
      ...r.inventory, 
      product: r.products, 
      branch: r.branches 
    }));
  }

  async updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void> {
    await db.transaction(async (tx) => {
      const [currentInventory] = await tx
        .select()
        .from(inventory)
        .where(and(eq(inventory.productId, productId), eq(inventory.branchId, branchId)))
        .limit(1);

      if (!currentInventory) {
        throw new Error("Inventory not found");
      }

      const newQty = Number(currentInventory.quantity) + quantityChange;
      if (newQty < 0) {
        throw new Error("Insufficient inventory");
      }

      await tx
        .update(inventory)
        .set({ quantity: newQty })
        .where(and(eq(inventory.productId, productId), eq(inventory.branchId, branchId)));
    });
  }

  async adjustInventory(userId: string, productId: number, branchId: number, quantityChange: number, reason: string): Promise<void> {
    await this.updateInventory(productId, branchId, quantityChange);
  }

  // Audit Logs
  async getAuditLogs(options: { 
    startDate?: Date, 
    endDate?: Date, 
    branchId?: number, 
    actionType?: string, 
    entityType?: string, 
    offset?: number,
    limit?: number
  }): Promise<(AuditLog & { actor: User })[]> {
    let query = db.select()
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id));

    const conditions = [];
    if (options.startDate) conditions.push(gte(auditLogs.createdAt, options.startDate));
    if (options.endDate) conditions.push(lte(auditLogs.createdAt, options.endDate));
    if (options.branchId) conditions.push(eq(auditLogs.branchId, options.branchId));
    if (options.actionType) conditions.push(eq(auditLogs.actionType, options.actionType));
    if (options.entityType) conditions.push(eq(auditLogs.entityType, options.entityType));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(auditLogs.createdAt));

    if (options.offset) query = query.offset(options.offset);
    if (options.limit) query = query.limit(options.limit);

    const results = await query;
    return results.map(r => ({ ...r.auditLogs, actor: r.users }));
  }

  async createAuditLog(log: typeof auditLogs.$inferInsert): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  // Auth methods (minimal implementation)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: typeof users.$inferInsert): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, data: Partial<typeof users.$inferInsert>): Promise<User> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const existing = await this.getUser(user.id);
    if (existing) {
      return await this.updateUser(user.id, user);
    } else {
      return await this.createUser(user);
    }
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async validatePassword(username: string, password: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) return false;
    return await bcrypt.compare(password, user.password);
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  // Placeholder implementations for other methods
  async getShipments(branchId?: number): Promise<any[]> { return []; }
  async createShipment(userId: string, fromWarehouseId: number, toBranchId: number, items: any[]): Promise<any> { return {} as any; }
  async receiveShipment(shipmentId: number, receivedItems: any[]): Promise<any> { return {} as any; }
  async getClients(search?: string): Promise<any[]> { return []; }
  async getClient(id: number): Promise<any> { return undefined; }
  async createClient(client: any): Promise<any> { return {} as any; }
  async updateClient(id: number, data: any): Promise<any> { return {} as any; }
  async addPrescription(prescription: any): Promise<any> { return {} as any; }
  async createSale(userId: string, input: any): Promise<any> { return {} as any; }
  async getSale(id: number): Promise<any> { return undefined; }
  async getSales(options: any): Promise<any[]> { return []; }
  async updateSaleStatus(id: number, status: string): Promise<any> { return {} as any; }
  async createPriceHistory(entry: any): Promise<any> { return {} as any; }
  async getPriceHistory(productId: number): Promise<any[]> { return []; }
  async createSalesPayment(payment: any): Promise<any> { return {} as any; }
  async getSalesPayments(saleId: number): Promise<any[]> { return []; }
  async createStockAdjustment(adjustment: any): Promise<any> { return {} as any; }
  async getStockAdjustments(branchId?: number, status?: string): Promise<any[]> { return []; }
  async approveStockAdjustment(id: number, approvedBy: string): Promise<any> { return {} as any; }
  async rejectStockAdjustment(id: number, approvedBy: string): Promise<any> { return {} as any; }
  async getLowStockProducts(): Promise<any[]> { return []; }
  async getNonMovingProducts(days: number): Promise<any[]> { return []; }
  async getPaymentBreakdown(startDate?: Date, endDate?: Date, branchId?: number): Promise<any[]> { return []; }
  async getWriteoffs(startDate?: Date, endDate?: Date, branchId?: number): Promise<any[]> { return []; }
  async exportSalesToCSV(startDate?: Date, endDate?: Date): Promise<string> { return ""; }
  async exportInventoryToCSV(branchId?: number): Promise<string> { return ""; }
  async importProductsFromCSV(csvContent: string): Promise<any> { return { success: false, message: "Not implemented" }; }
  async isMonthClosed(branchId: number, month: number, year: number): Promise<boolean> { return false; }
  async closeMonth(branchId: number, month: number, year: number, userId: string): Promise<any> { return {} as any; }
  async getExpenses(options: any): Promise<any[]> { return []; }
  async createExpense(expense: any): Promise<any> { return {} as any; }
}

export const storage = new DatabaseStorage();
