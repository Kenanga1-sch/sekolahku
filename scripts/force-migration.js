const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/sekolahku.db');
const db = new Database(dbPath);

console.log('Force adding tipe column...');
try {
    db.prepare("ALTER TABLE tabungan_brankas ADD COLUMN tipe TEXT DEFAULT 'cash' NOT NULL").run();
    console.log('Success.');
} catch (e) {
    console.log('Error (might already exist):', e.message);
}

const info = db.prepare("PRAGMA table_info(tabungan_brankas)").all();
console.log('Updated info:', info);
