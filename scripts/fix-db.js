const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve('data/sekolahku.db');

try {
  const db = new Database(dbPath);
  console.log("Creating Index manually...");
  db.prepare("CREATE INDEX IF NOT EXISTS idx_transaksi_setoran ON tabungan_transaksi (setoran_id)").run();
  console.log("Index created successfully.");
} catch (error) {
  console.error('Error:', error);
}
