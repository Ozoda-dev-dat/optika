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

  // Dashboard & Analytics
  getDashboardStats(): Promise<any>;
  getEmployeeKpi(month: number, year: number): Promise<any[]>;
  getAnalyticsDashboard(range: 'daily' | 'weekly' | 'monthly'): Promise<any>;
  getProfitLoss(range: 'daily' | 'weekly' | 'monthly'): Promise<{ totalRevenue: number; totalExpenses: number; profit: number }>;
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
          updatedAt: getCurrentTimestamp(),
        },
      })
      .returning();
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getAuditLogs(options: { 
    startDate?: Date, 
    endDate?: Date, 
    branchId?: number,
    actionType?: string,
    entityType?: string,
    offset?: number,
    limit?: number
  }): Promise<(AuditLog & { actor: User })[]> {
    let query = db.select({
      log: auditLogs,
      actor: users
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorUserId, users.id));

    const conditions = [];
    if (options.branchId) conditions.push(eq(auditLogs.branchId, options.branchId));
    if (options.actionType) conditions.push(eq(auditLogs.actionType, options.actionType));
    if (options.entityType) conditions.push(eq(auditLogs.entityType, options.entityType));
    if (options.startDate) conditions.push(gte(auditLogs.createdAt, options.startDate));
    if (options.endDate) conditions.push(lte(auditLogs.createdAt, options.endDate));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const results = await query
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map(r => ({ ...r.log, actor: r.actor }));
  }

  async createAuditLog(log: typeof auditLogs.$inferInsert): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  // Helper function to create audit logs with user information
  private async createAuditLogWithUser(
    actionType: string,
    entityType: string,
    entityId: number,
    userId: string,
    branchId?: number,
    metadata?: any,
    oldValues?: any,
    newValues?: any
  ): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const userData = user[0] ? {
      username: user[0].username,
      role: user[0].role,
      email: user[0].email
    } : null;

    await this.createAuditLog({
      actorUserId: userId,
      branchId,
      actionType,
      entityType,
      entityId,
      metadata: JSON.stringify({
        ...metadata,
        userData,
        oldValues,
        newValues,
        timestamp: getCurrentTimestamp()
      })
    });
  }

  async getBranches(): Promise<Branch[]> {
    return await db.select().from(branches);
  }

  async createBranch(branch: typeof branches.$inferInsert): Promise<Branch> {
    const [newBranch] = await db.insert(branches).values(branch).returning();
    return newBranch;
  }

  async getWarehouseBranch(): Promise<Branch | undefined> {
    const [warehouse] = await db.select().from(branches).where(eq(branches.isWarehouse, true));
    return warehouse;
  }

  async getWarehouseBranchId(): Promise<number | undefined> {
    const warehouse = await this.getWarehouseBranch();
    return warehouse?.id;
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: typeof categories.$inferInsert): Promise<Category> {
    const [newCat] = await db.insert(categories).values(category).returning();
    return newCat;
  }

  async getProducts(categoryId?: number, search?: string): Promise<(Product & { category: Category })[]>;
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
    
    // Log product creation
    await this.createAuditLogWithUser(
      'PRODUCT_CREATED',
      'product',
      newProduct.id,
      product.createdBy || 'system',
      undefined, // Product doesn't have branch
      {
        productData: {
          name: product.name,
          categoryId: product.categoryId,
          price: product.price,
          costPrice: product.costPrice,
          unit: product.unit,
          minStock: product.minStock
        }
      },
      null,
      newValues: newProduct
    );
    
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

  async updateInventory(productId: number, branchId: number, quantityChange: number, context: "WAREHOUSE_ADJUST" | "SHIPMENT_RECEIVE" | "SALE" | "SEED" = "WAREHOUSE_ADJUST"): Promise<void> {
    const warehouseId = await this.getWarehouseBranchId();
    
    return await db.transaction(async (tx) => {
      // Get current inventory
      const [currentInventory] = await tx
        .select()
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .where(and(eq(inventory.productId, productId), eq(inventory.branchId, branchId)))
        .limit(1);

      if (!currentInventory || currentInventory.length === 0) {
        throw new Error("Inventory not found");
      }

      const currentQty = Number(currentInventory[0].quantity);
      const newQty = currentQty + quantityChange;

      // Update inventory
      await tx
        .update(inventory)
        .set({ quantity: newQty })
        .where(and(eq(inventory.productId, productId), eq(inventory.branchId, branchId)));

      // Check for low stock after sale or writeoff
      if (context === "SALE" || context === "SEED") {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);

        if (product && product.length > 0) {
          const minStock = product[0].minStock || 0;
          
          if (newQty < minStock) {
            await tx.insert(auditLogs).values({
              actorUserId: "system", // Could be passed as parameter if needed
              branchId: branchId,
              actionType: "LOW_STOCK",
              entityType: "product",
              entityId: productId,
              metadata: JSON.stringify({
                currentQuantity: newQty,
                minStock: minStock,
                context: context,
                previousQuantity: currentQty,
                quantityChange: quantityChange
              })
            });
          }
        }
      }

      // Create inventory movement record
      await tx.insert(inventoryMovements).values({
        productId: productId,
        branchId: branchId,
        quantity: quantityChange,
        type: context,
        reason: `Inventory ${context}`,
        userId: "system", // Could be passed as parameter if needed
      });
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
    const warehouse = await this.getWarehouseBranch();
    if (!warehouse) throw new Error("Markaziy ombor topilmadi. Tizim sozlamalarini tekshiring.");
    const actualFromWarehouseId = warehouse.id;

    if (toBranchId === actualFromWarehouseId) {
      throw new Error("Omborning o'ziga jo'natma yuborib bo'lmaydi.");
    }

    return await db.transaction(async (tx) => {
      for (const item of items) {
        const [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, item.productId), eq(inventory.branchId, actualFromWarehouseId)));
        if (!stock || Number(stock.quantity) < item.qtySent) {
          throw new Error(`Omborda mahsulot ID ${item.productId} uchun yetarli qoldiq yo'q`);
        }

        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} - ${item.qtySent}` })
          .where(eq(inventory.id, stock.id));

        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          branchId: actualFromWarehouseId,
          fromBranchId: actualFromWarehouseId,
          toBranchId: toBranchId,
          quantity: -item.qtySent,
          type: 'shipment_sent',
          reason: `Filialga jo'natma #${toBranchId}`,
          userId,
        });
      }

      const [shipment] = await tx.insert(shipments).values({
        fromWarehouseId: actualFromWarehouseId,
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

      await tx.insert(auditLogs).values({
        actorUserId: userId,
        branchId: actualFromWarehouseId,
        actionType: "SHIPMENT_CREATED",
        entityType: "shipment",
        entityId: shipment.id,
        metadata: JSON.stringify({ toBranchId, itemCount: items.length })
      });

      return shipment;
    });
  }

  async receiveShipment(shipmentId: number, receivedItems: { productId: number, qtyReceived: number }[], requestId: string, actorUserId: string): Promise<Shipment> {
    return await db.transaction(async (tx) => {
      // Check for idempotency
      const [existingOp] = await tx.select().from(shipmentReceiveOps).where(and(
        eq(shipmentReceiveOps.shipmentId, shipmentId),
        eq(shipmentReceiveOps.requestId, requestId)
      ));
      if (existingOp) {
        const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, shipmentId));
        return shipment;
      }

      const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, shipmentId));
      if (!shipment) throw new Error("Jo'natma topilmadi");
      if (shipment.status === "received" || shipment.status === "cancelled") {
        throw new Error("Jo'natma yakunlangan yoki bekor qilingan");
      }

      const currentShipmentItems = await tx.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));

      for (const shipItem of currentShipmentItems) {
        const update = receivedItems.find(r => r.productId === shipItem.productId);
        const incomingQty = update ? update.qtyReceived : 0;
        if (incomingQty <= 0) continue;

        const remainingToReceive = shipItem.qtySent - shipItem.qtyReceived;
        if (incomingQty > remainingToReceive) {
          throw new Error(`Mahsulot (ID: ${shipItem.productId}) uchun yuborilgan miqdordan ko'p qabul qilib bo'lmaydi.`);
        }

        const newTotalReceived = shipItem.qtyReceived + incomingQty;
        await tx.update(shipmentItems).set({ qtyReceived: newTotalReceived }).where(eq(shipmentItems.id, shipItem.id));
        await this.updateInventory(shipItem.productId, shipment.toBranchId, incomingQty, "SHIPMENT_RECEIVE");

        await tx.insert(inventoryMovements).values({
          productId: shipItem.productId,
          branchId: shipment.toBranchId,
          fromBranchId: shipment.fromWarehouseId,
          toBranchId: shipment.toBranchId,
          quantity: incomingQty,
          type: 'shipment_received',
          reason: `Jo'natma #${shipmentId} qabul qilindi (Req: ${requestId})`,
          userId: actorUserId,
        });
      }

      const updatedItems = await tx.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));
      const allFullyReceived = updatedItems.every(i => i.qtyReceived >= i.qtySent);
      const anyReceived = updatedItems.some(i => i.qtyReceived > 0);

      const newStatus = allFullyReceived ? "received" : (anyReceived ? "partially_received" : "pending");
      const [updated] = await tx.update(shipments).set({ status: newStatus }).where(eq(shipments.id, shipmentId)).returning();

      await tx.insert(shipmentReceiveOps).values({ shipmentId, requestId, actorUserId });

      await this.createAuditLog({
        actorUserId,
        branchId: shipment.toBranchId,
        actionType: "SHIPMENT_RECEIVED",
        entityType: "shipment",
        entityId: shipment.id,
        metadata: JSON.stringify({ requestId, receivedItems })
      });
      
      return updated;
    });
  }

  async adjustInventory(userId: string, productId: number, branchId: number, quantityChange: number, reason: string): Promise<void> {
    if (quantityChange === 0) return;

    const warehouseId = await this.getWarehouseBranchId();
    if (branchId !== warehouseId) {
      throw new Error("Ombor hisobidan tashqari to'g'ridan-to'g'ri inventarizatsiya qilish taqiqlanadi.");
    }

    await db.transaction(async (tx) => {
      await this.updateInventory(productId, branchId, quantityChange, "WAREHOUSE_ADJUST");

      await tx.insert(inventoryMovements).values({
        productId,
        branchId,
        quantity: quantityChange,
        type: 'adjustment',
        reason,
        userId,
      });

      await tx.insert(auditLogs).values({
        actorUserId: userId,
        branchId: branchId,
        actionType: "INVENTORY_ADJUSTED",
        entityType: "product",
        entityId: productId,
        metadata: JSON.stringify({ quantityChange, reason })
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

  async getSale(id: number): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, id));
    return sale;
  }

  async updateSaleStatus(id: number, status: string, userId?: string): Promise<Sale> {
    // Get current sale for audit
    const [currentSale] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
    
    const [updated] = await db.update(sales).set({ status }).where(eq(sales.id, id)).returning();
    
    // Log status change
    if (currentSale && currentSale[0]) {
      await this.createAuditLogWithUser(
        `SALE_${status.toUpperCase()}`,
        'sale',
        id,
        userId || 'system',
        currentSale[0].branchId,
        {
          oldStatus: currentSale[0].status,
          newStatus: status
        },
        { status: currentSale[0].status },
        newValues: updated[0]
      );
    }
    
    return updated[0];
  }

  async isMonthClosed(branchId: number, month: number, year: number): Promise<boolean> {
    const [closure] = await db.select().from(monthlyClosures).where(and(
      eq(monthlyClosures.branchId, branchId),
      eq(monthlyClosures.month, month),
      eq(monthlyClosures.year, year)
    ));
    return !!closure;
  }

  async closeMonth(branchId: number, month: number, year: number, userId: string): Promise<MonthlyClosure> {
    const [closure] = await db.insert(monthlyClosures).values({
      branchId,
      month,
      year,
      closedBy: userId,
    }).returning();
    return closure;
  }

  // === VALIDATION METHODS FOR STRICT DOMAIN RULES ===

  private validateSaleStatusTransition(currentStatus: string, newStatus: string, userRole: string): boolean {
    // Sales role restrictions
    if (userRole === 'sales') {
      // Sales can only create/update draft sales
      if (newStatus === 'completed' || newStatus === 'cancelled') {
        return false;
      }
      // Sales can only cancel draft sales
      if (newStatus === 'cancelled' && currentStatus !== 'draft') {
        return false;
      }
      // Sales cannot modify completed sales
      if (currentStatus === 'completed' && newStatus !== 'cancelled') {
        return false;
      }
    }

    // Manager/Admin can do anything (for now - TZ rules can be added later)
    return true;
  }

  private async validateClientRequirementForCategory(categoryId: number, clientId?: number): Promise<void> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category || !category.length) {
      return; // Category not found - let other validation handle this
    }

    const categoryName = category[0].name.toLowerCase();
    
    // Check if this category requires a client
    if (['lenses', 'contact_lenses', 'prescription_glasses', 'medical_devices'].includes(categoryName) && !clientId) {
      throw new Error(`Client ID is required for ${categoryName} sales`);
    }
  }

  private async validateSalePayments(saleId: number): Promise<void> {
    const payments = await db
      .select()
      .from(salesPayments)
      .where(eq(salesPayments.saleId, saleId));

    const [sale] = await db
      .select()
      .from(sales)
      .where(eq(sales.id, saleId))
      .limit(1);

    if (!sale || !sale.length) {
      throw new Error("Sale not found");
    }

    if (sale[0].status === 'completed') {
      // For completed sales: must have at least 1 payment
      if (!payments || payments.length === 0) {
        throw new Error("Completed sales must have at least one payment record");
      }

      // Sum of payments must equal total amount
      const totalPayments = payments.reduce((sum, payment) => 
        sum + Number(payment.amount), 0
      );

      const saleTotal = Number(sale[0].totalAmount);
      if (Math.abs(totalPayments - saleTotal) > 0.01) { // Allow for floating point precision
        throw new Error(`Payment total (${totalPayments}) must equal sale total (${saleTotal})`);
      }
    }
  }

  async createSale(userId: string, input: SaleInput): Promise<sale> {
    if (!input.items || input.items.length === 0) {
      throw new Error("Sotuvda kamida bitta mahsulot bo'lishi kerak");
    }

    // Get user role for validation
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const userRole = user[0]?.role || 'sales'; // Default to sales role for safety

    // Validate client requirement for categories
    for (const item of input.items) {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (product && product.length > 0) {
        await this.validateClientRequirementForCategory(product[0].categoryId, input.clientId);
      }
    }

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
          throw new Error(`${product.name} uchun omborda yetarli qoldiq yo'q (Current stock: ${stock.quantity}, Requested: ${item.quantity})`);
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
        status: "draft" // Start as draft, will be completed after validation
      }).returning();

      // Validate and process payments
      let totalPayments = 0;
      if (input.payments && input.payments.length > 0) {
        // Prevent duplicate payment methods (merge if same method used multiple times)
        const paymentMethods = new Map<string, number>();
        for (const payment of input.payments) {
          const amount = parseFloat(payment.amount);
          if (isNaN(amount) || amount <= 0) {
            throw new Error("To'lov miqdori musbat bo'lishi kerak va manfiy bo'lishi mumkin emas");
          }
          
          // Merge payments with same method
          const existingAmount = paymentMethods.get(payment.method) || 0;
          paymentMethods.set(payment.method, existingAmount + amount);
        }
        
        // Convert merged payments back to array
        const mergedPayments = Array.from(paymentMethods.entries()).map(([method, amount]) => ({
          method,
          amount: amount.toFixed(2)
        }));
        
        // Validate total with consistent decimal rounding (2 decimal places)
        totalPayments = mergedPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        
        // Use consistent rounding strategy - round to 2 decimal places
        const roundedTotal = Math.round(finalTotal * 100) / 100;
        const roundedPayments = Math.round(totalPayments * 100) / 100;
        
        // Check if total payments match sale total with proper rounding
        if (Math.abs(roundedPayments - roundedTotal) > 0.01) {
          throw new Error(`To'lovlar yig'indisi (${roundedPayments.toFixed(2)}) sotish summasiga (${roundedTotal.toFixed(2)}) teng emas`);
        }

        // Create payment records for merged payments
        for (const payment of mergedPayments) {
          await this.createSalesPayment({
            saleId: sale.id,
            method: payment.method,
            amount: payment.amount
          });
        }
      } else if (input.paymentMethod) {
        // Single payment method (backward compatibility)
        await this.createSalesPayment({
          saleId: sale.id,
          method: input.paymentMethod,
          amount: finalTotal.toFixed(2)
        });
      } else {
        throw new Error("Kamida bitta to'lov usuli bo'lishi kerak");
      }

      // Create sale items
      for (const item of computedItems) {
        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          discount: "0"
        });
      }

      // Update inventory
      for (const item of input.items) {
        await this.updateInventory(item.productId, input.branchId, -item.quantity, "SALE");
      }

      // Complete the sale if everything is valid
      await tx.update(sales)
        .set({ status: "completed" })
        .where(eq(sales.id, sale.id));

      // Validate final sale state
      await this.validateSalePayments(sale.id);

      return sale;
        });

        await this.updateInventory(item.productId, input.branchId, -item.quantity, "SALE");

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
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const [existingKpi] = await tx.select().from(employeeKpi).where(
          and(eq(employeeKpi.userId, userId), eq(employeeKpi.branchId, input.branchId), eq(employeeKpi.month, month), eq(employeeKpi.year, year))
        );

        if (existingKpi) {
          await tx.update(employeeKpi).set({ 
            totalSales: (Number(existingKpi.totalSales) + Number(item.total)).toFixed(2), 
            updatedAt: getCurrentTimestamp() 
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

      await tx.insert(auditLogs).values({
        actorUserId: userId,
        branchId: input.branchId,
        actionType: "SALE_CREATED",
        entityType: "sale",
        entityId: sale.id,
        metadata: JSON.stringify({ totalAmount: finalTotal.toFixed(2) })
      });

      return sale;
    });
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
        items: items.map(i => ({ ...i.sale_items, product: i.products }))
      });
    }

    return result;
  }

  async getExpenses(options: { startDate?: Date, endDate?: Date }): Promise<Expense[]> {
    const conditions = [];
    if (options.startDate) conditions.push(gte(expenses.date, options.startDate));
    if (options.endDate) conditions.push(lte(expenses.date, options.endDate));

    let query = db.select().from(expenses).orderBy(desc(expenses.date));
    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    return await query;
  }

  async createExpense(expense: typeof expenses.$inferInsert): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  async getDashboardStats(): Promise<any> {
    const now = new Date();
    const startOfMonth = getLocalStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const startOfDay = getLocalStartOfDay(now);

    const [dailySales] = await db.select({ total: sum(sales.totalAmount) }).from(sales).where(and(eq(sales.status, 'completed'), gte(sales.createdAt, startOfDay)));
    const [monthlySales] = await db.select({ total: sum(sales.totalAmount) }).from(sales).where(and(eq(sales.status, 'completed'), gte(sales.createdAt, startOfMonth)));
    const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(clients);
    
    const lowStock = await db
      .select({
        inventory: inventory,
        product: products
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(lte(inventory.quantity, products.minStock))
      .limit(10);
    
    return {
      dailySales: Number(dailySales?.total || 0),
      monthlySales: Number(monthlySales?.total || 0),
      totalClients: Number(clientCount?.count || 0),
      lowStockCount: lowStock.length,
      totalProfit: Number(monthlySales?.total || 0) * 0.3, // Placeholder
      topProducts: []
    };
  }

  async getProfitLoss(range: 'daily' | 'weekly' | 'monthly'): Promise<{ totalRevenue: number; totalExpenses: number; writeoffLoss: number; profit: number }> {
    const now = new Date();
    let startDate = new Date();
    if (range === 'daily') startDate = getLocalStartOfDay(now);
    else if (range === 'weekly') startDate.setDate(now.getDate() - 7);
    else startDate = getLocalStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

    const [revenue] = await db.select({ total: sum(sales.totalAmount) }).from(sales).where(and(eq(sales.status, 'completed'), gte(sales.createdAt, startDate)));
    const [expenseSum] = await db.select({ total: sum(expenses.amount) }).from(expenses).where(gte(expenses.date, startDate));
    
    // Calculate writeoff losses (quantity * costPrice)
    const writeoffLosses = await db
      .select({
        totalLoss: sum(sql<number>`(${stockAdjustments.quantity} * ${products.costPrice})`)
      })
      .from(stockAdjustments)
      .innerJoin(products, eq(stockAdjustments.productId, products.id))
      .where(and(
        eq(stockAdjustments.status, 'approved'),
        eq(stockAdjustments.type, 'writeoff'),
        gte(stockAdjustments.approvedAt, startDate)
      ));

    const totalRevenue = Number(revenue?.total || 0);
    const totalExpenses = Number(expenseSum?.total || 0);
    const writeoffLoss = Number(writeoffLosses?.totalLoss || 0);

    return {
      totalRevenue,
      totalExpenses,
      writeoffLoss,
      profit: totalRevenue - totalExpenses - writeoffLoss
    };
  }

  async createPriceHistory(entry: typeof priceHistory.$inferInsert): Promise<PriceHistory> {
    const [newEntry] = await db.insert(priceHistory).values(entry).returning();
    return newEntry;
  }

  async getPriceHistory(productId: number): Promise<(PriceHistory & { changedByUser: User })[]> {
    const history = await db
      .select({
        history: priceHistory,
        changedByUser: users
      })
      .from(priceHistory)
      .innerJoin(users, eq(priceHistory.changedByUserId, users.id))
      .where(eq(priceHistory.productId, productId))
      .orderBy(desc(priceHistory.changedAt));

    return history.map(h => ({ ...h.history, changedByUser: h.changedByUser }));
  }

  async getSalesPayments(saleId: number): Promise<SalesPayment[]> {
    return await db.select().from(salesPayments).where(eq(salesPayments.saleId, saleId)).orderBy(desc(salesPayments.createdAt));
  }

  async createSalesPayment(payment: typeof salesPayments.$inferInsert): Promise<SalesPayment> {
    const [newPayment] = await db.insert(salesPayments).values(payment).returning();
    

    const [sale] = await db.select().from(sales).where(eq(sales.id, payment.saleId)).limit(1);
    

    await this.createAuditLogWithUser(
      'PAYMENT_CREATED',
      'payment',
      newPayment.id,
      'system', 
      sale?.branchId,
      {
        paymentData: {
          saleId: payment.saleId,
          method: payment.method,
          amount: payment.amount
        }
      },
      null,
      newValues: newPayment
    );
    
    return newPayment;
  }

  async createStockAdjustment(adjustment: typeof stockAdjustments.$inferInsert): Promise<StockAdjustment> {
    const [newAdjustment] = await db.insert(stockAdjustments).values(adjustment).returning();
    
    await this.createAuditLogWithUser(
      'STOCK_ADJUSTMENT_CREATED',
      'stock_adjustment',
      newAdjustment.id,
      adjustment.createdBy || 'system',
      adjustment.branchId,
      {
        adjustmentData: {
          productId: adjustment.productId,
          quantity: adjustment.quantity,
          type: adjustment.type,
          reason: adjustment.reason
        }
      },
      null,
      newValues: newAdjustment
    );
    
    return newAdjustment;
  }

  async createDefectiveAdjustment(productId: number, branchId: number, quantity: number, reason: string, userId: string): Promise<StockAdjustment> {
    return await db.transaction(async (tx) => {

      const [adjustment] = await tx.insert(stockAdjustments).values({
        productId,
        branchId,
        quantity: -Math.abs(quantity), 
        type: 'defective',
        status: 'pending',
        reason: reason || `Defective items: ${reason}`,
        createdBy: userId
      }).returning();

      return adjustment[0];
    });
  }

  async getStockAdjustments(branchId?: number, status?: string): Promise<(StockAdjustment & { 
    branch: Branch, 
    product: Product, 
    createdByUser: User, 
    approvedByUser: User | null 
  })[]> {
    let query = db
      .select({
        adjustment: stockAdjustments,
        branch: branches,
        product: products,
        createdByUser: users,
        approvedByUser: users
      })
      .from(stockAdjustments)
      .innerJoin(branches, eq(stockAdjustments.branchId, branches.id))
      .innerJoin(products, eq(stockAdjustments.productId, products.id))
      .innerJoin(users, eq(stockAdjustments.createdBy, users.id))
      .leftJoin(users, eq(stockAdjustments.approvedBy, users.id));

    const conditions = [];
    if (branchId) conditions.push(eq(stockAdjustments.branchId, branchId));
    if (status) conditions.push(eq(stockAdjustments.status, status));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(stockAdjustments.createdAt));
    
    return results.map(r => ({ 
      ...r.adjustment, 
      branch: r.branch, 
      product: r.product, 
      createdByUser: r.createdByUser, 
      approvedByUser: r.approvedByUser 
    }));
  }

  async approveStockAdjustment(id: number, approvedBy: string): Promise<StockAdjustment> {
    return await db.transaction(async (tx) => {
      // Check if user has admin role
      const [approvingUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, approvedBy))
        .limit(1);

      if (!approvingUser || approvingUser.length === 0) {
        throw new Error("User not found");
      }

      if (approvingUser[0].role !== 'admin') {
        throw new Error("Only admin users can approve stock adjustments");
      }

      // Get the adjustment to validate it's pending
      const [existingAdjustment] = await tx
        .select()
        .from(stockAdjustments)
        .where(eq(stockAdjustments.id, id))
        .limit(1);

      if (!existingAdjustment || existingAdjustment.length === 0) {
        throw new Error("Stock adjustment not found");
      }

      if (existingAdjustment[0].status !== 'pending') {
        throw new Error("Only pending adjustments can be approved");
      }

      // Update the adjustment status
      const [updated] = await tx
        .update(stockAdjustments)
        .set({ 
          status: 'approved', 
          approvedBy, 
          approvedAt: getCurrentTimestamp() 
        })
        .where(eq(stockAdjustments.id, id))
        .returning();

      // Log the approval
      await this.createAuditLogWithUser(
        'STOCK_ADJUSTMENT_APPROVED',
        'stock_adjustment',
        id,
        approvedBy,
        existingAdjustment[0].branchId,
        {
          adjustmentData: {
            productId: existingAdjustment[0].productId,
            quantity: existingAdjustment[0].quantity,
            type: existingAdjustment[0].type,
            reason: existingAdjustment[0].reason
          }
        },
        { status: existingAdjustment[0].status },
        newValues: updated[0]
      );

      // Apply inventory change
      const adjustment = updated;
      await this.updateInventory(adjustment.productId, adjustment.branchId, adjustment.quantity, "ADJUSTMENT");

      // Create inventory movement record
      await tx.insert(inventoryMovements).values({
        productId: adjustment.productId,
        branchId: adjustment.branchId,
        quantity: adjustment.quantity,
        type: "adjustment",
        reason: adjustment.reason,
        userId: approvedBy,
      });

      return updated;
    });
  }

  async rejectStockAdjustment(id: number, approvedBy: string): Promise<StockAdjustment> {
    const [updated] = await db
      .update(stockAdjustments)
      .set({ 
        status: 'rejected', 
        approvedBy, 
        approvedAt: getCurrentTimestamp() 
      })
      .where(eq(stockAdjustments.id, id))
      .returning();
    
    return updated;
  }

  // === Reports ===
  async getLowStockProducts(): Promise<(Product & { inventory: Inventory, branch: Branch })[]> {
    const lowStock = await db
      .select({
        product: products,
        inventory: inventory,
        branch: branches
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(branches, eq(inventory.branchId, branches.id))
      .where(and(
        lt(inventory.quantity, products.minStock),
        eq(products.status, 'in_stock')
      ))
      .orderBy(asc(inventory.quantity));

    return lowStock.map(item => ({ 
      ...item.product, 
      inventory: item.inventory, 
      branch: item.branch 
    }));
  }

  async getNonMovingProducts(days: number): Promise<(Product & { lastSaleDate?: Date })[]> {
    const cutoffDate = getLocalStartOfDay(new Date());
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get all products
    const allProducts = await db.select().from(products);
    
    // Get last sale date for each product
    const lastSales = await db
      .select({
        productId: saleItems.productId,
        lastSaleDate: sql`MAX(${sales.createdAt})`
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(
        eq(sales.status, 'completed'),
        gte(sales.createdAt, cutoffDate)
      ))
      .groupBy(saleItems.productId);

    const lastSalesMap = new Map(lastSales.map(s => [s.productId, s.lastSaleDate]));

    // Combine products with their last sale dates
    return allProducts.map(product => ({
      ...product,
      lastSaleDate: lastSalesMap.get(product.id) || undefined
    }));
  }

  async getPaymentBreakdown(startDate?: Date, endDate?: Date, branchId?: number): Promise<{ method: string, totalAmount: string, countSales: number }[]> {
    let query = db
      .select({
        method: salesPayments.method,
        totalAmount: sum(salesPayments.amount),
        countSales: sql`COUNT(DISTINCT ${salesPayments.saleId})`
      })
      .from(salesPayments)
      .innerJoin(sales, eq(salesPayments.saleId, sales.id));

    const conditions = [];
    if (startDate) conditions.push(gte(salesPayments.createdAt, startDate));
    if (endDate) conditions.push(lte(salesPayments.createdAt, endDate));
    if (branchId) conditions.push(eq(sales.branchId, branchId));
    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const results = await query.groupBy(salesPayments.method);
    
    return results.map(r => ({
      method: r.method,
      totalAmount: r.totalAmount?.toString() || '0',
      countSales: Number(r.countSales)
    }));
  }

  async getWriteoffs(startDate?: Date, endDate?: Date, branchId?: number): Promise<(StockAdjustment & { 
    product: Product, 
    branch: Branch, 
    approvedByUser: User 
  })[]> {
    let query = db
      .select({
        adjustment: stockAdjustments,
        product: products,
        branch: branches,
        approvedByUser: users
      })
      .from(stockAdjustments)
      .innerJoin(products, eq(stockAdjustments.productId, products.id))
      .innerJoin(branches, eq(stockAdjustments.branchId, branches.id))
      .innerJoin(users, eq(stockAdjustments.approvedBy, users.id));

    const conditions = [];
    if (startDate) conditions.push(gte(stockAdjustments.createdAt, startDate));
    if (endDate) conditions.push(lte(stockAdjustments.createdAt, endDate));
    if (branchId) conditions.push(eq(stockAdjustments.branchId, branchId));
    conditions.push(eq(stockAdjustments.type, 'writeoff'));
    conditions.push(eq(stockAdjustments.status, 'approved'));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(stockAdjustments.approvedAt));
    
    return results.map(r => ({ 
      ...r.adjustment, 
      product: r.product, 
      branch: r.branch, 
      approvedByUser: r.approvedByUser 
    }));
  }

  async getEmployeeKpi(month: number, year: number): Promise<any[]> {
    const results = await db.select({
      user: users,
      branch: branches,
      kpi: employeeKpi
    })
    .where(eq(stockAdjustments.id, id))
    .returning();

  // Apply inventory change
  const adjustment = updated;
  await this.updateInventory(adjustment.productId, adjustment.branchId, adjustment.quantity, "ADJUSTMENT");

  // Create inventory movement record
  await tx.insert(inventoryMovements).values({
    productId: adjustment.productId,
    branchId: adjustment.branchId,
    quantity: adjustment.quantity,
    type: "adjustment",
    reason: adjustment.reason,
    userId: approvedBy,
  });

  return updated;
});

}

async rejectStockAdjustment(id: number, approvedBy: string): Promise<StockAdjustment> {
const [updated] = await db
  .update(stockAdjustments)
  .set({ 
    status: 'rejected', 
    approvedBy, 
    approvedAt: getCurrentTimestamp() 
  })
  .where(eq(stockAdjustments.id, id))
  .returning();
  
return updated;
}

// === Reports ===
async getLowStockProducts(): Promise<(Product & { inventory: Inventory, branch: Branch })[]> {
const lowStock = await db
  .select({
    product: products,
    inventory: inventory,
    branch: branches
  })
  .from(inventory)
  .innerJoin(products, eq(inventory.productId, products.id))
  .innerJoin(branches, eq(inventory.branchId, branches.id))
  .where(and(
    lt(inventory.quantity, products.minStock),
    eq(products.status, 'in_stock')
  ))
  .orderBy(asc(inventory.quantity));

return lowStock.map(item => ({ 
  ...item.product, 
  inventory: item.inventory, 
  branch: item.branch 
}));

}

async getNonMovingProducts(days: number): Promise<(Product & { lastSaleDate?: Date })[]> {
const cutoffDate = getLocalStartOfDay(new Date());
cutoffDate.setDate(cutoffDate.getDate() - days);

// Get all products
const allProducts = await db.select().from(products);
  
// Get last sale date for each product
const lastSales = await db
  .select({
    productId: saleItems.productId,
    lastSaleDate: sql`MAX(${sales.createdAt})`
  })
  .from(saleItems)
  .innerJoin(sales, eq(saleItems.saleId, sales.id))
  .where(and(
    eq(sales.status, 'completed'),
    gte(sales.createdAt, cutoffDate)
  ))
  .groupBy(saleItems.productId);

const lastSalesMap = new Map(lastSales.map(s => [s.productId, s.lastSaleDate]));

// Combine products with their last sale dates
return allProducts.map(product => ({
  ...product,
  lastSaleDate: lastSalesMap.get(product.id) || undefined
}));

}

async getPaymentBreakdown(startDate?: Date, endDate?: Date): Promise<{ method: string, total: string, count: number }[]> {
let query = db
  .select({
    method: salesPayments.method,
    total: sum(salesPayments.amount),
    count: sql`COUNT(*)`
  })
  .from(salesPayments);

const conditions = [];
if (startDate) conditions.push(gte(salesPayments.createdAt, startDate));
if (endDate) conditions.push(lte(salesPayments.createdAt, endDate));

if (conditions.length > 0) {
  // @ts-ignore
  query = query.where(and(...conditions));
}

const results = await query.groupBy(salesPayments.method);
  
return results.map(r => ({
  method: r.method,
  total: r.total?.toString() || '0',
  count: Number(r.count)
}));

}

async getEmployeeKpi(month: number, year: number): Promise<any[]> {
const results = await db.select({
  user: users,
  branch: branches,
  kpi: employeeKpi
})
.from(employeeKpi)
.innerJoin(users, eq(employeeKpi.userId, users.id))
.innerJoin(branches, eq(employeeKpi.branchId, branches.id))
.where(and(eq(employeeKpi.month, month), eq(employeeKpi.year, year)));

return results.map(r => ({
  ...r.kpi,
  user: r.user,
  branch: r.branch
}));

}

async getAnalyticsDashboard(range: 'daily' | 'weekly' | 'monthly'): Promise<any> {
  const stats = await this.getProfitLoss(range);
  return {
    ...stats,
    salesOverTime: [],
    categoryDistribution: []
  };
}

// === CSV Export/Import ===
async exportSalesToCSV(startDate?: Date, endDate?: Date): Promise<string> {
  const conditions = [];
  if (startDate) conditions.push(gte(sales.createdAt, startDate));
  if (endDate) conditions.push(lte(sales.createdAt, endDate));

  let query = db
    .select({
      sale: sales,
      client: clients,
      user: users,
      branch: branches,
      itemCount: sql`COUNT(*)`
    })
    .from(sales)
    .leftJoin(clients, eq(sales.clientId, clients.id))
    .leftJoin(users, eq(sales.userId, users.id))
    .leftJoin(branches, eq(sales.branchId, branches.id));

  if (conditions.length > 0) {
    // @ts-ignore
    query = query.where(and(...conditions));
  }

  const salesData = await query.groupBy(sales.id);
  
  // Get payment breakdown for each sale
  const salesWithPayments = await Promise.all(
    salesData.map(async (sale) => {
      const payments = await db
        .select({
          method: salesPayments.method,
          totalAmount: sum(salesPayments.amount)
        })
        .from(salesPayments)
        .where(eq(salesPayments.saleId, sale.sale.id))
        .groupBy(salesPayments.method);

      const paymentSummary = payments.reduce((acc, payment) => {
        acc[payment.method] = payment.totalAmount || '0';
        return acc;
      }, {} as Record<string, string>);

      return {
        ...sale,
        paymentMethodSummary: paymentSummary
      };
    })
  );

  // Get sale items count for each sale
  const salesWithItems = await Promise.all(
    salesData.map(async (sale) => {
      const itemCount = await db
        .select({ count: sql`COUNT(*)` })
        .from(saleItems)
        .where(eq(saleItems.saleId, sale.sale.id));

      return {
        ...sale,
        itemCount: Number(itemCount[0]?.count || 0)
      };
    })
  );

  // Combine all data
  const finalSalesData = salesData.map(sale => {
    const paymentData = salesWithPayments.find(p => p.sale.id === sale.id);
    const itemsData = salesWithItems.find(i => i.sale.id === sale.id);
    
    return {
      saleId: sale.sale.id,
      createdAt: sale.sale.createdAt?.toISOString() || '',
      branchId: sale.branch?.id || null,
      branchName: sale.branch?.name || '',
      totalAmount: sale.sale.totalAmount || '0',
      discountPercent: sale.sale.discount || '0',
      discountAmount: sale.sale.discount ? 
        (parseFloat(sale.sale.totalAmount) * parseFloat(sale.sale.discount) / 100).toFixed(2) : '0',
      paymentMethodSummary: paymentData?.paymentMethodSummary || {},
      itemCount: itemsData?.itemCount || 0,
      cashierUserId: sale.user?.id || '',
      cashierUsername: sale.user?.username || ''
    };
  });

  // Generate CSV headers
  const headers = [
    'saleId',
    'createdAt',
    'branchId', 
    'branchName',
    'totalAmount',
    'discountPercent',
    'discountAmount',
    'paymentMethodSummary',
    'itemCount',
    'cashierUserId',
    'cashierUsername'
  ];

  // Generate CSV rows with proper escaping
  const rows = finalSalesData.map(row => [
    row.saleId,
    row.createdAt,
    row.branchId,
    row.branchName,
    row.totalAmount,
    row.discountPercent,
    row.discountAmount,
    JSON.stringify(row.paymentMethodSummary), // Stringify for CSV safety
    row.itemCount,
    row.cashierUserId,
    row.cashierUsername
  ]);

  // Convert to CSV format with safe escaping
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(field => {
        const value = String(field);
        // Prevent formula injection by escaping = + - @
        if (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@')) {
          return `""${value}""`;
        }
        // Escape quotes and commas
        return `"${value.replace(/"/g, '""')}"`;
      })
    )
  ].join('\n');
  
  return csvContent;
}

async exportInventoryToCSV(branchId?: number): Promise<string> {
  let query = db
    .select({
      inventory: inventory,
      product: products,
      branch: branches,
      category: categories
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(branches, eq(inventory.branchId, branches.id))
    .innerJoin(categories, eq(products.categoryId, categories.id));

  if (branchId) {
    // @ts-ignore
    query = query.where(eq(inventory.branchId, branchId));
  }

  const inventoryData = await query;

  // Generate CSV headers
  const headers = [
    'branchId',
    'branchName',
    'productId', 
    'name',
    'category',
    'brand',
    'model',
    'unit',
    'minStock',
    'quantity'
  ];

  // Generate CSV rows with proper escaping
  const rows = inventoryData.map(row => [
    row.branch?.id || '',
    row.branch?.name || '',
    row.product?.id || '',
    row.product?.name || '',
    row.category?.name || '',
    row.product?.brand || '',
    row.product?.model || '',
    row.product?.unit || '',
    row.product?.minStock || 0,
    row.inventory?.quantity || 0
  ]);

  // Convert to CSV format with safe escaping
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(field => {
        const value = String(field);
        // Prevent formula injection by escaping = + - @
        if (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@')) {
          return `""${value}""`;
        }
        // Escape quotes and commas
        return `"${value.replace(/"/g, '""')}"`;
      })
    )
  ].join('\n');
  
  return csvContent;
}

async importProductsFromCSV(csvContent: string): Promise<{ 
  success: boolean; 
  message: string; 
  createdCount?: number; 
  updatedCount?: number; 
  inventoryUpdatedCount?: number;
  errors?: Array<{ row: number; field: string; message: string }> 
}> {
  const errors: Array<{ row: number; field: string; message: string }> = [];
  let createdCount = 0;
  let updatedCount = 0;
  let inventoryUpdatedCount = 0;

  // Get warehouse branch ID for default
  const warehouseBranch = await this.getWarehouseBranch();
  const defaultBranchId = warehouseBranch?.id;

  // Parse CSV content
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    return { success: false, message: "CSV file must contain headers and at least one data row" };
  }

  // Parse headers
  const headers = this.parseCSVLine(lines[0]);
  const requiredHeaders = ['name', 'price', 'cost', 'unit'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return { success: false, message: `Missing required headers: ${missingHeaders.join(', ')}` };
        continue;
      }

      // Validate numeric fields
      const price = parseFloat(rowData.price);
      const cost = parseFloat(rowData.cost);
      const minStock = rowData.minStock ? parseInt(rowData.minStock) : 0;
      const initialQty = rowData.initialQty ? parseInt(rowData.initialQty) : 0;
      const branchId = rowData.branchId ? parseInt(rowData.branchId) : defaultBranchId;

      if (isNaN(price) || price < 0) {
        errors.push({ row: rowNumber, field: 'price', message: 'Price must be a non-negative number' });
        continue;
      }

      if (isNaN(cost) || cost < 0) {
        errors.push({ row: rowNumber, field: 'cost', message: 'Cost must be a non-negative number' });
        continue;
      }

      if (isNaN(minStock) || minStock < 0) {
        errors.push({ row: rowNumber, field: 'minStock', message: 'Min stock must be a non-negative number' });
        continue;
      }

      if (isNaN(initialQty) || initialQty < 0) {
        errors.push({ row: rowNumber, field: 'initialQty', message: 'Initial quantity must be a non-negative number' });
        continue;
      }

      if (!branchId) {
        errors.push({ row: rowNumber, field: 'branchId', message: 'Branch ID is required or warehouse must exist' });
        continue;
      }

      // Find existing product by name+brand+model
      const existingProducts = await db
        .select()
        .from(products)
        .where(and(
          eq(products.name, rowData.name),
          eq(products.brand || '', rowData.brand || ''),
          eq(products.model || '', rowData.model || '')
        ));

      let productId: number;
      let isUpdate = false;

      if (existingProducts.length > 0) {
        // Update existing product
        const existingProduct = existingProducts[0];
        productId = existingProduct.id;
        isUpdate = true;

        // Check if price or cost changed for price history
        const priceChanged = existingProduct.price !== price.toString();
        const costChanged = existingProduct.costPrice !== cost.toString();

        await db.transaction(async (tx) => {
          // Update product
          await tx
            .update(products)
            .set({
              price: price.toString(),
              costPrice: cost.toString(),
              unit: rowData.unit,
              minStock,
              brand: rowData.brand || null,
              model: rowData.model || null,
            })
            .where(eq(products.id, productId));

          // Create price history if price or cost changed
          if (priceChanged || costChanged) {
            await tx.insert(priceHistory).values({
              productId,
              oldPrice: existingProduct.price,
              newPrice: price.toString(),
              oldCost: existingProduct.costPrice,
              newCost: cost.toString(),
              changedByUserId: 'system', // Could be passed as parameter
              reason: 'CSV Import Update'
            });
          }
        });

        updatedCount++;
      } else {
        // Create new product
        const [newProduct] = await db
          .insert(products)
          .values({
            name: rowData.name,
            price: price.toString(),
            costPrice: cost.toString(),
            unit: rowData.unit,
            minStock,
            brand: rowData.brand || null,
            model: rowData.model || null,
            categoryId: 1, // Default category - could be enhanced to find by name
          })
          .returning();

        productId = newProduct.id;
        createdCount++;
      }

      // Handle initial quantity
      if (initialQty > 0) {
        await db.transaction(async (tx) => {
          // Check if inventory record exists
          const [existingInventory] = await tx
            .select()
            .from(inventory)
            .where(and(
              eq(inventory.productId, productId),
              eq(inventory.branchId, branchId)
            ));

          if (existingInventory) {
            // Update existing inventory
            await tx
              .update(inventory)
              .set({
                quantity: existingInventory.quantity + initialQty
              })
              .where(and(
                eq(inventory.productId, productId),
                eq(inventory.branchId, branchId)
              ));
          } else {
            // Create new inventory record
            await tx
              .insert(inventory)
              .values({
                productId,
                branchId,
                quantity: initialQty
              });
          }

          // Create inventory movement record
          await tx.insert(inventoryMovements).values({
            productId,
            branchId,
            quantity: initialQty,
            type: 'received',
            reason: 'CSV Import Initial Quantity',
            userId: 'system' // Could be passed as parameter
          });
        });

        inventoryUpdatedCount++;
      }

    } catch (error) {
      errors.push({ 
        row: rowNumber, 
        field: 'general', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  const success = errors.length === 0 || (createdCount > 0 || updatedCount > 0);
  const message = success 
    ? `Import completed: ${createdCount} created, ${updatedCount} updated, ${inventoryUpdatedCount} inventory updated${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
    : `Import failed with ${errors.length} errors`;

  return {
    success,
    message,
    createdCount,
    updatedCount,
    inventoryUpdatedCount,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Helper method to sanitize CSV field values to prevent injection
private sanitizeCSVField(field: string): string {
  if (!field) return '';
  
  // Remove potentially dangerous characters
  const sanitized = field
    .replace(/[=+\-@]/g, '') // Remove formula starters
    .replace(/[\t\n\r]/g, ' ') // Replace whitespace with space
    .trim();
  
  // If field contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return '"' + sanitized.replace(/"/g, '""') + '"';
  }
  
  return sanitized;
}

// Helper method to parse CSV line with proper quote handling
private parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current);
  
  return result;
}

export const storage = new DatabaseStorage();
