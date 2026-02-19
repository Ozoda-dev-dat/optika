import { db } from "./db";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function initDatabase() {
  try {
    console.log("Initializing database...");
    
    // Run migrations
    await migrate(db, { migrationsFolder: "./migrations" });
    
    console.log("Database initialized successfully!");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

initDatabase().then(() => {
  console.log("Database setup complete");
  process.exit(0);
}).catch(console.error);
