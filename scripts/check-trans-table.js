const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/sekolahku.db');
const db = new Database(dbPath);

const info = db.prepare("PRAGMA table_info(tabungan_brankas_transaksi)").all();
console.log('Trans Table:', JSON.stringify(info, null, 2));
