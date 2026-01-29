import Database from 'better-sqlite3';

const db = new Database('./data/sekolahku.db');

try {
  const table = db.prepare("PRAGMA table_info(student_classes)").all();
  console.log('student_classes columns:', table);
  
  const capacityExists = table.some((col: any) => col.name === 'capacity');
  console.log('Capacity column exists:', capacityExists);

} catch (e) {
  console.error('Error reading schema:', e);
}

try {
  // Check if mutasi_requests table exists
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mutasi_requests'").get();
  console.log('mutasi_requests table exists:', !!table);
} catch (e) {
  console.error('Error reading table:', e);
}
