# Optika CRM - Optical Store Management System

## Overview

This is a multi-branch Optical Store CRM/ERP system built for managing optical retail operations in Uzbekistan. The system handles client management with eye prescription history, inventory tracking across branches, point-of-sale, shipments/transfers between branches, expense tracking, employee KPI, and audit logging. The UI is entirely in Uzbek language with a professional medical blue/white theme.

The project follows a monorepo structure with three main directories:
- `client/` — React SPA frontend
- `server/` — Express.js backend API
- `shared/` — Shared schemas, types, and route definitions used by both client and server

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state; no global client state library
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Charts**: Recharts for dashboard analytics
- **Forms**: React Hook Form with Zod resolvers for validation
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`
- **Language**: All user-facing text is in Uzbek

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript, executed via `tsx` in development
- **API Pattern**: RESTful JSON API under `/api/*` prefix
- **Authentication**: Passport.js with Local Strategy (username/password), sessions stored in PostgreSQL via `connect-pg-simple`
- **Authorization**: Role-based access control (RBAC) with middleware `requireRole()`. Four roles: `admin`, `manager`, `sales`, `optometrist`
- **Password Hashing**: bcryptjs
- **Data Sanitization**: Role-based response shaping (e.g., hiding cost prices from sales role)
- **Build**: esbuild bundles server to `dist/index.cjs` for production; Vite builds client to `dist/public/`

### Shared Layer
- `shared/schema.ts` — All Drizzle ORM table definitions and Zod insert schemas
- `shared/routes.ts` — Typed API route definitions (paths, methods, input/output schemas) used by both client hooks and server handlers
- `shared/models/auth.ts` — User and session table definitions

### Database
- **Database**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema Management**: `drizzle-kit push` for schema sync (no migration files approach)
- **Session Storage**: PostgreSQL `sessions` table (created by connect-pg-simple or schema)

### Key Database Tables
- `users` — Staff with roles, branch assignment, salary/commission fields
- `branches` — Store locations with discount limits
- `categories` — Product categories
- `products` — Items with price, cost price, SKU, supplier info
- `inventory` — Per-branch stock quantities
- `inventory_movements` — Audit trail for all inventory changes (sales, transfers, adjustments)
- `clients` — Customer records
- `prescriptions` — Eye prescription history (SPH, CYL, AXIS, PD)
- `sales` / `sale_items` — Sales transactions with line items
- `sale_returns` — Refund/return records
- `expenses` — Branch-level expense tracking
- `shipments` / `shipment_items` — Inter-branch inventory transfers
- `employee_kpi` — Performance tracking
- `audit_logs` — System action audit trail
- `sessions` — Express session storage

### Business Logic
- Inventory automatically decreases on sale and increases on return, all within DB transactions
- Negative stock protection prevents selling more than available
- Inter-branch transfers decrement source and increment destination atomically
- Sales use server-side product prices (not client-submitted prices) to prevent price manipulation
- Discount limits are enforced per-branch configuration
- Audit logs track sensitive operations (discounts, inventory changes)

### Development vs Production
- **Dev**: Vite dev server with HMR proxied through Express; `tsx` runs TypeScript directly
- **Prod**: Vite builds static assets to `dist/public/`; esbuild bundles server to `dist/index.cjs`; Express serves static files via `serveStatic()`

## External Dependencies

### Required Services
- **PostgreSQL Database**: Must be provisioned and connection string set in `DATABASE_URL` environment variable
- **Session Secret**: `SESSION_SECRET` environment variable for Express session encryption

### Key npm Packages
- **Server**: express, passport, passport-local, bcryptjs, drizzle-orm, connect-pg-simple, express-session, zod
- **Client**: react, wouter, @tanstack/react-query, recharts, react-hook-form, @hookform/resolvers, date-fns
- **UI**: Full shadcn/ui component suite (@radix-ui/* primitives, tailwindcss, class-variance-authority, clsx, cmdk, lucide-react)
- **Build**: vite, esbuild, tsx, drizzle-kit

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` — Runtime error overlay in development
- `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` — Dev-only Replit integration plugins
- There is a `server/replit_integrations/` directory with an alternative auth setup; the primary auth used is in `server/auth.ts` with Passport Local Strategy