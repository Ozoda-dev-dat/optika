import bcrypt from "bcryptjs";
import { 
  users, branches, products, inventory, categories,
  type User, type Branch, type Product, type Inventory, type Category
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, sql, desc, sum, gte, lte, or } from "drizzle-orm";
import { IAuthStorage } from "./replit_integrations/auth/storage";

export interface IStorage extends IAuthStorage {
  // Branches
  getBranches(): Promise<Branch[]>;
  getWarehouseBranch(): Promise<Branch | undefined>;
  getWarehouseBranchId(): Promise<number | undefined>;
  createBranch(branch: typeof branches.$inferInsert): Promise<Branch>;
  deleteBranch(id: number): Promise<void>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: typeof categories.$inferInsert): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Products
  getProducts(categoryId?: number, search?: string): Promise<(Product & { category: Category | null })[]>;
  createProduct(product: typeof products.$inferInsert): Promise<Product>;
  updateProduct(id: number, data: Partial<typeof products.$inferInsert>, changedByUserId: string, reason?: string): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  
  // Inventory
  getInventory(branchId?: number, search?: string): Promise<(Inventory & { product: Product | null, branch: Branch | null })[]>;
  updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void>;
  adjustInventory(userId: string, productId: number, branchId: number, quantityChange: number, reason: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Branches
  async getBranches(): Promise<Branch[]> {
    try {
      console.log("Fetching branches from database...");
      const result = await db.select().from(branches);
      console.log("Branches fetched:", result.length);
      return result;
    } catch (error) {
      console.error("Error in getBranches:", error);
      throw error;
    }
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
    const result = await db.insert(branches).values({
      ...branch,
      isWarehouse: branch.isWarehouse
    }).returning();
    return result[0];
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: typeof categories.$inferInsert): Promise<Category> {
    const result = await db.insert(categories).values(category).returning();
    return result[0];
  }

  // Products
  async getProducts(categoryId?: number, search?: string): Promise<(Product & { category: Category | null })[]> {
    const conditions = [];
    if (categoryId) conditions.push(eq(products.categoryId, categoryId));
    if (search) conditions.push(or(like(products.name, `%${search}%`), like(products.sku, `%${search}%`)));

    const query = db.select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id));

    const results = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
    return results.map(r => ({ ...r.products, category: r.categories }));
  }

  async createProduct(product: typeof products.$inferInsert): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  async updateProduct(id: number, data: Partial<typeof products.$inferInsert>, changedByUserId: string, reason?: string): Promise<Product> {
    const result = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return result[0];
  }

  // Inventory
  async getInventory(branchId?: number, search?: string): Promise<(Inventory & { product: Product | null, branch: Branch | null })[]> {
    const conditions = [];
    if (branchId) conditions.push(eq(inventory.branchId, branchId));
    if (search) conditions.push(or(like(products.name, `%${search}%`), like(products.sku, `%${search}%`)));

    const query = db.select()
      .from(inventory)
      .leftJoin(products, eq(inventory.productId, products.id))
      .leftJoin(branches, eq(inventory.branchId, branches.id));

    const results = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
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
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, data: Partial<typeof users.$inferInsert>): Promise<User> {
    const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return result[0];
  }

  async upsertUser(user: any): Promise<User> {
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
  async deleteBranch(id: number): Promise<void> {
    await db.delete(branches).where(eq(branches.id, id));
  }

  // Categories
  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Products
  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }
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
  async getAuditLogs(options: any): Promise<any[]> { return []; }
  async createAuditLog(log: any): Promise<any> { return {} as any; }
}

export const storage = new DatabaseStorage();
