import sqlite3 from 'better-sqlite3';

const db = new sqlite3('./uzbek-optics.db');

console.log('=== CATEGORIES TABLE SCHEMA ===');
const categoriesSchema = db.prepare('PRAGMA table_info(categories)').all();
console.log(JSON.stringify(categoriesSchema, null, 2));

console.log('\n=== BRANCHES TABLE SCHEMA ===');
const branchesSchema = db.prepare('PRAGMA table_info(branches)').all();
console.log(JSON.stringify(branchesSchema, null, 2));

console.log('\n=== PRODUCTS TABLE SCHEMA ===');
const productsSchema = db.prepare('PRAGMA table_info(products)').all();
console.log(JSON.stringify(productsSchema, null, 2));

console.log('\n=== INVENTORY TABLE SCHEMA ===');
const inventorySchema = db.prepare('PRAGMA table_info(inventory)').all();
console.log(JSON.stringify(inventorySchema, null, 2));

db.close();
