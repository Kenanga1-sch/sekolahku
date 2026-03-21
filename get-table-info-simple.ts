import Database from 'better-sqlite3';
const db = new Database('D:/antigravity/sekolahku/data/sekolahku.db');
try {
const info = db.prepare("PRAGMA table_info(students)").all();
for (const col of info) {
  console.log(`${col.cid}: ${col.name} | ${col.type} | PK: ${col.pk}`);
}
} catch (err) { console.error(err); } finally { db.close(); }
