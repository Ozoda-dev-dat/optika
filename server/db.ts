import { drizzle } from "drizzle-orm/better-sqlite3";
import * as Database from "better-sqlite3";
import * as schema from "../shared/schema-sqlite";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sqlite = new (Database as any)(process.env.DATABASE_URL.replace('sqlite:', ''));
export const db = drizzle(sqlite, { schema });

// Run migrations later when needed
// migrate(db, { migrationsFolder: './drizzle' });
