import Database from 'better-sqlite3';

const db = new Database('./data/sekolahku.db');

const createTableSql = `CREATE TABLE IF NOT EXISTS "mutasi_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"registration_number" text NOT NULL,
	"student_name" text NOT NULL,
	"nisn" text NOT NULL,
	"gender" text NOT NULL,
	"origin_school" text NOT NULL,
	"target_grade" integer NOT NULL,
	"target_class_id" text,
	"parent_name" text NOT NULL,
	"whatsapp_number" text NOT NULL,
	"status_approval" text DEFAULT 'pending' NOT NULL,
	"status_delivery" text DEFAULT 'unsent' NOT NULL,
	"created_at" integer,
	"updated_at" integer,
	FOREIGN KEY ("target_class_id") REFERENCES "student_classes"("id") ON UPDATE no action ON DELETE no action
);`;

const indicesSql = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "mutasi_requests_registration_number_unique" ON "mutasi_requests" ("registration_number");`,
    `CREATE INDEX IF NOT EXISTS "idx_mutasi_status" ON "mutasi_requests" ("status_approval");`,
    `CREATE INDEX IF NOT EXISTS "idx_mutasi_created" ON "mutasi_requests" ("created_at");`
];

const alterTableSql = `ALTER TABLE "student_classes" ADD "capacity" integer DEFAULT 28 NOT NULL;`;

console.log("Applying manual migration...");

try {
    db.exec(createTableSql);
    console.log("Table mutasi_requests created/verified.");
} catch (e: any) {
    console.error("Error creating mutasi_requests:", e.message);
}

for (const indexSql of indicesSql) {
    try {
        db.exec(indexSql);
        console.log("Index created.");
    } catch (e: any) {
        console.error("Error creating index:", e.message);
    }
}

try {
    // Check if column exists first to avoid error spam
    const tableInfo = db.prepare("PRAGMA table_info(student_classes)").all() as any[];
    if (!tableInfo.some(c => c.name === 'capacity')) {
        db.exec(alterTableSql);
        console.log("Column capacity added to student_classes.");
    } else {
        console.log("Column capacity already exists in student_classes.");
    }
} catch (e: any) {
    console.error("Error creating capacity column:", e.message);
}

console.log("Manual migration finished.");
