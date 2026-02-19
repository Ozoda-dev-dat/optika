import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

async function initDatabase() {
  try {
    console.log("Initializing database...");
    
    // Create direct database connection
    const sqlite = new Database(process.env.DATABASE_URL.replace('sqlite:', ''));
    
    // Create branches table with correct column names
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        is_warehouse INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT,
        description TEXT,
        category_id INTEGER,
        price REAL NOT NULL,
        cost REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);
    
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        branch_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        UNIQUE(product_id, branch_id)
      )
    `);
    
    sqlite.close();
    console.log("Database initialized successfully!");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

initDatabase().then(() => {
  console.log("Database setup complete");
  process.exit(0);
}).catch(console.error);
