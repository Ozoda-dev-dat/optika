import { db } from './server/db.ts';
import { branches } from './shared/schema-sqlite.ts';

async function testDatabase() {
  try {
    console.log("Testing database connection...");
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    
    // Test a simple query
    const result = await db.select().from(branches);
    console.log("Database query successful, found branches:", result.length);
    console.log("Branches:", result);
    
  } catch (error) {
    console.error("Database error:", error);
  }
}

testDatabase().then(() => {
  console.log("Test complete");
  process.exit(0);
}).catch(console.error);
