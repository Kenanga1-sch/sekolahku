const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/sekolahku.db');
console.log('Opening database at:', dbPath);

const db = new Database(dbPath);

try {
  console.log('Applying schema updates...');

  // Add filePath column
  try {
    db.prepare(`ALTER TABLE letter_templates ADD COLUMN file_path text`).run();
    console.log('Added file_path column.');
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log('Column file_path already exists.');
    } else {
      throw error;
    }
  }

  // Add type column
  try {
    db.prepare(`ALTER TABLE letter_templates ADD COLUMN type text DEFAULT 'EDITOR' NOT NULL`).run();
    console.log('Added type column.');
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log('Column type already exists.');
    } else {
      throw error;
    }
  }

  console.log('Schema update complete.');
} catch (error) {
  console.error('Error updating schema:', error);
  process.exit(1);
}
