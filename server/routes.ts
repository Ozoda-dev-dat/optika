import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage-simple";
import { z } from "zod";
import { setupAuth } from "./auth";
import {
  insertBranchSchema,
  insertCategorySchema,
  insertProductSchema,
} from "@shared/schema";

// RBAC Middleware
function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // passport qo'shgandan keyin req.isAuthenticated bo'ladi
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // @ts-ignore
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res
        .status(403)
        .json({ message: "Forbidden: Insufficient permissions" });
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
          errors: error.errors,
        });
      }
      next(error);
    }
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Auth Setup
  setupAuth(app);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // -------------------------
  // Branches
  // -------------------------
  app.get("/api/branches", async (_req, res) => {
    try {
      console.log("GET /api/branches called");
      const allBranches = await storage.getBranches();
      console.log("Branches retrieved:", allBranches.length);
      res.json(allBranches);
    } catch (error) {
      console.error("Error in GET /api/branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  app.post(
    "/api/branches",
    requireRole(["admin"]),
    validateInput(insertBranchSchema),
    async (req, res) => {
      try {
        const branch = await storage.createBranch(req.body);
        res.json(branch);
      } catch (error) {
        console.error("Error in POST /api/branches:", error);
        res.status(500).json({ message: "Failed to create branch" });
      }
    },
  );

  app.delete("/api/branches/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid branch id" });
      }

      await storage.deleteBranch(id);
      res.json({ message: "Branch deleted successfully" });
    } catch (error) {
      console.error("Error in DELETE /api/branches/:id:", error);
      res.status(500).json({ message: "Failed to delete branch" });
    }
  });

  // -------------------------
  // Categories
  // -------------------------
  app.get("/api/categories", async (_req, res) => {
    try {
      console.log("GET /api/categories called");
      const cats = await storage.getCategories();
      console.log("Categories retrieved:", cats.length);
      res.json(cats);
    } catch (error) {
      console.error("Error in GET /api/categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post(
    "/api/categories",
    requireRole(["admin"]),
    validateInput(insertCategorySchema),
    async (req, res) => {
      try {
        const category = await storage.createCategory(req.body);
        res.json(category);
      } catch (error) {
        console.error("Error in POST /api/categories:", error);
        res.status(500).json({ message: "Failed to create category" });
      }
    },
  );

  app.delete("/api/categories/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid category id" });
      }

      await storage.deleteCategory(id);
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error in DELETE /api/categories/:id:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // -------------------------
  // Products
  // -------------------------
  app.get("/api/products", async (req, res) => {
    try {
      const { categoryId, search } = req.query;

      const list = await storage.getProducts(
        categoryId ? Number(categoryId) : undefined,
        typeof search === "string" ? search : undefined,
      );

      res.json(list);
    } catch (error) {
      console.error("Error in GET /api/products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // CREATE product
  app.post(
    "/api/products",
    requireRole(["admin"]),
    async (req, res) => {
      try {
        // insert schema bilan tekshiramiz
        const data = insertProductSchema.parse(req.body);

        // cost/costPrice normalize (UI cost yuborsa ham ishlasin)
        const normalized: any = {
          ...data,
          costPrice: (data as any).costPrice ?? (data as any).cost,
        };
        delete normalized.cost;

        const created = await storage.createProduct(normalized);
        res.json(created);
      } catch (error: any) {
        console.error("Error in POST /api/products:", error);

        if (error?.name === "ZodError") {
          return res.status(400).json({
            message: "Validation failed",
            errors: error.errors,
          });
        }

        res.status(500).json({ message: "Failed to create product" });
      }
    },
  );

  // UPDATE product
  app.put(
    "/api/products/:id",
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ message: "Invalid product id" });
        }

        // update schema: partial
        const updateSchema = insertProductSchema.partial();
        const data = updateSchema.parse(req.body);

        // @ts-ignore
        const userId = req.user?.id as string | undefined;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const normalized: any = {
          ...data,
          costPrice: (data as any).costPrice ?? (data as any).cost,
        };
        delete normalized.cost;

        const updated = await storage.updateProduct(
          id,
          normalized,
          userId,
          (req.body as any)?.reason,
        );

        res.json(updated);
      } catch (error: any) {
        console.error("Error in PUT /api/products/:id:", error);

        if (error?.name === "ZodError") {
          return res.status(400).json({
            message: "Validation failed",
            errors: error.errors,
          });
        }

        res.status(500).json({ message: "Failed to update product" });
      }
    },
  );

  // DELETE product
  app.delete("/api/products/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid product id" });
      }

      await storage.deleteProduct(id);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error in DELETE /api/products/:id:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // -------------------------
  // Inventory
  // -------------------------
  app.get("/api/inventory", async (req, res) => {
    try {
      const { branchId, search } = req.query;

      const items = await storage.getInventory(
        branchId ? Number(branchId) : undefined,
        typeof search === "string" ? search : undefined,
      );

      res.json(items);
    } catch (error) {
      console.error("Error in GET /api/inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  // -------------------------
  // 404 handler (API)
  // -------------------------
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "API route not found" });
  });

  // -------------------------
  // Global error handler
  // -------------------------
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  });

  return httpServer;
}
