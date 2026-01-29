const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve('data/sekolahku.db');

try {
  const db = new Database(dbPath);
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name = 'finance_transactions' AND type = 'table'").get();
  console.log('SQL:', row ? row.sql : 'Table not found');
} catch (error) {
  console.error('Error:', error);
}
