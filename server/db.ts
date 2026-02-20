import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../shared/schema";

// Render’da .env shart emas, lekin localda ishlatsangiz bo‘ladi
// import dotenv from "dotenv";
// dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon/Render’da ko‘pincha kerak bo‘ladi
});

export const db = drizzle(pool, { schema });
