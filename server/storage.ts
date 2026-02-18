import bcrypt from "bcryptjs";
import { 
  users, branches, products, inventory, clients, prescriptions, sales, saleItems, expenses, categories,
  inventoryMovements, employeeKpi, shipments, shipmentItems, auditLogs, monthlyClosures,
  type User, type Branch, type Product, type Inventory, type Client, type Prescription, type Sale, type SaleItem, type Expense,
  type UpsertUser, type InventoryMovement, type EmployeeKpi,
  type SaleInput, type Category, type Shipment, type ShipmentItem, type AuditLog, type MonthlyClosure
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
  getSale(id: number): Promise<Sale | undefined>;
  getSales(options: { startDate?: Date, endDate?: Date, branchId?: number, saleId?: number }): Promise<(Sale & { client: Client | null, user: User, items: (SaleItem & { product: Product })[] })[]>;
  updateSaleStatus(id: number, status: string): Promise<Sale>;

  // Monthly Closures
  isMonthClosed(branchId: number, month: number, year: number): Promise<boolean>;
  closeMonth(branchId: number, month: number, year: number, userId: string): Promise<MonthlyClosure>;

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
    
    if (context === "WAREHOUSE_ADJUST" && branchId !== warehouseId) {
      throw new Error("Faqat markaziy omborda inventarizatsiya qilish mumkin.");
    }

    if (context === "SHIPMENT_RECEIVE" && branchId === warehouseId) {
      // Typically warehouse doesn't receive shipments from itself, but we allow if needed.
      // The requirement says "Non-warehouse branches cannot receive stock except through shipment receiving".
    }

    const [existing] = await db.select().from(inventory).where(and(eq(inventory.productId, productId), eq(inventory.branchId, branchId)));
    
    if (existing) {
      await db.update(inventory)
        .set({ quantity: sql`${inventory.quantity} + ${quantityChange}` })
        .where(eq(inventory.id, existing.id));
    } else {
      if (quantityChange < 0) throw new Error("Mavjud bo'lmagan qoldiqni kamaytirib bo'lmaydi.");
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

  async receiveShipment(shipmentId: number, receivedItems: { productId: number, qtyReceived: number }[]): Promise<Shipment> {
    return await db.transaction(async (tx) => {
      const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, shipmentId));
      if (!shipment) throw new Error("Shipment not found");
      if (shipment.status === "received" || shipment.status === "cancelled") {
        throw new Error("Jo'natma yakunlangan yoki bekor qilingan");
      }

      let allFullyReceived = true;
      let anyReceived = false;

      const currentShipmentItems = await tx.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));

      for (const shipItem of currentShipmentItems) {
        const update = receivedItems.find(r => r.productId === shipItem.productId);
        const addedQty = update ? update.qtyReceived : 0;
        
        const newTotalReceived = shipItem.qtyReceived + addedQty;
        
        if (newTotalReceived < shipItem.qtySent) {
          allFullyReceived = false;
        }
        if (newTotalReceived > 0) {
          anyReceived = true;
        }

        if (addedQty > 0) {
          // Update shipment item
          await tx.update(shipmentItems)
            .set({ qtyReceived: newTotalReceived })
            .where(eq(shipmentItems.id, shipItem.id));

          // Update inventory
          const [stock] = await tx.select().from(inventory).where(and(
            eq(inventory.productId, shipItem.productId),
            eq(inventory.branchId, shipment.toBranchId)
          ));

          if (stock) {
            await tx.update(inventory)
              .set({ quantity: sql`${inventory.quantity} + ${addedQty}` })
              .where(eq(inventory.id, stock.id));
          } else {
            await tx.insert(inventory).values({
              productId: shipItem.productId,
              branchId: shipment.toBranchId,
              quantity: addedQty
            });
          }

          // Log movement
          await tx.insert(inventoryMovements).values({
            productId: shipItem.productId,
            branchId: shipment.toBranchId,
            fromBranchId: shipment.fromWarehouseId,
            toBranchId: shipment.toBranchId,
            quantity: addedQty,
            type: 'shipment_received',
            reason: `Shipment #${shipmentId} qabul qilindi`,
            userId: shipment.createdBy, // Ideally use current userId but shipment.createdBy is available
          });
        }
      }

      const newStatus = allFullyReceived ? "received" : (anyReceived ? "partially_received" : "pending");
      const [updated] = await tx.update(shipments)
        .set({ status: newStatus })
        .where(eq(shipments.id, shipmentId))
        .returning();

      await tx.insert(auditLogs).values({
        actorUserId: shipment.createdBy, // In a real scenario we'd use current user ID
        branchId: shipment.toBranchId,
        actionType: "SHIPMENT_RECEIVED",
        entityType: "shipment",
        entityId: shipment.id,
        metadata: JSON.stringify({ status: newStatus, receivedItemsCount: receivedItems.length })
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

  async updateSaleStatus(id: number, status: string): Promise<Sale> {
    const [updated] = await db.update(sales).set({ status }).where(eq(sales.id, id)).returning();
    return updated;
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

  async createSale(userId: string, input: SaleInput): Promise<Sale> {
    if (!input.items || input.items.length === 0) {
      throw new Error("Sotuvda kamida bitta mahsulot bo'lishi kerak");
    }

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Mahsulot miqdori musbat butun son bo'lishi kerak");
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [dailySales] = await db.select({ total: sum(sales.totalAmount) }).from(sales).where(and(eq(sales.status, 'completed'), gte(sales.createdAt, startOfDay)));
    const [monthlySales] = await db.select({ total: sum(sales.totalAmount) }).from(sales).where(and(eq(sales.status, 'completed'), gte(sales.createdAt, startOfMonth)));
    const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(clients);
    
    const lowStock = await db.select().from(inventory).where(lte(inventory.quantity, 5)).limit(10);
    
    return {
      dailySales: Number(dailySales?.total || 0),
      monthlySales: Number(monthlySales?.total || 0),
      totalClients: Number(clientCount?.count || 0),
      lowStockCount: lowStock.length,
      totalProfit: Number(monthlySales?.total || 0) * 0.3, // Placeholder
      topProducts: []
    };
  }

  async getProfitLoss(range: 'daily' | 'weekly' | 'monthly'): Promise<{ totalRevenue: number; totalExpenses: number; profit: number }> {
    const now = new Date();
    let startDate = new Date();
    if (range === 'daily') startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (range === 'weekly') startDate.setDate(now.getDate() - 7);
    else startDate = new Date(now.getFullYear(), now.getMonth(), 1);

    const [revenue] = await db.select({ total: sum(sales.totalAmount) }).from(sales).where(and(eq(sales.status, 'completed'), gte(sales.createdAt, startDate)));
    const [expenseSum] = await db.select({ total: sum(expenses.amount) }).from(expenses).where(gte(expenses.date, startDate));

    const totalRevenue = Number(revenue?.total || 0);
    const totalExpenses = Number(expenseSum?.total || 0);

    return {
      totalRevenue,
      totalExpenses,
      profit: totalRevenue - totalExpenses
    };
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
}

export const storage = new DatabaseStorage();
