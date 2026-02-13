import { z } from 'zod';
import { 
  insertBranchSchema, 
  insertCategorySchema, 
  insertProductSchema, 
  insertClientSchema, 
  insertPrescriptionSchema,
  insertExpenseSchema,
  SaleInputSchema,
  branches,
  categories,
  products,
  clients,
  prescriptions,
  sales,
  expenses
} from './schema';

export type { Branch, SaleInput, Category, Product, Inventory, Client, Prescription, Sale, SaleItem, Expense, InventoryMovement, EmployeeKpi } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  branches: {
    list: {
      method: 'GET' as const,
      path: '/api/branches',
      responses: {
        200: z.array(z.custom<typeof branches.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/branches',
      input: insertBranchSchema,
      responses: {
        201: z.custom<typeof branches.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories',
      responses: {
        200: z.array(z.custom<typeof categories.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/categories',
      input: insertCategorySchema,
      responses: {
        201: z.custom<typeof categories.$inferSelect>(),
      },
    },
  },
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products',
      input: z.object({
        categoryId: z.string().optional(),
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products',
      input: insertProductSchema,
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
      },
    },
  },
  inventory: {
    list: {
      method: 'GET' as const,
      path: '/api/inventory',
      input: z.object({
        branchId: z.string().optional(),
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.any()),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/inventory/update',
      input: z.object({
        productId: z.number(),
        branchId: z.number(),
        quantity: z.number(),
      }),
      responses: {
        200: z.any(),
      },
    },
  },
  clients: {
    list: {
      method: 'GET' as const,
      path: '/api/clients',
      input: z.object({
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof clients.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/clients/:id',
      responses: {
        200: z.custom<typeof clients.$inferSelect & { prescriptions: typeof prescriptions.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/clients',
      input: insertClientSchema,
      responses: {
        201: z.custom<typeof clients.$inferSelect>(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/clients/:id',
      input: insertClientSchema.partial(),
      responses: {
        200: z.custom<typeof clients.$inferSelect>(),
      },
    },
    addPrescription: {
      method: 'POST' as const,
      path: '/api/clients/:id/prescriptions',
      input: insertPrescriptionSchema.omit({ clientId: true }),
      responses: {
        201: z.custom<typeof prescriptions.$inferSelect>(),
      },
    },
  },
  sales: {
    create: {
      method: 'POST' as const,
      path: '/api/sales',
      input: SaleInputSchema,
      responses: {
        201: z.custom<typeof sales.$inferSelect>(),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/sales',
      input: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        branchId: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.any()),
      },
    },
  },
  expenses: {
    list: {
      method: 'GET' as const,
      path: '/api/expenses',
      input: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof expenses.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/expenses',
      input: insertExpenseSchema,
      responses: {
        201: z.custom<typeof expenses.$inferSelect>(),
      },
    },
  },
  reports: {
    dashboard: {
      method: 'GET' as const,
      path: '/api/reports/dashboard',
      responses: {
        200: z.object({
          dailySales: z.number(),
          monthlySales: z.number(),
          totalClients: z.number(),
          lowStockCount: z.number(),
          topProducts: z.array(z.any()),
          totalProfit: z.number(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
