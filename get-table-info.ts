import Database from 'better-sqlite3';
const db = new Database('D:/antigravity/sekolahku/data/sekolahku.db');
try {
  const info = db.prepare("PRAGMA table_info(students)").all();
  console.log(JSON.stringify(info, null, 2));
} catch (err) {
  console.error(err);
} finally {
  db.close();
}
