// server/storage-simple.ts
import bcrypt from "bcryptjs";
import {
  users,
  branches,
  products,
  inventory,
  categories,
  priceHistory,
  clients,
  type User,
  type Branch,
  type Product,
  type Inventory,
  type Category,
  type Client,
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, or } from "drizzle-orm";
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
  getProducts(
    categoryId?: number,
    search?: string,
  ): Promise<(Product & { category: Category | null })[]>;
  createProduct(product: typeof products.$inferInsert): Promise<Product>;
  updateProduct(
    id: number,
    data: Partial<typeof products.$inferInsert>,
    changedByUserId: string,
    reason?: string,
  ): Promise<Product>;
  deleteProduct(id: number): Promise<void>;

  // Inventory
  getInventory(
    branchId?: number,
    search?: string,
  ): Promise<(Inventory & { product: Product | null; branch: Branch | null })[]>;
  updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void>;
  adjustInventory(
    userId: string,
    productId: number,
    branchId: number,
    quantityChange: number,
    reason: string,
  ): Promise<void>;

  // Clients
  getClients(search?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: typeof clients.$inferInsert): Promise<Client>;
  updateClient(id: number, data: Partial<typeof clients.$inferInsert>): Promise<Client | undefined>;

  // (Qolganlari keyin)
  getShipments(_branchId?: number): Promise<any[]>;
  createShipment(
    _userId: string,
    _fromWarehouseId: number,
    _toBranchId: number,
    _items: any[],
  ): Promise<any>;
  receiveShipment(_shipmentId: number, _receivedItems: any[]): Promise<any>;
  addPrescription(_prescription: any): Promise<any>;
  createSale(_userId: string, _input: any): Promise<any>;
  getSale(_id: number): Promise<any>;
  getSales(_options: any): Promise<any[]>;
  updateSaleStatus(_id: number, _status: string): Promise<any>;
  createPriceHistory(_entry: any): Promise<any>;
  getPriceHistory(_productId: number): Promise<any[]>;
  createSalesPayment(_payment: any): Promise<any>;
  getSalesPayments(_saleId: number): Promise<any[]>;
  createStockAdjustment(_adjustment: any): Promise<any>;
  getStockAdjustments(_branchId?: number, _status?: string): Promise<any[]>;
  approveStockAdjustment(_id: number, _approvedBy: string): Promise<any>;
  rejectStockAdjustment(_id: number, _approvedBy: string): Promise<any>;
  getLowStockProducts(): Promise<any[]>;
  getNonMovingProducts(_days: number): Promise<any[]>;
  getPaymentBreakdown(_startDate?: Date, _endDate?: Date, _branchId?: number): Promise<any[]>;
  getWriteoffs(_startDate?: Date, _endDate?: Date, _branchId?: number): Promise<any[]>;
  exportSalesToCSV(_startDate?: Date, _endDate?: Date): Promise<string>;
  exportInventoryToCSV(_branchId?: number): Promise<string>;
  importProductsFromCSV(_csvContent: string): Promise<any>;
  isMonthClosed(_branchId: number, _month: number, _year: number): Promise<boolean>;
  closeMonth(_branchId: number, _month: number, _year: number, _userId: string): Promise<any>;
  getExpenses(_options: any): Promise<any[]>;
  createExpense(_expense: any): Promise<any>;
  getAuditLogs(_options: any): Promise<any[]>;
  createAuditLog(_log: any): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // =========================
  // Branches
  // =========================
  async getBranches(): Promise<Branch[]> {
    const result = await db.select().from(branches);
    return result;
  }

  async getWarehouseBranch(): Promise<Branch | undefined> {
    const [warehouse] = await db
      .select()
      .from(branches)
      .where(eq(branches.isWarehouse, true));
    return warehouse;
  }

  async getWarehouseBranchId(): Promise<number | undefined> {
    const warehouse = await this.getWarehouseBranch();
    return warehouse?.id;
  }

  async createBranch(branchInput: typeof branches.$inferInsert): Promise<Branch> {
    const result = await db
      .insert(branches)
      .values({
        name: branchInput.name,
        address: branchInput.address ?? "",
        phone: branchInput.phone ?? "",
        isWarehouse: branchInput.isWarehouse ?? false,
      })
      .returning();

    return result[0];
  }

  async deleteBranch(id: number): Promise<void> {
    await db.delete(branches).where(eq(branches.id, id));
  }

  // =========================
  // Categories
  // =========================
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: typeof categories.$inferInsert): Promise<Category> {
    const result = await db.insert(categories).values(category).returning();
    return result[0];
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // =========================
  // Products
  // =========================
  async getProducts(
    categoryId?: number,
    search?: string,
  ): Promise<(Product & { category: Category | null })[]> {
    const conditions: any[] = [];

    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    if (search) {
      conditions.push(
        or(
          like(products.name, `%${search}%`),
          like(products.sku, `%${search}%`),
        ),
      );
    }

    const query = db
      .select({
        product: products,
        category: categories,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id));

    const rows =
      conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

    return rows.map((row) => ({
      ...row.product,
      category: row.category ?? null,
    }));
  }

  async createProduct(productInput: typeof products.$inferInsert): Promise<Product> {
    const normalized: any = {
      ...productInput,
      costPrice: (productInput as any).costPrice ?? (productInput as any).cost,
    };
    delete normalized.cost;

    const result = await db.insert(products).values(normalized).returning();
    return result[0];
  }

  async updateProduct(
    id: number,
    data: Partial<typeof products.$inferInsert>,
    changedByUserId: string,
    reason?: string,
  ): Promise<Product> {
    return await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(products)
        .where(eq(products.id, id))
        .limit(1);

      if (!before) throw new Error("Product not found");

      const [after] = await tx
        .update(products)
        .set(data as any)
        .where(eq(products.id, id))
        .returning();

      if (!after) throw new Error("Failed to update product");

      const beforePrice = String(before.price);
      const afterPrice = String(after.price);

      const beforeCost = String((before as any).costPrice);
      const afterCost = String((after as any).costPrice);

      const priceChanged = beforePrice !== afterPrice;
      const costChanged = beforeCost !== afterCost;

      if (priceChanged || costChanged) {
        await tx.insert(priceHistory).values({
          productId: after.id,
          oldPrice: beforePrice,
          newPrice: afterPrice,
          oldCost: beforeCost,
          newCost: afterCost,
          changedByUserId,
          reason: reason ?? null,
        } as any);
      }

      return after;
    });
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // =========================
  // Inventory
  // =========================
  async getInventory(
    branchId?: number,
    search?: string,
  ): Promise<(Inventory & { product: Product | null; branch: Branch | null })[]> {
    const conditions: any[] = [];

    if (branchId) {
      conditions.push(eq(inventory.branchId, branchId));
    }

    if (search) {
      conditions.push(
        or(
          like(products.name, `%${search}%`),
          like(products.sku, `%${search}%`),
        ),
      );
    }

    const query = db
      .select({
        inv: inventory,
        product: products,
        branch: branches,
      })
      .from(inventory)
      .leftJoin(products, eq(inventory.productId, products.id))
      .leftJoin(branches, eq(inventory.branchId, branches.id));

    const rows =
      conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

    return rows.map((row) => ({
      ...row.inv,
      product: row.product ?? null,
      branch: row.branch ?? null,
    }));
  }

  async updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void> {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.productId, productId),
            eq(inventory.branchId, branchId),
          ),
        )
        .limit(1);

      if (!current) {
        throw new Error("Inventory not found");
      }

      const newQty = Number(current.quantity) + quantityChange;
      if (newQty < 0) throw new Error("Insufficient inventory");

      await tx
        .update(inventory)
        .set({ quantity: newQty })
        .where(
          and(
            eq(inventory.productId, productId),
            eq(inventory.branchId, branchId),
          ),
        );
    });
  }

  async adjustInventory(
    _userId: string,
    productId: number,
    branchId: number,
    quantityChange: number,
    _reason: string,
  ): Promise<void> {
    await this.updateInventory(productId, branchId, quantityChange);
  }

  // =========================
  // Clients (✅ REAL DB)
  // =========================
  async getClients(search?: string): Promise<Client[]> {
    if (!search || !search.trim()) {
      return await db.select().from(clients);
    }

    const s = search.trim();
    return await db
      .select()
      .from(clients)
      .where(
        or(
          like(clients.firstName, `%${s}%`),
          like(clients.lastName, `%${s}%`),
          like(clients.phone, `%${s}%`),
        ),
      );
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(clientInput: typeof clients.$inferInsert): Promise<Client> {
    // birthDate: <input type="date" /> dan odatda "YYYY-MM-DD" keladi (date column uchun mos)
    const result = await db.insert(clients).values(clientInput).returning();
    return result[0];
  }

  async updateClient(
    id: number,
    data: Partial<typeof clients.$inferInsert>,
  ): Promise<Client | undefined> {
    const result = await db
      .update(clients)
      .set(data as any)
      .where(eq(clients.id, id))
      .returning();

    return result[0];
  }

  // =========================
  // Auth methods
  // =========================
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
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
    if (existing) return await this.updateUser(user.id, user);
    return await this.createUser(user);
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

  // =========================
  // Placeholder (qolganlari keyin)
  // =========================
  async getShipments(_branchId?: number): Promise<any[]> {
    return [];
  }
  async createShipment(
    _userId: string,
    _fromWarehouseId: number,
    _toBranchId: number,
    _items: any[],
  ): Promise<any> {
    return {} as any;
  }
  async receiveShipment(_shipmentId: number, _receivedItems: any[]): Promise<any> {
    return {} as any;
  }
  async addPrescription(_prescription: any): Promise<any> {
    return {} as any;
  }
  async createSale(_userId: string, _input: any): Promise<any> {
    return {} as any;
  }
  async getSale(_id: number): Promise<any> {
    return undefined;
  }
  async getSales(_options: any): Promise<any[]> {
    return [];
  }
  async updateSaleStatus(_id: number, _status: string): Promise<any> {
    return {} as any;
  }
  async createPriceHistory(_entry: any): Promise<any> {
    return {} as any;
  }
  async getPriceHistory(_productId: number): Promise<any[]> {
    return [];
  }
  async createSalesPayment(_payment: any): Promise<any> {
    return {} as any;
  }
  async getSalesPayments(_saleId: number): Promise<any[]> {
    return [];
  }
  async createStockAdjustment(_adjustment: any): Promise<any> {
    return {} as any;
  }
  async getStockAdjustments(_branchId?: number, _status?: string): Promise<any[]> {
    return [];
  }
  async approveStockAdjustment(_id: number, _approvedBy: string): Promise<any> {
    return {} as any;
  }
  async rejectStockAdjustment(_id: number, _approvedBy: string): Promise<any> {
    return {} as any;
  }
  async getLowStockProducts(): Promise<any[]> {
    return [];
  }
  async getNonMovingProducts(_days: number): Promise<any[]> {
    return [];
  }
  async getPaymentBreakdown(
    _startDate?: Date,
    _endDate?: Date,
    _branchId?: number,
  ): Promise<any[]> {
    return [];
  }
  async getWriteoffs(
    _startDate?: Date,
    _endDate?: Date,
    _branchId?: number,
  ): Promise<any[]> {
    return [];
  }
  async exportSalesToCSV(_startDate?: Date, _endDate?: Date): Promise<string> {
    return "";
  }
  async exportInventoryToCSV(_branchId?: number): Promise<string> {
    return "";
  }
  async importProductsFromCSV(_csvContent: string): Promise<any> {
    return { success: false, message: "Not implemented" };
  }
  async isMonthClosed(_branchId: number, _month: number, _year: number): Promise<boolean> {
    return false;
  }
  async closeMonth(
    _branchId: number,
    _month: number,
    _year: number,
    _userId: string,
  ): Promise<any> {
    return {} as any;
  }
  async getExpenses(_options: any): Promise<any[]> {
    return [];
  }
  async createExpense(_expense: any): Promise<any> {
    return {} as any;
  }
  async getAuditLogs(_options: any): Promise<any[]> {
    return [];
  }
  async createAuditLog(_log: any): Promise<any> {
    return {} as any;
  }
}

export const storage = new DatabaseStorage();
