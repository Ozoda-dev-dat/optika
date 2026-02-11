import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth } from "./auth";
import bcrypt from "bcryptjs";

// RBAC Middleware
function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // @ts-ignore
    const userRole = req.user.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }
    next();
  };
}

function sanitizeProductForRole(product: any, role: string) {
  if (role === "sales") {
    const { costPrice, ...sanitized } = product;
    return sanitized;
  }
  return product;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  setupAuth(app);

  // === Branches ===
  app.get(api.branches.list.path, requireRole(["admin", "manager"]), async (req, res) => {
    const branches = await storage.getBranches();
    res.json(branches);
  });

  app.post(api.branches.create.path, requireRole(["admin"]), async (req, res) => {
    try {
      const input = api.branches.create.input.parse(req.body);
      const branch = await storage.createBranch(input);
      res.status(201).json(branch);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // === Categories ===
  app.get(api.categories.list.path, requireRole(["admin", "manager", "sales"]), async (req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post(api.categories.create.path, requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const input = api.categories.create.input.parse(req.body);
      const cat = await storage.createCategory(input);
      res.status(201).json(cat);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // === Products ===
  app.get(api.products.list.path, requireRole(["admin", "manager", "sales", "optometrist"]), async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const search = req.query.search as string;
    const products = await storage.getProducts(categoryId, search);
    // @ts-ignore
    const role = req.user.role;
    res.json(products.map(p => sanitizeProductForRole(p, role)));
  });

  app.post(api.products.create.path, requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // === Inventory ===
  app.get(api.inventory.list.path, requireRole(["admin", "manager", "sales", "optometrist"]), async (req, res) => {
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const search = req.query.search as string;
    const inv = await storage.getInventory(branchId, search);
    // @ts-ignore
    const role = req.user.role;
    res.json(inv.map(i => ({
      ...i,
      product: sanitizeProductForRole(i.product, role)
    })));
  });

  // === Shipments ===
  app.get("/api/shipments", requireRole(["admin", "manager", "sales"]), async (req, res) => {
    // @ts-ignore
    const userRole = req.user.role;
    // @ts-ignore
    const userBranchId = req.user.branchId;
    
    const branchId = userRole === "admin" ? undefined : userBranchId;
    const ships = await storage.getShipments(branchId);
    res.json(ships);
  });

  app.post("/api/shipments", requireRole(["admin"]), async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.user.id;
      const { fromWarehouseId, toBranchId, items } = req.body;
      const shipment = await storage.createShipment(userId, fromWarehouseId, toBranchId, items);
      res.status(201).json(shipment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/shipments/:id/receive", requireRole(["admin", "manager", "sales"]), async (req, res) => {
    try {
      const shipmentId = Number(req.params.id);
      const { items } = req.body;
      const shipment = await storage.receiveShipment(shipmentId, items);
      res.json(shipment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/inventory/adjust", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.user.id;
      const { productId, branchId, quantityChange, reason } = req.body;
      await storage.adjustInventory(userId, productId, branchId, quantityChange, reason);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === Clients ===
  app.get(api.clients.list.path, requireRole(["admin", "manager", "sales", "optometrist"]), async (req, res) => {
    const search = req.query.search as string;
    const clients = await storage.getClients(search);
    res.json(clients);
  });

  app.get(api.clients.get.path, requireRole(["admin", "manager", "sales", "optometrist"]), async (req, res) => {
    const client = await storage.getClient(Number(req.params.id));
    if (!client) return res.status(404).json({ message: "Not found" });
    res.json(client);
  });

  app.post(api.clients.create.path, requireRole(["admin", "manager", "sales", "optometrist"]), async (req, res) => {
    const input = api.clients.create.input.parse(req.body);
    const client = await storage.createClient(input);
    res.status(201).json(client);
  });

  app.put(api.clients.update.path, requireRole(["admin", "manager", "sales", "optometrist"]), async (req, res) => {
    const input = api.clients.update.input.parse(req.body);
    const client = await storage.updateClient(Number(req.params.id), input);
    res.json(client);
  });

  app.post(api.clients.addPrescription.path, requireRole(["admin", "optometrist"]), async (req, res) => {
    const input = api.clients.addPrescription.input.parse(req.body);
    const prescription = await storage.addPrescription({ ...input, clientId: Number(req.params.id) });
    res.status(201).json(prescription);
  });

  // === Sales ===
  app.post(api.sales.create.path, requireRole(["admin", "sales"]), async (req, res) => {
    // @ts-ignore
    const userId = req.user.id;
    const input = api.sales.create.input.parse(req.body);
    const sale = await storage.createSale(userId, input);
    res.status(201).json(sale);
  });

  app.get(api.sales.list.path, requireRole(["admin", "manager", "sales"]), async (req, res) => {
    // @ts-ignore
    const userRole = req.user.role;
    // @ts-ignore
    const userBranchId = req.user.branchId;

    let branchId = req.query.branchId ? Number(req.query.branchId) : undefined;

    if (userRole === "sales") {
      branchId = userBranchId;
    }

    const sales = await storage.getSales({ branchId });
    res.json(sales);
  });

  app.get("/api/sales/:id", requireRole(["admin", "manager", "sales"]), async (req, res) => {
    const saleId = Number(req.params.id);
    const sales = await storage.getSales({ saleId });
    const sale = sales[0];

    if (!sale) return res.status(404).json({ message: "Sale not found" });

    // @ts-ignore
    const userRole = req.user.role;
    // @ts-ignore
    const userBranchId = req.user.branchId;

    if (userRole === "sales" && sale.branchId !== userBranchId) {
      return res.status(403).json({ message: "Forbidden: Access to other branch sales is denied" });
    }

    res.json(sale);
  });

  app.post(api.sales.return.path, requireRole(["admin", "manager"]), async (req, res) => {
    res.status(410).json({ message: "Returns are not supported." });
  });

  // === Expenses ===
  app.get(api.expenses.list.path, requireRole(["admin", "manager"]), async (req, res) => {
    const expenses = await storage.getExpenses({});
    res.json(expenses);
  });

  app.post(api.expenses.create.path, requireRole(["admin", "manager"]), async (req, res) => {
    const input = api.expenses.create.input.parse(req.body);
    const expense = await storage.createExpense(input);
    res.status(201).json(expense);
  });

  // === Reports ===
  app.get(api.reports.dashboard.path, requireRole(["admin", "manager"]), async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/employees/kpi", requireRole(["admin", "manager"]), async (req, res) => {
    const monthStr = req.query.month as string; // YYYY-MM
    if (!monthStr) return res.status(400).json({ message: "Month is required" });
    
    const [year, month] = monthStr.split('-').map(Number);
    const kpis = await storage.getEmployeeKpi(month, year);
    res.json(kpis);
  });

  app.get("/api/analytics/dashboard", requireRole(["admin", "manager"]), async (req, res) => {
    const range = (req.query.range as 'daily' | 'weekly' | 'monthly') || 'daily';
    const stats = await storage.getAnalyticsDashboard(range);
    res.json(stats);
  });

  app.get("/api/finance/profit-loss", requireRole(["admin", "manager"]), async (req, res) => {
    const range = (req.query.range as 'daily' | 'weekly' | 'monthly') || 'daily';
    const report = await storage.getProfitLoss(range);
    res.json(report);
  });

  // === Audit Logs ===
  app.get("/api/audit-logs", requireRole(["admin"]), async (req, res) => {
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const logs = await storage.getAuditLogs({ branchId });
    res.json(logs);
  });

  return httpServer;
}

async function seedDatabase() {
  const cats = await storage.getCategories();
  if (cats.length === 0) {
    console.log("Seeding database...");
    
    // Admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await storage.upsertUser({
      id: "admin-id",
      username: "admin",
      password: hashedPassword,
      role: "admin",
      firstName: "Admin",
      lastName: "User"
    });
    // Categories
    const frame = await storage.createCategory({ name: "Oprava (Ramkalar)", slug: "frames" });
    const lens = await storage.createCategory({ name: "Linzalar", slug: "lenses" });
    const acc = await storage.createCategory({ name: "Aksessuarlar", slug: "accessories" });

    // Branches
    const branch1 = await storage.createBranch({ name: "Markaziy Filial", address: "Tashkent, Amir Temur 1", phone: "+998901234567", discountLimitPercent: 15 });
    const branch2 = await storage.createBranch({ name: "Chilonzor Filial", address: "Tashkent, Chilonzor 5", phone: "+998909876543", discountLimitPercent: 5 });

    // Products
    const p1 = await storage.createProduct({ name: "Ray-Ban Aviator", sku: "RB3025", categoryId: frame.id, price: "1500000", costPrice: "800000", brand: "Ray-Ban", model: "Aviator" });
    const p2 = await storage.createProduct({ name: "Blue Cut Lens 1.56", sku: "LENS-BC", categoryId: lens.id, price: "250000", costPrice: "100000", brand: "Hoya", model: "BlueControl" });

    // Inventory
    await storage.updateInventory(p1.id, branch1.id, 10);
    await storage.updateInventory(p2.id, branch1.id, 50);
    await storage.updateInventory(p1.id, branch2.id, 5);

    // Clients
    await storage.createClient({ firstName: "Aziz", lastName: "Rahimov", phone: "+998900000000" });
    
    console.log("Seeding complete.");
  }
}
