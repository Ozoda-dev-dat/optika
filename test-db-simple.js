import { db } from './server/db.ts';
import { categories } from './shared/schema-sqlite.ts';

async function testDB() {
  try {
    console.log('Testing database connection...');
    const result = await db.select().from(categories);
    console.log('Categories count:', result.length);
    console.log('First category:', result[0]);
  } catch (error) {
    console.error('Database error:', error);
  }
}

testDB();
