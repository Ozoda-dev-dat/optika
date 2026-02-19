import * as bcrypt from "bcryptjs";
import { db } from "./db";
import { 
  branches, 
  categories, 
  products, 
  inventory,
  users,
  type Branch,
  type Category,
  type Product,
  type Inventory,
  type User,
  type NewInventory
} from "../shared/schema";
import { eq, and, or, like, gte, lte, desc, sql, sum } from "drizzle-orm";
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
  getProducts(categoryId?: number, search?: string): Promise<Array<{
    id: number;
    name: string;
    sku: string | null;
    categoryId: number;
    price: string;
    costPrice: string;
    category: Category | null;
  }>>;
  createProduct(product: typeof products.$inferInsert): Promise<Product>;
  updateProduct(id: number, data: Partial<typeof products.$inferInsert>, changedByUserId: string, reason?: string): Promise<Product>;
  
  // Inventory
  getInventory(branchId?: number, search?: string): Promise<(Inventory & { product: Product | null, branch: Branch | null })[]>;
  updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void>;
  adjustInventory(userId: string, productId: number, branchId: number, quantityChange: number, reason: string): Promise<void>;

  // Audit Logs (placeholder)
  getAuditLogs(options: { 
    startDate?: Date, 
    endDate?: Date, 
    branchId?: number, 
    actionType?: string, 
    entityType?: string, 
    offset?: number,
    limit?: number
  }): Promise<any[]>;
  createAuditLog(log: any): Promise<any>;

  // Users
  upsertUser(user: any): Promise<any>;
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
    const result = await db.insert(branches).values(branch).returning();
    return result[0];
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    try {
      const result = await db.select().from(categories);
      return result;
    } catch (error) {
      console.error('Error in getCategories:', error);
      throw error;
    }
  }

  async createCategory(category: typeof categories.$inferInsert): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  // Products
  async getProducts(categoryId?: number, search?: string): Promise<Array<{
    id: number;
    name: string;
    sku: string | null;
    categoryId: number;
    price: string;
    costPrice: string;
    category: { id: number; name: string; slug: string; } | null;
  }>> {
    const conditions = [];
    if (categoryId) conditions.push(eq(products.categoryId, categoryId));
    if (search) conditions.push(or(like(products.name, `%${search}%`), like(products.sku, `%${search}%`)));

    const baseQuery = db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        categoryId: products.categoryId,
        price: products.price,
        costPrice: products.costPrice,
        category: categories
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id));

    const finalQuery = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const results = await finalQuery;
    return results;
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
    const conditions = [];
    if (branchId) conditions.push(eq(inventory.branchId, branchId));
    if (search) conditions.push(or(like(products.name, `%${search}%`), like(products.sku, `%${search}%`)));

    const baseQuery = db
      .select({
        id: inventory.id,
        productId: inventory.productId,
        branchId: inventory.branchId,
        quantity: inventory.quantity,
        product: products,
        branch: branches
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(branches, eq(inventory.branchId, branches.id));

    const finalQuery = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const results = await finalQuery;
    return results;
  }

  async updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void> {
    const [currentInventory] = await db
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

    const updateData: any = { 
      quantity: newQty
    };

    await db
      .update(inventory)
      .set(updateData)
      .where(and(eq(inventory.productId, productId), eq(inventory.branchId, branchId)));
  }

  async adjustInventory(userId: string, productId: number, branchId: number, quantityChange: number, reason: string): Promise<void> {
    await this.updateInventory(productId, branchId, quantityChange);
  }

  // Auth methods (minimal implementation)
  async getUser(id: string): Promise<any | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<any | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: typeof users.$inferInsert): Promise<any> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, data: Partial<typeof users.$inferInsert>): Promise<any> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
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

  // Audit Logs (placeholder)
  async getAuditLogs(options: { 
    startDate?: Date, 
    endDate?: Date, 
    branchId?: number, 
    actionType?: string, 
    entityType?: string, 
    offset?: number,
    limit?: number
  }): Promise<any[]> {
    return [];
  }

  async createAuditLog(log: any): Promise<any> {
    return {} as any;
  }

  async upsertUser(user: any): Promise<any> {
    const existing = await this.getUser(user.id);
    if (existing) {
      return await this.updateUser(user.id, user);
    } else {
      return await this.createUser(user);
    }
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
