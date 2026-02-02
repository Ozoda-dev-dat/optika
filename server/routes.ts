import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);

  // Require Auth for all API routes? Or most?
  // For now, let's protect everything starting with /api/ except auth/login/callback
  // But wait, setupAuth already handles login/callback.
  // We can add a middleware for protection.

  // === Branches ===
  app.get(api.branches.list.path, isAuthenticated, async (req, res) => {
    const branches = await storage.getBranches();
    res.json(branches);
  });

  app.post(api.branches.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.branches.create.input.parse(req.body);
      const branch = await storage.createBranch(input);
      res.status(201).json(branch);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // === Categories ===
  app.get(api.categories.list.path, isAuthenticated, async (req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post(api.categories.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.categories.create.input.parse(req.body);
      const cat = await storage.createCategory(input);
      res.status(201).json(cat);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // === Products ===
  app.get(api.products.list.path, isAuthenticated, async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const search = req.query.search as string;
    const products = await storage.getProducts(categoryId, search);
    res.json(products);
  });

  app.post(api.products.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // === Inventory ===
  app.get(api.inventory.list.path, isAuthenticated, async (req, res) => {
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const search = req.query.search as string;
    const inv = await storage.getInventory(branchId, search);
    res.json(inv);
  });

  app.post(api.inventory.update.path, isAuthenticated, async (req, res) => {
    const { productId, branchId, quantity } = req.body;
    await storage.updateInventory(productId, branchId, quantity);
    res.json({ success: true });
  });

  // === Clients ===
  app.get(api.clients.list.path, isAuthenticated, async (req, res) => {
    const search = req.query.search as string;
    const clients = await storage.getClients(search);
    res.json(clients);
  });

  app.get(api.clients.get.path, isAuthenticated, async (req, res) => {
    const client = await storage.getClient(Number(req.params.id));
    if (!client) return res.status(404).json({ message: "Not found" });
    res.json(client);
  });

  app.post(api.clients.create.path, isAuthenticated, async (req, res) => {
    const input = api.clients.create.input.parse(req.body);
    const client = await storage.createClient(input);
    res.status(201).json(client);
  });

  app.put(api.clients.update.path, isAuthenticated, async (req, res) => {
    const input = api.clients.update.input.parse(req.body);
    const client = await storage.updateClient(Number(req.params.id), input);
    res.json(client);
  });

  app.post(api.clients.addPrescription.path, isAuthenticated, async (req, res) => {
    const input = api.clients.addPrescription.input.parse(req.body);
    const prescription = await storage.addPrescription({ ...input, clientId: Number(req.params.id) });
    res.status(201).json(prescription);
  });

  // === Sales ===
  app.post(api.sales.create.path, isAuthenticated, async (req, res) => {
    // @ts-ignore
    const userId = req.user.id;
    const input = api.sales.create.input.parse(req.body);
    const sale = await storage.createSale(userId, input);
    res.status(201).json(sale);
  });

  app.get(api.sales.list.path, isAuthenticated, async (req, res) => {
    const sales = await storage.getSales({});
    res.json(sales);
  });

  app.post(api.sales.return.path, isAuthenticated, async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.user.id;
      const saleId = Number(req.params.id);
      const { reason } = api.sales.return.input.parse(req.body);
      const saleReturn = await storage.processReturn(userId, saleId, reason);
      res.json(saleReturn);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === Expenses ===
  app.get(api.expenses.list.path, isAuthenticated, async (req, res) => {
    const expenses = await storage.getExpenses({});
    res.json(expenses);
  });

  app.post(api.expenses.create.path, isAuthenticated, async (req, res) => {
    const input = api.expenses.create.input.parse(req.body);
    const expense = await storage.createExpense(input);
    res.status(201).json(expense);
  });

  // === Reports ===
  app.get(api.reports.dashboard.path, isAuthenticated, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const cats = await storage.getCategories();
  if (cats.length === 0) {
    console.log("Seeding database...");
    
    // Admin user
    await storage.upsertUser({
      id: "admin-id",
      username: "admin",
      password: "admin123",
      role: "admin",
      firstName: "Admin",
      lastName: "User"
    });
    // Categories
    const frame = await storage.createCategory({ name: "Oprava (Ramkalar)", slug: "frames" });
    const lens = await storage.createCategory({ name: "Linzalar", slug: "lenses" });
    const acc = await storage.createCategory({ name: "Aksessuarlar", slug: "accessories" });

    // Branches
    const branch1 = await storage.createBranch({ name: "Markaziy Filial", address: "Tashkent, Amir Temur 1", phone: "+998901234567" });
    const branch2 = await storage.createBranch({ name: "Chilonzor Filial", address: "Tashkent, Chilonzor 5", phone: "+998909876543" });

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
