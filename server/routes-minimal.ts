import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth } from "./auth";

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

// Validation middleware
function validateInput<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      }
      next(error);
    }
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  setupAuth(app);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Branches
  app.get(api.branches.list.path, async (req, res) => {
    try {
      const allBranches = await storage.getBranches();
      res.json(allBranches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  app.post(api.branches.create.path, requireRole(["admin"]), async (req, res) => {
    try {
      const input = api.branches.create.input.parse(req.body);
      const branch = await storage.createBranch(input);
      res.json(branch);
    } catch (error) {
      res.status(500).json({ message: "Failed to create branch" });
    }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const { categoryId, search } = req.query;
      const products = await storage.getProducts(
        categoryId ? Number(categoryId) : undefined,
        search as string
      );
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Inventory
  app.get("/api/inventory", async (req, res) => {
    try {
      const { branchId } = req.query;
      const inventory = await storage.getInventory(
        branchId ? Number(branchId) : undefined
      );
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  return httpServer;
}
