const Database = require('better-sqlite3');
const path = require('path');
const { createId } = require('@paralleldrive/cuid2');

const dbPath = path.resolve(__dirname, '../data/sekolahku.db');
const db = new Database(dbPath);

console.log('Applying schema updates for Brankas...');

try {
  // 1. Add 'tipe' column to tabungan_brankas if not exists
  console.log('Checking tabungan_brankas columns...');
  const brankasCols = db.prepare("PRAGMA table_info(tabungan_brankas)").all().map(c => c.name);
  
  if (!brankasCols.includes('tipe')) {
    console.log('Adding tipe column to tabungan_brankas...');
    db.prepare("ALTER TABLE tabungan_brankas ADD COLUMN tipe TEXT DEFAULT 'cash' NOT NULL").run();
  } else {
    console.log('Column tipe already exists in tabungan_brankas.');
  }

  // 2. Create tabungan_brankas_transaksi table
  console.log('Creating tabungan_brankas_transaksi table...');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tabungan_brankas_transaksi (
      id TEXT PRIMARY KEY,
      tipe TEXT NOT NULL,
      nominal INTEGER NOT NULL,
      user_id TEXT,
      catatan TEXT,
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();

  // 3. Seed default Vaults if empty
  const vaults = db.prepare("SELECT * FROM tabungan_brankas").all();
  if (vaults.length === 0) {
      console.log('Seeding default vaults...');
      const insertVault = db.prepare("INSERT INTO tabungan_brankas (id, nama, tipe, saldo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
      const now = Date.now();
      insertVault.run(createId(), 'Kas Tunai (Pegangan)', 'cash', 0, now, now);
      insertVault.run(createId(), 'Rekening Bank', 'bank', 0, now, now);
      console.log('Default vaults created.');
  } else {
      // Ensure we have at least one cash and one bank
      const cashVault = vaults.find(v => v.tipe === 'cash' || v.nama.toLowerCase().includes('tunai'));
      const bankVault = vaults.find(v => v.tipe === 'bank' || v.nama.toLowerCase().includes('bank'));

      if (!cashVault) {
          console.log('Creating missing Cash vault...');
          db.prepare("INSERT INTO tabungan_brankas (id, nama, tipe, saldo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(createId(), 'Kas Tunai', 'cash', 0, Date.now(), Date.now());
      } else if (!cashVault.tipe) {
          // If existed but tipe was null (legacy), update it
          // Wait, we added column with default 'cash', so it should be fine. 
          // But strict check:
          if (cashVault.tipe !== 'cash') {
             db.prepare("UPDATE tabungan_brankas SET tipe = 'cash' WHERE id = ?").run(cashVault.id);
          }
      }

      if (!bankVault) {
          console.log('Creating missing Bank vault...');
          db.prepare("INSERT INTO tabungan_brankas (id, nama, tipe, saldo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(createId(), 'Rekening Bank', 'bank', 0, Date.now(), Date.now());
      }
  }

  console.log('Migration complete.');
} catch (error) {
  console.error('Migration failed:', error);
}
