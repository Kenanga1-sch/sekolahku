const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/sekolahku.db');
console.log('Opening database at:', dbPath);

const db = new Database(dbPath);

try {
  console.log('Applying schema updates for Savings Treasurer...');

  // Add savings_treasurer_id to school_settings
  try {
    db.prepare(`ALTER TABLE school_settings ADD COLUMN savings_treasurer_id text REFERENCES users(id)`).run();
    console.log('Added savings_treasurer_id column to school_settings.');
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log('Column savings_treasurer_id already exists.');
    } else {
      throw error;
    }
  }

  console.log('Migration complete.');
} catch (error) {
  console.error('Error applying migration:', error);
  process.exit(1);
}
