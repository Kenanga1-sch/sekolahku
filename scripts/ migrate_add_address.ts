import Database from 'better-sqlite3';

const db = new Database('./data/sekolahku.db');

const alterTableSql = `ALTER TABLE "mutasi_requests" ADD "origin_school_address" text;`;

console.log("Applying manual migration for origin_school_address...");

try {
    const tableInfo = db.prepare("PRAGMA table_info(mutasi_requests)").all() as any[];
    if (!tableInfo.some(c => c.name === 'origin_school_address')) {
        db.exec(alterTableSql);
        console.log("Column origin_school_address added to mutasi_requests.");
    } else {
        console.log("Column origin_school_address already exists.");
    }
} catch (e: any) {
    console.error("Error creating column:", e.message);
}

const check = db.prepare("PRAGMA table_info(mutasi_requests)").all();
console.log("Current columns:", check);

console.log("Migration finished.");
