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

// Seller Data Isolation Utility
const FORBIDDEN_SELLER_KEYS = [
  "costPrice", "buyPrice", "purchasePrice", 
  "profit", "margin", "markup", "supplierPrice"
];

function deepSanitizeForSeller(input: any): any {
  if (Array.isArray(input)) {
    return input.map(deepSanitizeForSeller);
  }
  
  if (input !== null && typeof input === 'object') {
    // If it's a Date or other non-plain object, return as is
    if (input instanceof Date) return input;
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      if (!FORBIDDEN_SELLER_KEYS.includes(key)) {
        sanitized[key] = deepSanitizeForSeller(value);
      }
    }
    return sanitized;
  }
  
  return input;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  setupAuth(app);

  // Seller Data Isolation Middleware
  app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
      // @ts-ignore
      if (req.isAuthenticated() && req.user?.role === "sales" && data !== null && data !== undefined) {
        data = deepSanitizeForSeller(data);
      }
      return originalJson.call(this, data);
    };
    next();
  });

  // === Branches ===
  app.get(api.branches.list.path, requireRole(["admin", "manager"]), async (req, res) => {
    const warehouse = await storage.getWarehouseBranch();
    if (!warehouse) {
      console.error("CRITICAL: Markaziy ombor topilmadi. Tizim to'xtatildi.");
      process.exit(1);
    }
    const allBranches = await storage.getBranches();
    const warehouses = allBranches.filter(b => b.isWarehouse);
    if (warehouses.length !== 1) {
      console.error(`CRITICAL: Faqat bitta markaziy ombor bo'lishi kerak. Topildi: ${warehouses.length}`);
      process.exit(1);
    }

    res.json(allBranches);
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
    res.json(products);
  });

  app.get("/api/products/:id", requireRole(["admin", "manager", "sales", "optometrist"]), async (req, res) => {
    const productId = Number(req.params.id);
    const products = await storage.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
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

  app.patch("/api/products/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const productId = Number(req.params.id);
      // @ts-ignore
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const product = await storage.updateProduct(productId, req.body, userId);
      res.json(product);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // === Inventory ===
  app.get(api.inventory.list.path, requireRole(["admin", "manager", "sales", "optometrist"]), async (req, res) => {
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const search = req.query.search as string;
    const inv = await storage.getInventory(branchId, search);
    res.json(inv);
  });

  // === Shipments ===
  app.get("/api/shipments", requireRole(["admin", "manager", "sales"]), async (req, res) => {
    // @ts-ignore
    const userRole = req.user.role;
    // @ts-ignore
    const userBranchId = req.user.branchId;
    
    const branchId = userRole === "admin" ? undefined : (userBranchId as number | undefined);
    const ships = await storage.getShipments(branchId);
    res.json(ships);
  });

  app.post("/api/shipments", requireRole(["admin"]), async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.user.id;
      // Force fromWarehouseId to be the actual warehouse ID from DB
      const warehouseId = await storage.getWarehouseBranchId();
      if (!warehouseId) throw new Error("Markaziy ombor aniqlanmadi.");
      
      const { toBranchId, items } = req.body;
      const shipment = await storage.createShipment(userId, warehouseId, toBranchId, items);
      res.status(201).json(shipment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/shipments/:id/receive", requireRole(["admin", "manager", "sales"]), async (req, res) => {
    try {
      const shipmentId = Number(req.params.id);
      const { items, requestId } = req.body;

      if (!requestId) {
        return res.status(400).json({ message: "requestId talab qilinadi." });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Mahsulotlar ro'yxati bo'sh bo'lishi mumkin emas." });
      }

      const shipmentsList = await storage.getShipments();
      const shipment = shipmentsList.find(s => s.id === shipmentId);
      if (!shipment) return res.status(404).json({ message: "Jo'natma topilmadi" });

      // @ts-ignore
      const userRole = req.user.role;
      // @ts-ignore
      const userBranchId = req.user.branchId;
      // @ts-ignore
      const userId = req.user.id;

      if (userRole === "sales" && shipment.toBranchId !== userBranchId) {
        return res.status(403).json({ message: "Siz ushbu jo'natmani qabul qilish huquqiga ega emassiz." });
      }

      const updatedShipment = await storage.receiveShipment(shipmentId, items, requestId, userId);
      res.json(updatedShipment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/inventory/adjust", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.user.id;
      const { productId, branchId, quantityChange, reason } = req.body;
      
      const warehouseId = await storage.getWarehouseBranchId();
      
      if (branchId !== warehouseId) {
        return res.status(403).json({ message: "Direct inventory adjustments are only allowed for the central warehouse." });
      }

      await storage.adjustInventory(userId, productId, branchId, quantityChange, reason);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === Stock Adjustments (Writeoff Flow) ===
  app.post("/api/stock-adjustments", requireRole(["admin", "manager", "sales"]), async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const adjustment = await storage.createStockAdjustment({
        ...req.body,
        createdBy: userId,
        status: "pending"
      });
      
      res.status(201).json(adjustment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/stock-adjustments/:id/approve", requireRole(["admin"]), async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const adjustment = await storage.approveStockAdjustment(Number(req.params.id), userId);
      res.json(adjustment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/stock-adjustments/:id/reject", requireRole(["admin"]), async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const adjustment = await storage.rejectStockAdjustment(Number(req.params.id), userId);
      res.json(adjustment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/stock-adjustments", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const status = req.query.status as string | undefined;
      const adjustments = await storage.getStockAdjustments(branchId, status);
      res.json(adjustments);
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

    const now = new Date();
    const isClosed = await storage.isMonthClosed(input.branchId, now.getMonth() + 1, now.getFullYear());
    if (isClosed) {
      return res.status(403).json({ message: "Bu oy uchun savdolar yopilgan" });
    }

    try {
      const sale = await storage.createSale(userId, input);
      res.status(201).json(sale);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/sales/:id/status", requireRole(["admin", "manager"]), async (req, res) => {
    const saleId = Number(req.params.id);
    const { status } = req.body;
    
    const sale = await storage.getSale(saleId);
    if (!sale) return res.status(404).json({ message: "Sotuv topilmadi" });

    // Completed sales cannot be modified by status
    if (sale.status === "completed") {
      return res.status(403).json({ message: "Yakunlangan sotuvni o'zgartirib bo'lmaydi" });
    }

    const updated = await storage.updateSaleStatus(saleId, status);
    res.json(updated);
  });

  app.post("/api/branches/:id/close-month", requireRole(["admin"]), async (req, res) => {
    const branchId = Number(req.params.id);
    const { month, year } = req.body;
    // @ts-ignore
    const userId = req.user.id;

    try {
      const closure = await storage.closeMonth(branchId, month, year, userId);
      res.json(closure);
    } catch (err: any) {
      res.status(400).json({ message: "Oy yopishda xatolik yuz berdi" });
    }
  });

  app.get(api.sales.list.path, requireRole(["admin", "manager", "sales"]), async (req, res) => {
    // @ts-ignore
    const userRole = req.user.role;
    // @ts-ignore
    const userBranchId = req.user.branchId;

    let branchId = req.query.branchId ? Number(req.query.branchId) : undefined;

    if (userRole === "sales") {
      branchId = userBranchId as number | undefined;
    }

    const salesList = await storage.getSales({ branchId });
    
    // Add isLocked flag for the UI
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const salesWithLock = salesList.map(sale => {
      const saleDate = new Date(sale.createdAt).getTime();
      const isOld = saleDate < today;
      return {
        ...sale,
        isLocked: sale.status === "completed" || isOld
      };
    });
    
    res.json(salesWithLock);
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

  // Low Stock Report
  app.get("/api/reports/low-stock", requireRole(["admin", "manager"]), async (req, res) => {
    const lowStockProducts = await storage.getLowStockProducts();
    res.json(lowStockProducts);
  });

  // Non-Moving Products Report
  app.get("/api/reports/non-moving", requireRole(["admin", "manager"]), async (req, res) => {
    const days = Number(req.query.days) || 30;
    const nonMovingProducts = await storage.getNonMovingProducts(days);
    res.json(nonMovingProducts);
  });

  // Payment Breakdown Report
  app.get("/api/reports/payment-breakdown", requireRole(["admin", "manager"]), async (req, res) => {
    const startDate = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const endDate = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const paymentBreakdown = await storage.getPaymentBreakdown(startDate, endDate, branchId);
    res.json(paymentBreakdown);
  });

  // Writeoff/Defective Report
  app.get("/api/reports/writeoffs", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const startDate = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const endDate = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      
      const writeoffs = await storage.getWriteoffs(startDate, endDate, branchId);
      res.json(writeoffs);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === CSV Export/Import ===
  app.get("/api/export/sales.csv", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const csvContent = await storage.exportSalesToCSV(startDate, endDate);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sales.csv"');
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ message: "Export failed", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/export/inventory.csv", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const csvContent = await storage.exportInventoryToCSV(branchId);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ message: "Export failed", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/import/products.csv", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // Handle both multipart/form-data and raw text body
      let csvContent: string;
      
      if (req.body && req.body.csvContent) {
        // Raw text body
        csvContent = req.body.csvContent;
      } else if (req.file && req.file.buffer) {
        // File upload - check size limit (5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB in bytes
        if (req.file.size > maxSize) {
          return res.status(413).json({ 
            success: false, 
            message: "File size exceeds 5MB limit" 
          });
        }
        
        // Convert buffer to string and normalize line endings
        csvContent = req.file.buffer
          .toString('utf8')
          .replace(/\r\n/g, '\n')  // Normalize line endings
          .trim();
      } else {
        return res.status(400).json({ 
          success: false, 
          message: "CSV content is required. Use either 'csvContent' in request body or upload a file" 
        });
      }

      // Validate CSV content
      if (!csvContent || csvContent.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "CSV content cannot be empty" 
        });
      }

      const result = await storage.importProductsFromCSV(csvContent);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('CSV Import Error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Import failed", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // === Audit Logs ===
  /*app.get("/api/audit-logs", requireRole(["admin"]), async (req, res) => {
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const actionType = req.query.actionType as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const logs = await storage.getAuditLogs({ 
      branchId, 
      actionType, 
      entityType, 
      startDate, 
      endDate,
      offset: (page - 1) * limit,
      limit
    });
    res.json(logs);
  });*/

  return httpServer;
}
