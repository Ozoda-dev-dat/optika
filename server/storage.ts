import { 
  users, branches, products, inventory, clients, prescriptions, sales, saleItems, expenses, categories,
  inventoryMovements, saleReturns, employeeKpi,
  type User, type Branch, type Product, type Inventory, type Client, type Prescription, type Sale, type SaleItem, type Expense,
  type UpsertUser, type InventoryMovement, type SaleReturn, type EmployeeKpi,
  type SaleInput, type Category
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, sql, desc, sum, gte, lte } from "drizzle-orm";
import { IAuthStorage } from "./replit_integrations/auth/storage";

export interface IStorage extends IAuthStorage {
  // Branches
  getBranches(): Promise<Branch[]>;
  createBranch(branch: typeof branches.$inferInsert): Promise<Branch>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: typeof categories.$inferInsert): Promise<Category>;

  // Products
  getProducts(categoryId?: number, search?: string): Promise<(Product & { category: Category })[]>;
  createProduct(product: typeof products.$inferInsert): Promise<Product>;
  
  // Inventory
  getInventory(branchId?: number, search?: string): Promise<(Inventory & { product: Product, branch: Branch })[]>;
  updateInventory(productId: number, branchId: number, quantityChange: number): Promise<void>;
  transferInventory(userId: string, productId: number, fromBranchId: number, toBranchId: number, quantity: number): Promise<void>;

  // Clients
  getClients(search?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client & { prescriptions: Prescription[] } | undefined>;
  createClient(client: typeof clients.$inferInsert): Promise<Client>;
  updateClient(id: number, data: Partial<typeof clients.$inferInsert>): Promise<Client>;
  addPrescription(prescription: typeof prescriptions.$inferInsert): Promise<Prescription>;

  // Sales
  createSale(userId: string, input: SaleInput): Promise<Sale>;
  getSales(options: { startDate?: Date, endDate?: Date, branchId?: number }): Promise<(Sale & { client: Client | null, user: User, items: (SaleItem & { product: Product })[] })[]>;
  processReturn(userId: string, saleId: number, reason: string): Promise<SaleReturn>;

  // Expenses
  getExpenses(options: { startDate?: Date, endDate?: Date }): Promise<Expense[]>;
  createExpense(expense: typeof expenses.$inferInsert): Promise<Expense>;

  // Reports
  getDashboardStats(): Promise<any>;
  getEmployeeKpi(month: number, year: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // ... (existing code)
  
  async getEmployeeKpi(month: number, year: number): Promise<any[]> {
    const results = await db.select({
      userId: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      position: users.position,
      monthlySalary: users.monthlySalary,
      commissionPercent: users.commissionPercent,
      totalSales: employeeKpi.totalSales,
    })
    .from(users)
    .leftJoin(employeeKpi, and(
      eq(users.id, employeeKpi.userId),
      eq(employeeKpi.month, month),
      eq(employeeKpi.year, year)
    ))
    .where(sql`${users.role} != 'admin'`);

    return results.map(row => {
      const salary = Number(row.monthlySalary || 0);
      const commissionPercent = Number(row.commissionPercent || 0);
      const revenue = Number(row.totalSales || 0);
      const commission = (revenue * commissionPercent) / 100;
      
      return {
        ...row,
        totalRevenue: revenue,
        commission,
        payout: salary + commission,
      };
    });
  }

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

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
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
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: typeof categories.$inferInsert): Promise<Category> {
    const [newCat] = await db.insert(categories).values(category).returning();
    return newCat;
  }

  // Products
  async getProducts(categoryId?: number, search?: string): Promise<(Product & { category: Category })[]> {
    let query = db.select().from(products).innerJoin(categories, eq(products.categoryId, categories.id));
    
    const conditions = [];
    if (categoryId) conditions.push(eq(products.categoryId, categoryId));
    if (search) conditions.push(like(products.name, `%${search}%`));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const results = await query;
    return results.map(r => ({ ...r.products, category: r.categories }));
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

  async transferInventory(userId: string, productId: number, fromBranchId: number, toBranchId: number, quantity: number): Promise<void> {
    await db.transaction(async (tx) => {
      const [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, productId), eq(inventory.branchId, fromBranchId)));
      if (!stock || stock.quantity < quantity) throw new Error("Insufficient stock");

      await tx.insert(inventoryMovements).values({
        productId,
        fromBranchId,
        toBranchId,
        quantity,
        type: 'transfer',
        userId,
      });

      await tx.execute(sql`UPDATE inventory SET quantity = quantity - ${quantity} WHERE id = ${stock.id}`);
      
      const [destStock] = await tx.select().from(inventory).where(and(eq(inventory.productId, productId), eq(inventory.branchId, toBranchId)));
      if (destStock) {
        await tx.execute(sql`UPDATE inventory SET quantity = quantity + ${quantity} WHERE id = ${destStock.id}`);
      } else {
        await tx.insert(inventory).values({ productId, branchId: toBranchId, quantity });
      }
    });
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
      let totalAmount = 0;
      for (const item of input.items) {
        // Step 3.2: Stock check
        const [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, item.productId), eq(inventory.branchId, input.branchId)));
        if (!stock || stock.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }
        totalAmount += (item.price * item.quantity) - item.discount;
      }
      totalAmount -= input.discount;

      const [sale] = await tx.insert(sales).values({
        branchId: input.branchId,
        clientId: input.clientId,
        userId: userId,
        totalAmount: totalAmount.toFixed(2),
        discount: input.discount.toFixed(2),
        paymentMethod: input.paymentMethod,
      }).returning();

      for (const item of input.items) {
        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price.toFixed(2),
          total: ((item.price * item.quantity) - item.discount).toFixed(2),
          discount: item.discount.toFixed(2),
        });

        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          fromBranchId: input.branchId,
          quantity: item.quantity,
          type: 'sale',
          userId: userId,
        });

        await tx.execute(sql`
          UPDATE inventory 
          SET quantity = quantity - ${item.quantity} 
          WHERE product_id = ${item.productId} AND branch_id = ${input.branchId}
        `);

        // Update KPI
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        const itemAmount = (item.price * item.quantity) - item.discount;
        
        const [existingKpi] = await tx.select().from(employeeKpi).where(
          and(eq(employeeKpi.userId, userId), eq(employeeKpi.branchId, input.branchId), eq(employeeKpi.month, month), eq(employeeKpi.year, year))
        );

        if (existingKpi) {
          await tx.update(employeeKpi).set({ totalSales: (Number(existingKpi.totalSales) + itemAmount).toFixed(2), updatedAt: new Date() }).where(eq(employeeKpi.id, existingKpi.id));
        } else {
          await tx.insert(employeeKpi).values({ userId, branchId: input.branchId, month, year, totalSales: itemAmount.toFixed(2) });
        }
      }

      return sale;
    });
  }

  async processReturn(userId: string, saleId: number, reason: string): Promise<SaleReturn> {
    return await db.transaction(async (tx) => {
      // 1. Fetch sale and items
      const [sale] = await tx.select().from(sales).where(eq(sales.id, saleId));
      if (!sale) throw new Error("Sale not found");
      if (sale.status === 'returned') throw new Error("Sale already returned");

      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));

      // 2. Update Sale Status and Recalculate Totals (in this simple TZZ, we mark whole sale as returned)
      await tx.update(sales).set({ status: 'returned' }).where(eq(sales.id, saleId));

      // 3. Log Return
      const [saleReturn] = await tx.insert(saleReturns).values({
        saleId,
        userId,
        reason,
        totalRefunded: sale.totalAmount,
      }).returning();

      // 4. Restore Inventory and Log Movement
      for (const item of items) {
        // Log movement
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          branchId: sale.branchId,
          toBranchId: sale.branchId,
          quantity: item.quantity,
          type: 'return',
          reason: `Return of sale #${saleId}`,
          userId,
        });

        // Restore inventory
        const [existingInventory] = await tx.select()
          .from(inventory)
          .where(and(eq(inventory.productId, item.productId), eq(inventory.branchId, sale.branchId)));

        if (existingInventory) {
          await tx.update(inventory)
            .set({ quantity: sql`${inventory.quantity} + ${item.quantity}` })
            .where(eq(inventory.id, existingInventory.id));
        } else {
          await tx.insert(inventory).values({
            productId: item.productId,
            branchId: sale.branchId,
            quantity: item.quantity,
          });
        }
      }

      return saleReturn;
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
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const dailySales = await db.select({ total: sum(sales.totalAmount) }).from(sales).where(and(gte(sales.createdAt, today), eq(sales.status, 'completed')));
    const totalClients = await db.select({ count: sql<number>`count(*)` }).from(clients);
    const lowStock = await db.select({ count: sql<number>`count(*)` }).from(inventory).where(lte(inventory.quantity, 5));
    
    const totalIncome = await db.select({ total: sum(sales.totalAmount) }).from(sales).where(eq(sales.status, 'completed'));
    const totalExpenses = await db.select({ total: sum(expenses.amount) }).from(expenses);

    return {
      dailySales: Number(dailySales[0]?.total || 0),
      monthlySales: 0,
      totalClients: Number(totalClients[0]?.count || 0),
      lowStockCount: Number(lowStock[0]?.count || 0),
      topProducts: [],
      totalProfit: Number(totalIncome[0]?.total || 0) - Number(totalExpenses[0]?.total || 0),
    };
  }
}

export const storage = new DatabaseStorage();
