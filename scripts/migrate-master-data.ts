
import Database from "better-sqlite3";

const db = new Database("data/sekolahku.db");

console.log("Starting Master Data Migration...");

try {
    // 1. Update STUDENTS table
    const columns = [
        "nik TEXT UNIQUE",
        "religion TEXT",
        "status TEXT DEFAULT 'active' NOT NULL",
        "class_id TEXT REFERENCES student_classes(id)",
        "father_name TEXT",
        "father_nik TEXT",
        "mother_name TEXT",
        "mother_nik TEXT",
        "guardian_name TEXT",
        "guardian_nik TEXT",
        "guardian_job TEXT",
        "meta_data TEXT" // JSON
    ];

    for (const col of columns) {
        try {
            const colName = col.split(" ")[0];
            db.prepare(`ALTER TABLE students ADD COLUMN ${col}`).run();
            console.log(`Added column: ${colName}`);
        } catch (e: any) {
            if (e.message.includes("duplicate column name")) {
                console.log(`Column exists: ${col.split(" ")[0]}`);
            } else {
                console.error(`Error adding ${col.split(" ")[0]}:`, e.message);
            }
        }
    }

    // 2. Create ACADEMIC_YEARS
    db.prepare(`
    CREATE TABLE IF NOT EXISTS academic_years (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        semester TEXT NOT NULL,
        is_active INTEGER DEFAULT 0 NOT NULL,
        start_date TEXT,
        end_date TEXT,
        created_at INTEGER,
        updated_at INTEGER
    )`).run();
    console.log("Created table: academic_years");

    // 3. Create SUBJECTS
    db.prepare(`
    CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER,
        updated_at INTEGER
    )`).run();
    console.log("Created table: subjects");

    // 4. Create EMPLOYEE_DETAILS
    db.prepare(`
    CREATE TABLE IF NOT EXISTS employee_details (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        nip TEXT,
        nuptk TEXT,
        nik TEXT,
        employment_status TEXT,
        job_type TEXT,
        join_date TEXT,
        is_homeroom INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
    )`).run();
    
    // Create Index for employee_details
    try {
        db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_user_id ON employee_details(user_id)`).run();
    } catch (e) {}

    console.log("Created table: employee_details");

    console.log("Migration completed successfully.");

} catch (error) {
    console.error("Migration failed:", error);
}
