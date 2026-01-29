const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve('data/sekolahku.db');

try {
  const db = new Database(dbPath);
  console.log("Recreating Finance Tables...");

  // Drop in reverse order of dependencies
  db.prepare("DROP TABLE IF EXISTS finance_transactions").run();
  db.prepare("DROP TABLE IF EXISTS finance_categories").run();
  db.prepare("DROP TABLE IF EXISTS finance_accounts").run();
  console.log("- Old tables dropped.");

  // 1. Finance Accounts
  db.prepare(`
    CREATE TABLE finance_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_number TEXT,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `).run();
  console.log("- finance_accounts created.");

  // 2. Finance Categories
  db.prepare(`
    CREATE TABLE finance_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      is_system INTEGER DEFAULT 0
    )
  `).run();
  console.log("- finance_categories created.");

  // 3. Finance Transactions
  // Note: timestamps are handled by app logic or default if needed. 
  // FKs must match exactly.
  db.prepare(`
    CREATE TABLE finance_transactions (
      id TEXT PRIMARY KEY,
      date INTEGER NOT NULL,
      type TEXT NOT NULL,
      
      account_id_source TEXT REFERENCES finance_accounts(id),
      account_id_dest TEXT REFERENCES finance_accounts(id),
      category_id TEXT REFERENCES finance_categories(id),
      
      amount REAL NOT NULL,
      description TEXT,
      proof_image TEXT,
      
      status TEXT DEFAULT 'APPROVED' NOT NULL,
      
      ref_table TEXT,
      ref_id TEXT,
      
      created_by TEXT REFERENCES users(id),
      created_at INTEGER
    )
  `).run();
  console.log("- finance_transactions created.");

  console.log("All finance tables recreated successfully.");

} catch (error) {
  console.error('Error:', error);
}
