const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/sekolahku.db');
const db = new Database(dbPath);

console.log('Migrating loans table...');

try {
    // 1. Rename existing table
    db.prepare("ALTER TABLE loans RENAME TO loans_old").run();

    // 2. Create new table with updated schema
    // Note: ensure this matches the Drizzle schema exactly
    db.prepare(`
        CREATE TABLE IF NOT EXISTS loans (
            id TEXT PRIMARY KEY,
            employee_detail_id TEXT,
            borrower_type TEXT DEFAULT 'EMPLOYEE' NOT NULL,
            borrower_name TEXT,
            description TEXT,
            type TEXT NOT NULL,
            amount_requested REAL NOT NULL,
            amount_approved REAL,
            tenor_months INTEGER NOT NULL,
            admin_fee REAL DEFAULT 0,
            status TEXT DEFAULT 'PENDING',
            rejection_reason TEXT,
            notes TEXT,
            disbursed_at INTEGER,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY (employee_detail_id) REFERENCES employee_details(id)
        )
    `).run();

    // 3. Copy data
    // Map existing columns. existing rows are all EMPLOYEE type.
    db.prepare(`
        INSERT INTO loans (
            id, employee_detail_id, borrower_type, type, amount_requested, amount_approved, 
            tenor_months, admin_fee, status, rejection_reason, notes, disbursed_at, created_at, updated_at
        )
        SELECT 
            id, employee_detail_id, 'EMPLOYEE', type, amount_requested, amount_approved,
            tenor_months, admin_fee, status, rejection_reason, notes, disbursed_at, created_at, updated_at
        FROM loans_old
    `).run();

    // 4. Recreate Indexes
    db.prepare("CREATE INDEX IF NOT EXISTS idx_loans_employee ON loans (employee_detail_id)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_loans_status ON loans (status)").run();

    // 5. Drop old table
    db.prepare("DROP TABLE loans_old").run();

    console.log('Migration successful.');

} catch (error) {
    console.error('Migration failed:', error);
    // Attempt rollback if table was renamed but not dropped?
    // For now simple script.
}
