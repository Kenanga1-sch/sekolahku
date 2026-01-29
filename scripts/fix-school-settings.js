const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/sekolahku.db');
const db = new Database(dbPath);

const columnsToAdd = [
  { name: 'is_maintenance', type: 'INTEGER DEFAULT 0' },
  { name: 'last_letter_number', type: 'INTEGER DEFAULT 0' },
  { name: 'letter_number_format', type: "TEXT DEFAULT '421/{nomor}/SDN1-KNG/{bulan}/{tahun}'" },
  { name: 'savings_treasurer_id', type: 'TEXT' } // Already added but good to keep in list
];

console.log('Checking school_settings columns...');

try {
  const currentColumns = db.prepare("PRAGMA table_info(school_settings)").all().map(c => c.name);
  console.log('Current columns:', currentColumns);

  for (const col of columnsToAdd) {
    if (!currentColumns.includes(col.name)) {
      console.log(`Adding column: ${col.name}...`);
      try {
        db.prepare(`ALTER TABLE school_settings ADD COLUMN ${col.name} ${col.type}`).run();
        console.log(`Successfully added ${col.name}`);
      } catch (e) {
        console.error(`Failed to add ${col.name}:`, e.message);
      }
    } else {
      console.log(`Column ${col.name} already exists.`);
    }
  }

  console.log('Schema repair complete.');
} catch (error) {
  console.error('Error:', error);
}
