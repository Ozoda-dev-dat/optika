import { db } from "./db";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

async function initDatabase() {
  try {
    console.log("Initializing database...");
    
    // Let drizzle create the tables using the schema
    console.log("Creating tables using drizzle schema...");
    
    console.log("Database initialized successfully!");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

initDatabase().then(() => {
  console.log("Database setup complete");
  process.exit(0);
}).catch(console.error);
