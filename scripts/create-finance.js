const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve('data/sekolahku.db');

try {
  const db = new Database(dbPath);
  console.log("Creating Finance Tables...");

  // 1. Finance Accounts
  db.prepare(`
    CREATE TABLE IF NOT EXISTS finance_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_number TEXT,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `).run();
  console.log("- finance_accounts created.");

  // 2. Finance Categories
  db.prepare(`
    CREATE TABLE IF NOT EXISTS finance_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      is_system INTEGER DEFAULT 0
    )
  `).run();
  console.log("- finance_categories created.");

  // 3. Finance Transactions
  db.prepare(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id TEXT PRIMARY KEY,
      date INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
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
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `).run();
  console.log("- finance_transactions created.");
  
  // Create Indexes on FKs if needed (optional but good for perf)
  // db.prepare("CREATE INDEX IF NOT EXISTS idx_finance_tx_date ON finance_transactions(date)").run();

  console.log("All finance tables created successfully.");

} catch (error) {
  console.error('Error:', error);
}
