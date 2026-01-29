
import Database from "better-sqlite3";
const db = new Database("data/sekolahku.db");

console.log("Fixing Database Schema...");

// 1. Create student_classes table
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS "student_classes" (
            "id" text PRIMARY KEY NOT NULL,
            "name" text NOT NULL,
            "grade" integer NOT NULL,
            "academic_year" text NOT NULL,
            "teacher_name" text,
            "capacity" integer DEFAULT 28 NOT NULL,
            "is_active" integer DEFAULT 1 NOT NULL,
            "created_at" integer,
            "updated_at" integer
        )
    `).run();
    console.log("✅ Table student_classes ensured.");
} catch (e) {
    console.error("Error creating student_classes:", e);
}

// 2. Add columns to students table if missing
const columnsToAdd = [
    { name: "nik", type: "text" },
    { name: "father_name", type: "text" },
    { name: "father_nik", type: "text" },
    { name: "mother_name", type: "text" },
    { name: "mother_nik", type: "text" },
    { name: "guardian_name", type: "text" },
    { name: "guardian_nik", type: "text" },
    { name: "guardian_job", type: "text" },
    { name: "parent_phone", type: "text" },
    { name: "class_id", type: "text" }, // Important for join
    { name: "meta_data", type: "text" },
    { name: "birth_place", type: "text" },
    { name: "religion", type: "text" }
];

const currentColumns = db.prepare("PRAGMA table_info(students)").all().map((c: any) => c.name);

for (const col of columnsToAdd) {
    if (!currentColumns.includes(col.name)) {
        try {
            db.prepare(`ALTER TABLE "students" ADD COLUMN "${col.name}" ${col.type}`).run();
            console.log(`✅ Added column ${col.name} to students.`);
        } catch (e) {
            console.error(`Error adding column ${col.name}:`, e);
        }
    }
}

// 3. Create student_history table (was also asked by drizzle-kit)
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS "student_history" (
            "id" text PRIMARY KEY NOT NULL,
            "student_id" text NOT NULL,
            "type" text NOT NULL,
            "description" text NOT NULL,
            "date" integer NOT NULL,
            "meta" text,
            "created_at" integer
        )
    `).run();
    console.log("✅ Table student_history ensured.");
} catch (e) {
     console.error("Error creating student_history:", e);
}

// 4. Create student_documents table
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS "student_documents" (
            "id" text PRIMARY KEY NOT NULL,
            "student_id" text NOT NULL,
            "type" text NOT NULL,
            "file_url" text NOT NULL,
            "uploaded_at" integer
        )
    `).run();
    console.log("✅ Table student_documents ensured.");
} catch (e) {
     console.error("Error creating student_documents:", e);
}

console.log("Schema fix completed.");
