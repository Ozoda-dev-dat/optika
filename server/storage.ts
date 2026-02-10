import { 
  users, branches, products, inventory, clients, prescriptions, sales, saleItems, expenses, categories,
  inventoryMovements, saleReturns, employeeKpi,
  type User, type Branch, type Product, type Inventory, type Client, type Prescription, type Sale, type SaleItem, type Expense,
  type UpsertUser, type InventoryMovement, type SaleReturn, type EmployeeKpi,
  type SaleInput, type Category
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, sql, desc, sum, gte, lte, or } from "drizzle-orm";
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
  adjustInventory(userId: string, productId: number, branchId: number, quantityChange: number, reason: string): Promise<void>;

  // Clients
  getClients(search?: string): Promise<(Client & { totalSpent: number })[]>;
  getClient(id: number): Promise<(Client & { prescriptions: Prescription[], salesHistory: any[], totalSpent: number }) | undefined>;
  createClient(client: typeof clients.$inferInsert): Promise<Client>;
  updateClient(id: number, data: Partial<typeof clients.$inferInsert>): Promise<Client>;
  addPrescription(prescription: typeof prescriptions.$inferInsert): Promise<Prescription>;

  // Sales
  createSale(userId: string, input: SaleInput): Promise<Sale>;
  getSales(options: { startDate?: Date, endDate?: Date, branchId?: number, saleId?: number }): Promise<(Sale & { client: Client | null, user: User, items: (SaleItem & { product: Product })[] })[]>;
  processReturn(userId: string, saleId: number, reason: string): Promise<SaleReturn>;

  // Expenses
  getExpenses(options: { startDate?: Date, endDate?: Date }): Promise<Expense[]>;
  createExpense(expense: typeof expenses.$inferInsert): Promise<Expense>;

  // Reports
  getDashboardStats(): Promise<any>;
  getProfitLoss(range: 'daily' | 'weekly' | 'monthly'): Promise<{ totalRevenue: number; totalExpenses: number; profit: number }>;
  getEmployeeKpi(month: number, year: number): Promise<any[]>;
  getAnalyticsDashboard(range: 'daily' | 'weekly' | 'monthly'): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // ... (existing code)

  async getAnalyticsDashboard(range: 'daily' | 'weekly' | 'monthly'): Promise<any> {
    const now = new Date();
    let startDate = new Date();
    
    if (range === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'weekly') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'monthly') {
      startDate.setMonth(now.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
    }

    // 1. Totals
    const salesTotal = await db.select({ 
      revenue: sum(sales.totalAmount) 
    })
    .from(sales)
    .where(and(gte(sales.createdAt, startDate), eq(sales.status, 'completed')));

    const clientsCount = await db.select({ 
      count: sql<number>`count(*)` 
    })
    .from(clients);

    // 2. Best-selling products (topProducts)
    const bestSelling = await db.select({
      productId: saleItems.productId,
      name: products.name,
      quantity: sum(saleItems.quantity),
      revenue: sum(saleItems.total)
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.createdAt, startDate), eq(sales.status, 'completed')))
    .groupBy(saleItems.productId, products.name)
    .orderBy(desc(sql`sum(${saleItems.quantity})`))
    .limit(5);

    // 3. Low-stock products (threshold=10)
    const lowStock = await db.select({
      productId: products.id,
      name: products.name,
      quantity: sum(inventory.quantity)
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .groupBy(products.id, products.name)
    .having(sql`sum(${inventory.quantity}) < 10`)
    .limit(10);

    // 4. Top employees
    const topEmployees = await db.select({
      userId: sales.userId,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      revenue: sum(sales.totalAmount)
    })
    .from(sales)
    .innerJoin(users, eq(sales.userId, users.id))
    .where(and(gte(sales.createdAt, startDate), eq(sales.status, 'completed')))
    .groupBy(sales.userId, users.username, users.firstName, users.lastName)
    .orderBy(desc(sql`sum(${sales.totalAmount})`))
    .limit(5);

    // 5. Top branches
    const topBranches = await db.select({
      branchId: sales.branchId,
      name: branches.name,
      revenue: sum(sales.totalAmount)
    })
    .from(sales)
    .innerJoin(branches, eq(sales.branchId, branches.id))
    .where(and(gte(sales.createdAt, startDate), eq(sales.status, 'completed')))
    .groupBy(sales.branchId, branches.name)
    .orderBy(desc(sql`sum(${sales.totalAmount})`))
    .limit(5);

    // 6. Slow-moving products (lowest quantity sold in range)
    const slowMoving = await db.select({
      productId: products.id,
      name: products.name,
      soldQuantity: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)`
    })
    .from(products)
    .leftJoin(saleItems, eq(products.id, saleItems.productId))
    .leftJoin(sales, and(eq(saleItems.saleId, sales.id), gte(sales.createdAt, startDate), eq(sales.status, 'completed')))
    .groupBy(products.id, products.name)
    .orderBy(sql`COALESCE(SUM(${saleItems.quantity}), 0) ASC`)
    .limit(5);

    // 7. Stale products (NOT sold in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const staleProducts = await db.select({
      productId: products.id,
      name: products.name,
      lastSaleDate: sql<string>`MAX(${sales.createdAt})`
    })
    .from(products)
    .leftJoin(saleItems, eq(products.id, saleItems.productId))
    .leftJoin(sales, and(eq(saleItems.saleId, sales.id), eq(sales.status, 'completed')))
    .groupBy(products.id, products.name)
    .having(or(
      sql`MAX(${sales.createdAt}) < ${thirtyDaysAgo}`,
      sql`MAX(${sales.createdAt}) IS NULL`
    ))
    .limit(10);

    return {
      range,
      totals: {
        salesTotal: Number(salesTotal[0]?.revenue || 0),
        totalClients: Number(clientsCount[0]?.count || 0)
      },
      topProducts: bestSelling.map(p => ({
        id: p.productId,
        name: p.name,
        quantitySold: Number(p.quantity || 0),
        revenue: Number(p.revenue || 0)
      })),
      slowMovingProducts: slowMoving.map(p => ({
        productId: p.productId,
        name: p.name,
        soldQuantity: Number(p.soldQuantity)
      })),
      staleProducts: staleProducts.map(p => ({
        productId: p.productId,
        name: p.name,
        daysSinceLastSale: p.lastSaleDate ? Math.floor((now.getTime() - new Date(p.lastSaleDate).getTime()) / (1000 * 60 * 60 * 24)) : null
      })),
      lowStockProducts: lowStock.map(p => ({
        id: p.productId,
        name: p.name,
        currentQuantity: Number(p.quantity || 0)
      })),
      topEmployees: topEmployees.map(e => ({
        id: e.userId,
        name: `${e.firstName} ${e.lastName}`,
        revenue: Number(e.revenue || 0)
      })),
      topBranches: topBranches.map(b => ({
        id: b.branchId,
        name: b.name,
        revenue: Number(b.revenue || 0)
      }))
    };
  }
  
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
    if (quantity <= 0) throw new Error("Quantity must be positive");
    
    await db.transaction(async (tx) => {
      // 1. Check source stock
      const [sourceStock] = await tx.select().from(inventory).where(and(eq(inventory.productId, productId), eq(inventory.branchId, fromBranchId)));
      if (!sourceStock || Number(sourceStock.quantity) < quantity) {
        throw new Error("Insufficient stock in source branch");
      }

      // 2. Decrement source
      await tx.update(inventory)
        .set({ quantity: sql`${inventory.quantity} - ${quantity}` })
        .where(eq(inventory.id, sourceStock.id));

      // 3. Log source movement
      await tx.insert(inventoryMovements).values({
        productId,
        branchId: fromBranchId,
        fromBranchId,
        toBranchId,
        quantity: -quantity,
        type: 'transfer',
        reason: `Transfer to branch #${toBranchId}`,
        userId,
      });

      // 4. Increment destination
      const [destStock] = await tx.select().from(inventory).where(and(eq(inventory.productId, productId), eq(inventory.branchId, toBranchId)));
      if (destStock) {
        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} + ${quantity}` })
          .where(eq(inventory.id, destStock.id));
      } else {
        await tx.insert(inventory).values({ productId, branchId: toBranchId, quantity });
      }

      // 5. Log destination movement
      await tx.insert(inventoryMovements).values({
        productId,
        branchId: toBranchId,
        fromBranchId,
        toBranchId,
        quantity: quantity,
        type: 'transfer',
        reason: `Transfer from branch #${fromBranchId}`,
        userId,
      });

      await this.updateProductStatus(productId, tx);
    });
  }

  async adjustInventory(userId: string, productId: number, branchId: number, quantityChange: number, reason: string): Promise<void> {
    if (quantityChange === 0) return;

    await db.transaction(async (tx) => {
      const [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, productId), eq(inventory.branchId, branchId)));
      
      if (quantityChange < 0) {
        const absChange = Math.abs(quantityChange);
        if (!stock || Number(stock.quantity) < absChange) {
          throw new Error("Insufficient stock for negative adjustment");
        }
      }

      if (stock) {
        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} + ${quantityChange}` })
          .where(eq(inventory.id, stock.id));
      } else {
        if (quantityChange < 0) throw new Error("Cannot decrease non-existent stock");
        await tx.insert(inventory).values({ productId, branchId, quantity: quantityChange });
      }

      await tx.insert(inventoryMovements).values({
        productId,
        branchId,
        quantity: quantityChange,
        type: 'adjustment',
        reason,
        userId,
      });

      await this.updateProductStatus(productId, tx);
    });
  }

  // Clients
  async getClients(search?: string): Promise<(Client & { totalSpent: number })[]> {
    const clientsQuery = db.select({
      client: clients,
      totalSpent: sql<number>`COALESCE(SUM(CASE WHEN ${sales.status} = 'completed' THEN ${sales.totalAmount} ELSE 0 END), 0)`
    })
    .from(clients)
    .leftJoin(sales, eq(clients.id, sales.clientId))
    .groupBy(clients.id);

    const results = await (search 
      ? clientsQuery.where(like(clients.firstName, `%${search}%`))
      : clientsQuery);

    return results.map(r => ({
      ...r.client,
      totalSpent: Number(r.totalSpent)
    }));
  }

  async getClient(id: number): Promise<(Client & { prescriptions: Prescription[], salesHistory: any[], totalSpent: number }) | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) return undefined;
    
    const clientPrescriptions = await db.select().from(prescriptions).where(eq(prescriptions.clientId, id)).orderBy(desc(prescriptions.date));
    
    const clientSales = await db.select({
      saleId: sales.id,
      date: sales.createdAt,
      totalAmount: sales.totalAmount,
      paymentMethod: sales.paymentMethod,
      status: sales.status
    })
    .from(sales)
    .where(eq(sales.clientId, id))
    .orderBy(desc(sales.createdAt));

    const totalSpent = clientSales
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);

    return { 
      ...client, 
      prescriptions: clientPrescriptions,
      salesHistory: clientSales,
      totalSpent
    };
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

  async updateProductStatus(productId: number, tx: any): Promise<void> {
    const [totalStock] = await tx.select({
      total: sql<number>`sum(${inventory.quantity})`
    })
    .from(inventory)
    .where(eq(inventory.productId, productId));

    const total = Number(totalStock?.total || 0);
    const newStatus = total <= 0 ? 'sold' : 'in_stock';
    
    await tx.update(products)
      .set({ status: newStatus })
      .where(eq(products.id, productId));
  }

  // Sales
  async createSale(userId: string, input: SaleInput): Promise<Sale> {
    return await db.transaction(async (tx) => {
      let totalAmount = 0;
      const computedItems = [];

      for (const item of input.items) {
        // Fetch product for pricing and stock check
        const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        const [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, item.productId), eq(inventory.branchId, input.branchId)));
        if (!stock || Number(stock.quantity) < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}`);
        }

        const unitPrice = Number(product.price);
        const itemSubtotal = (unitPrice * item.quantity) - item.discount;
        totalAmount += itemSubtotal;

        computedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPrice,
          total: itemSubtotal,
          discount: item.discount
        });
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

      for (const item of computedItems) {
        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.unitPrice.toFixed(2),
          total: item.total.toFixed(2),
          discount: item.discount.toFixed(2),
        });

        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          branchId: input.branchId,
          fromBranchId: input.branchId,
          quantity: -item.quantity,
          type: 'sale',
          reason: `Sale #${sale.id}`,
          userId: userId,
        });

        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} - ${item.quantity}` })
          .where(eq(inventory.productId, item.productId))
          .where(eq(inventory.branchId, input.branchId));

        await this.updateProductStatus(item.productId, tx);

        // Update KPI
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        
        const [existingKpi] = await tx.select().from(employeeKpi).where(
          and(eq(employeeKpi.userId, userId), eq(employeeKpi.branchId, input.branchId), eq(employeeKpi.month, month), eq(employeeKpi.year, year))
        );

        if (existingKpi) {
          await tx.update(employeeKpi).set({ totalSales: (Number(existingKpi.totalSales) + item.total).toFixed(2), updatedAt: new Date() }).where(eq(employeeKpi.id, existingKpi.id));
        } else {
          await tx.insert(employeeKpi).values({ userId, branchId: input.branchId, month, year, totalSales: item.total.toFixed(2) });
        }
      }

      return sale;
    });
  }

  // TODO: Cleanup migration for saleReturns and saleReturnItems tables
  async processReturn(userId: string, saleId: number, reason: string): Promise<SaleReturn> {
    throw new Error("Returns are not supported.");
  }

  async getSales(options: { startDate?: Date, endDate?: Date, branchId?: number, saleId?: number }): Promise<(Sale & { client: Client | null, user: User, items: (SaleItem & { product: Product })[] })[]> {
    const conditions = [];
    if (options.startDate) conditions.push(gte(sales.createdAt, options.startDate));
    if (options.endDate) conditions.push(lte(sales.createdAt, options.endDate));
    if (options.branchId) conditions.push(eq(sales.branchId, options.branchId));
    if (options.saleId) conditions.push(eq(sales.id, options.saleId));

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

  async getProfitLoss(range: 'daily' | 'weekly' | 'monthly'): Promise<{ totalRevenue: number; totalExpenses: number; profit: number }> {
    const now = new Date();
    let startDate = new Date();
    
    if (range === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'weekly') {
      startDate.setDate(now.getDate() - 7);
    } else if (range === 'monthly') {
      startDate.setMonth(now.getMonth() - 1);
    }

    const salesTotal = await db.select({ revenue: sum(sales.totalAmount) })
      .from(sales)
      .where(and(gte(sales.createdAt, startDate), eq(sales.status, 'completed')));

    const expenseTotal = await db.select({ amount: sum(expenses.amount) })
      .from(expenses)
      .where(gte(expenses.date, startDate));

    const revenue = Number(salesTotal[0]?.revenue || 0);
    const expenses_amt = Number(expenseTotal[0]?.amount || 0);

    return {
      totalRevenue: revenue,
      totalExpenses: expenses_amt,
      profit: revenue - expenses_amt
    };
  }
}

export const storage = new DatabaseStorage();
