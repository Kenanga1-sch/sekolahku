const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/sekolahku.db');
const db = new Database(dbPath);

const tableInfo = db.prepare("PRAGMA table_info(tabungan_brankas)").all();
console.log(JSON.stringify(tableInfo, null, 2));
