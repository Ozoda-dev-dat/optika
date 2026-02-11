import bcrypt from "bcryptjs";
import { 
  users, branches, products, inventory, clients, prescriptions, sales, saleItems, expenses, categories,
  inventoryMovements, saleReturns, employeeKpi, shipments, shipmentItems, auditLogs,
  type User, type Branch, type Product, type Inventory, type Client, type Prescription, type Sale, type SaleItem, type Expense,
  type UpsertUser, type InventoryMovement, type SaleReturn, type EmployeeKpi,
  type SaleInput, type Category, type Shipment, type ShipmentItem, type AuditLog
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
  getSales(options: { startDate?: Date, endDate?: Date, branchId?: number, saleId?: number }): Promise<(Sale & { client: Client | null, user: User, items: (SaleItem & { product: Product })[] })[]>;
  processReturn(userId: string, saleId: number, reason: string): Promise<SaleReturn>;

  // Audit Logs
  getAuditLogs(options: { startDate?: Date, endDate?: Date, branchId?: number }): Promise<(AuditLog & { actor: User })[]>;
  createAuditLog(log: typeof auditLogs.$inferInsert): Promise<AuditLog>;

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

  async getAuditLogs(options: { startDate?: Date, endDate?: Date, branchId?: number }): Promise<(AuditLog & { actor: User })[]> {
    let query = db.select({
      log: auditLogs,
      actor: users
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorUserId, users.id));

    const conditions = [];
    if (options.branchId) conditions.push(eq(auditLogs.branchId, options.branchId));
    if (options.startDate) conditions.push(gte(auditLogs.createdAt, options.startDate));
    if (options.endDate) conditions.push(lte(auditLogs.createdAt, options.endDate));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(auditLogs.createdAt));
    return results.map(r => ({ ...r.log, actor: r.actor }));
  }

  async createAuditLog(log: typeof auditLogs.$inferInsert): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getBranches(): Promise<Branch[]> {
    return await db.select().from(branches);
  }

  async createBranch(branch: typeof branches.$inferInsert): Promise<Branch> {
    const [newBranch] = await db.insert(branches).values(branch).returning();
    return newBranch;
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: typeof categories.$inferInsert): Promise<Category> {
    const [newCat] = await db.insert(categories).values(category).returning();
    return newCat;
  }

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

  async getShipments(branchId?: number): Promise<(Shipment & { fromWarehouse: Branch, toBranch: Branch, items: (ShipmentItem & { product: Product })[] })[]> {
    const allShipments = await db.select().from(shipments).orderBy(desc(shipments.createdAt));
    const result = [];

    for (const ship of allShipments) {
      if (branchId && ship.fromWarehouseId !== branchId && ship.toBranchId !== branchId) continue;

      const [fromBranch] = await db.select().from(branches).where(eq(branches.id, ship.fromWarehouseId));
      const [toBranch] = await db.select().from(branches).where(eq(branches.id, ship.toBranchId));
      const items = await db.select().from(shipmentItems)
        .innerJoin(products, eq(shipmentItems.productId, products.id))
        .where(eq(shipmentItems.shipmentId, ship.id));

      result.push({
        ...ship,
        fromWarehouse: fromBranch,
        toBranch: toBranch,
        items: items.map(i => ({ ...i.shipment_items, product: i.products }))
      });
    }

    return result;
  }

  async createShipment(userId: string, fromWarehouseId: number, toBranchId: number, items: { productId: number, qtySent: number }[]): Promise<Shipment> {
    return await db.transaction(async (tx) => {
      for (const item of items) {
        const [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, item.productId), eq(inventory.branchId, fromWarehouseId)));
        if (!stock || Number(stock.quantity) < item.qtySent) {
          throw new Error(`Insufficient stock in warehouse for product ID ${item.productId}`);
        }

        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} - ${item.qtySent}` })
          .where(eq(inventory.id, stock.id));

        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          branchId: fromWarehouseId,
          fromBranchId: fromWarehouseId,
          toBranchId: toBranchId,
          quantity: -item.qtySent,
          type: 'shipment_sent',
          reason: `Shipment to branch #${toBranchId}`,
          userId,
        });
      }

      const [shipment] = await tx.insert(shipments).values({
        fromWarehouseId,
        toBranchId,
        createdBy: userId,
        status: "pending"
      }).returning();

      for (const item of items) {
        await tx.insert(shipmentItems).values({
          shipmentId: shipment.id,
          productId: item.productId,
          qtySent: item.qtySent,
          qtyReceived: 0
        });
      }

      return shipment;
    });
  }

  async receiveShipment(shipmentId: number, receivedItems: { productId: number, qtyReceived: number }[]): Promise<Shipment> {
    return await db.transaction(async (tx) => {
      const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, shipmentId));
      if (!shipment) throw new Error("Shipment not found");
      if (shipment.status === "received" || shipment.status === "cancelled") throw new Error("Shipment already finalized");

      let allFullyReceived = true;
      let anyReceived = false;

      for (const rItem of receivedItems) {
        const [item] = await tx.select().from(shipmentItems).where(and(eq(shipmentItems.shipmentId, shipmentId), eq(shipmentItems.productId, rItem.productId)));
        if (!item) continue;

        const newQtyReceived = Math.min(item.qtySent, item.qtyReceived + rItem.qtyReceived);
        if (newQtyReceived < item.qtySent) allFullyReceived = false;
        if (newQtyReceived > 0) anyReceived = true;

        await tx.update(shipmentItems)
          .set({ qtyReceived: newQtyReceived })
          .where(eq(shipmentItems.id, item.id));

        const [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, rItem.productId), eq(inventory.branchId, shipment.toBranchId)));
        if (stock) {
          await tx.update(inventory).set({ quantity: sql`${inventory.quantity} + ${rItem.qtyReceived}` }).where(eq(inventory.id, stock.id));
        } else {
          await tx.insert(inventory).values({ productId: rItem.productId, branchId: shipment.toBranchId, quantity: rItem.qtyReceived });
        }

        await tx.insert(inventoryMovements).values({
          productId: rItem.productId,
          branchId: shipment.toBranchId,
          fromBranchId: shipment.fromWarehouseId,
          toBranchId: shipment.toBranchId,
          quantity: rItem.qtyReceived,
          type: 'shipment_received',
          reason: `Received from shipment #${shipmentId}`,
          userId: shipment.createdBy,
        });
      }

      const newStatus = allFullyReceived ? "received" : (anyReceived ? "partially_received" : "pending");
      const [updated] = await tx.update(shipments).set({ status: newStatus }).where(eq(shipments.id, shipmentId)).returning();
      return updated;
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

  async createSale(userId: string, input: SaleInput): Promise<Sale> {
    return await db.transaction(async (tx) => {
      const [branch] = await tx.select().from(branches).where(eq(branches.id, input.branchId));
      if (!branch) throw new Error("Filial topilmadi");

      let subtotal = 0;
      const computedItems = [];

      for (const item of input.items) {
        const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
        if (!product) throw new Error(`Mahsulot topilmadi: ${item.productId}`);

        const [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, item.productId), eq(inventory.branchId, input.branchId)));
        if (!stock || Number(stock.quantity) < item.quantity) {
          throw new Error(`${product.name} uchun omborda yetarli qoldiq yo'q`);
        }

        const price = Number(product.price);
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;

        computedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: price.toString(),
          total: itemTotal.toString(),
        });
      }

      const discountPercent = Number(input.discount || 0);
      if (discountPercent > (branch.discountLimitPercent || 10)) {
        throw new Error(`Chegirma miqdori filial limitidan yuqori (${branch.discountLimitPercent || 10}%)`);
      }

      const discountAmount = (subtotal * discountPercent) / 100;
      const finalTotal = subtotal - discountAmount;

      const [sale] = await tx.insert(sales).values({
        branchId: input.branchId,
        clientId: input.clientId,
        userId: userId,
        totalAmount: finalTotal.toFixed(2),
        discount: discountAmount.toFixed(2),
        paymentMethod: input.paymentMethod,
        status: "completed"
      }).returning();

      for (const item of computedItems) {
        await tx.insert(saleItems).values({
          saleId: sale.id,
          ...item
        });

        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} - ${item.quantity}` })
          .where(and(eq(inventory.productId, item.productId), eq(inventory.branchId, input.branchId)));

        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          branchId: input.branchId,
          quantity: -item.quantity,
          type: "sale",
          reason: `Sotuv #${sale.id}`,
          userId: userId,
        });

        await this.updateProductStatus(item.productId, tx);

        // Update KPI
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        const [existingKpi] = await tx.select().from(employeeKpi).where(
          and(eq(employeeKpi.userId, userId), eq(employeeKpi.branchId, input.branchId), eq(employeeKpi.month, month), eq(employeeKpi.year, year))
        );

        if (existingKpi) {
          await tx.update(employeeKpi).set({ 
            totalSales: (Number(existingKpi.totalSales) + Number(item.total)).toFixed(2), 
            updatedAt: new Date() 
          }).where(eq(employeeKpi.id, existingKpi.id));
        } else {
          await tx.insert(employeeKpi).values({ 
            userId, branchId: input.branchId, month, year, 
            totalSales: Number(item.total).toFixed(2) 
          });
        }
      }

      if (discountAmount > 0) {
        await tx.insert(auditLogs).values({
          actorUserId: userId,
          branchId: input.branchId,
          actionType: "DISCOUNT_APPLIED",
          entityType: "sale",
          entityId: sale.id,
          metadata: JSON.stringify({
            oldTotal: subtotal,
            discountPercent,
            discountAmount,
            newTotal: finalTotal,
            items: input.items.length
          })
        });
      }

      return sale;
    });
  }

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

  async getExpenses(options: { startDate?: Date, endDate?: Date }): Promise<Expense[]> {
     return await db.select().from(expenses).orderBy(desc(expenses.date));
  }

  async createExpense(expense: typeof expenses.$inferInsert): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

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

    const salesTotal = await db.select({ 
      revenue: sum(sales.totalAmount) 
    })
    .from(sales)
    .where(and(gte(sales.createdAt, startDate), eq(sales.status, 'completed')));

    const clientsCount = await db.select({ 
      count: sql<number>`count(*)` 
    })
    .from(clients);

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
}

export const storage = new DatabaseStorage();
