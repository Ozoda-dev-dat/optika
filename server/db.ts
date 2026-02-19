import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../shared/schema-sqlite";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const sqlitePath = process.env.DATABASE_URL.replace("sqlite:", "");
const sqlite = new Database(sqlitePath);

export const db = drizzle(sqlite, { schema });
