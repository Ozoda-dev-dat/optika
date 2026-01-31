import { 
  users, branches, products, inventory, clients, prescriptions, sales, saleItems, expenses, categories,
  type User, type InsertUser, type Branch, type Product, type Inventory, type Client, type Prescription, type Sale, type SaleItem, type Expense,
  type UpsertUser,
  SaleInput
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, sql, desc, sum, gte, lte } from "drizzle-orm";
import { IAuthStorage } from "./replit_integrations/auth/storage";

export interface IStorage extends IAuthStorage {
  // Branches
  getBranches(): Promise<Branch[]>;
  createBranch(branch: typeof branches.$inferInsert): Promise<Branch>;
  
  // Categories
  getCategories(): Promise<typeof categories.$inferSelect[]>;
  createCategory(category: typeof categories.$inferInsert): Promise<typeof categories.$inferSelect>;

  // Products
  getProducts(categoryId?: number, search?: string): Promise<(Product & { category: typeof categories.$inferSelect })[]>;
  createProduct(product: typeof products.$inferInsert): Promise<Product>;
  
  // Inventory
  getInventory(branchId?: number, search?: string): Promise<(Inventory & { product: Product, branch: Branch })[]>;
  updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void>;

  // Clients
  getClients(search?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client & { prescriptions: Prescription[] } | undefined>;
  createClient(client: typeof clients.$inferInsert): Promise<Client>;
  updateClient(id: number, data: Partial<typeof clients.$inferInsert>): Promise<Client>;
  addPrescription(prescription: typeof prescriptions.$inferInsert): Promise<Prescription>;

  // Sales
  createSale(userId: string, input: SaleInput): Promise<Sale>;
  getSales(options: { startDate?: Date, endDate?: Date, branchId?: number }): Promise<(Sale & { client: Client | null, user: User, items: (SaleItem & { product: Product })[] })[]>;

  // Expenses
  getExpenses(options: { startDate?: Date, endDate?: Date }): Promise<Expense[]>;
  createExpense(expense: typeof expenses.$inferInsert): Promise<Expense>;

  // Reports
  getDashboardStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Branches
  async getBranches(): Promise<Branch[]> {
    return await db.select().from(branches);
  }

  async createBranch(branch: typeof branches.$inferInsert): Promise<Branch> {
    const [newBranch] = await db.insert(branches).values(branch).returning();
    return newBranch;
  }

  // Categories
  async getCategories(): Promise<typeof categories.$inferSelect[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: typeof categories.$inferInsert): Promise<typeof categories.$inferSelect> {
    const [newCat] = await db.insert(categories).values(category).returning();
    return newCat;
  }

  // Products
  async getProducts(categoryId?: number, search?: string): Promise<(Product & { category: typeof categories.$inferSelect })[]> {
    let query = db.select().from(products).leftJoin(categories, eq(products.categoryId, categories.id));
    
    if (categoryId) {
      // @ts-ignore
      query = query.where(eq(products.categoryId, categoryId));
    }
    
    if (search) {
      // @ts-ignore
      query = query.where(like(products.name, `%${search}%`));
    }

    const results = await query;
    return results.map(r => ({ ...r.products, category: r.categories! }));
  }

  async createProduct(product: typeof products.$inferInsert): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  // Inventory
  async getInventory(branchId?: number, search?: string): Promise<(Inventory & { product: Product, branch: Branch })[]> {
    let query = db.select()
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(branches, eq(inventory.branchId, branches.id));

    const conditions = [];
    if (branchId) conditions.push(eq(inventory.branchId, branchId));
    if (search) conditions.push(like(products.name, `%${search}%`));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const results = await query;
    return results.map(r => ({ ...r.inventory, product: r.products, branch: r.branches }));
  }

  async updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void> {
    // Check if exists
    const [existing] = await db.select().from(inventory).where(and(eq(inventory.productId, productId), eq(inventory.branchId, branchId)));
    
    if (existing) {
      await db.update(inventory)
        .set({ quantity: sql`${inventory.quantity} + ${quantityChange}` })
        .where(eq(inventory.id, existing.id));
    } else {
      await db.insert(inventory).values({
        productId,
        branchId,
        quantity: quantityChange,
      });
    }
  }

  // Clients
  async getClients(search?: string): Promise<Client[]> {
    if (search) {
      return await db.select().from(clients).where(like(clients.firstName, `%${search}%`));
    }
    return await db.select().from(clients);
  }

  async getClient(id: number): Promise<Client & { prescriptions: Prescription[] } | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) return undefined;
    
    const clientPrescriptions = await db.select().from(prescriptions).where(eq(prescriptions.clientId, id)).orderBy(desc(prescriptions.date));
    return { ...client, prescriptions: clientPrescriptions };
  }

  async createClient(client: typeof clients.$inferInsert): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: number, data: Partial<typeof clients.$inferInsert>): Promise<Client> {
    const [updated] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return updated;
  }

  async addPrescription(prescription: typeof prescriptions.$inferInsert): Promise<Prescription> {
    const [newPrescription] = await db.insert(prescriptions).values(prescription).returning();
    return newPrescription;
  }

  // Sales
  async createSale(userId: string, input: SaleInput): Promise<Sale> {
    return await db.transaction(async (tx) => {
      // 1. Calculate total
      let totalAmount = 0;
      for (const item of input.items) {
        totalAmount += (item.price * item.quantity) - item.discount;
      }
      totalAmount -= input.discount;

      // 2. Create Sale
      const [sale] = await tx.insert(sales).values({
        branchId: input.branchId,
        clientId: input.clientId,
        userId: userId,
        totalAmount: totalAmount.toString(),
        discount: input.discount.toString(),
        paymentMethod: input.paymentMethod,
      }).returning();

      // 3. Create Sale Items and Update Inventory
      for (const item of input.items) {
        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price.toString(),
          total: ((item.price * item.quantity) - item.discount).toString(),
          discount: item.discount.toString(),
        });

        // Update inventory (decrement)
        await tx.execute(sql`
          UPDATE inventory 
          SET quantity = quantity - ${item.quantity} 
          WHERE product_id = ${item.productId} AND branch_id = ${input.branchId}
        `);
      }

      return sale;
    });
  }

  async getSales(options: { startDate?: Date, endDate?: Date, branchId?: number }): Promise<(Sale & { client: Client | null, user: User, items: (SaleItem & { product: Product })[] })[]> {
    const conditions = [];
    if (options.startDate) conditions.push(gte(sales.createdAt, options.startDate));
    if (options.endDate) conditions.push(lte(sales.createdAt, options.endDate));
    if (options.branchId) conditions.push(eq(sales.branchId, options.branchId));

    let query = db.select().from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .innerJoin(users, eq(sales.userId, users.id))
      .orderBy(desc(sales.createdAt));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const saleRows = await query;
    const result = [];

    for (const row of saleRows) {
      const items = await db.select()
        .from(saleItems)
        .innerJoin(products, eq(saleItems.productId, products.id))
        .where(eq(saleItems.saleId, row.sales.id));
      
      result.push({
        ...row.sales,
        client: row.clients,
        user: row.users,
        items: items.map(i => ({ ...i.sale_items, product: i.products })),
      });
    }

    return result;
  }

  // Expenses
  async getExpenses(options: { startDate?: Date, endDate?: Date }): Promise<Expense[]> {
     return await db.select().from(expenses).orderBy(desc(expenses.date));
  }

  async createExpense(expense: typeof expenses.$inferInsert): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  // Reports
  async getDashboardStats(): Promise<any> {
    // Basic implementation
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const dailySales = await db.select({ total: sum(sales.totalAmount) })
      .from(sales)
      .where(gte(sales.createdAt, today));
      
    const totalClients = await db.select({ count: sql<number>`count(*)` }).from(clients);
    
    const lowStock = await db.select({ count: sql<number>`count(*)` }).from(inventory).where(lte(inventory.quantity, 5));

    return {
      dailySales: Number(dailySales[0]?.total || 0),
      monthlySales: 0, // TODO
      totalClients: Number(totalClients[0]?.count || 0),
      lowStockCount: Number(lowStock[0]?.count || 0),
      topProducts: [],
    };
  }
}

export const storage = new DatabaseStorage();
