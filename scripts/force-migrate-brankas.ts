
import Database from "better-sqlite3";

const sqlite = new Database("data/sekolahku.db");

const dropSql = `DROP TABLE IF EXISTS "tabungan_brankas";`;

const createSql = `
CREATE TABLE "tabungan_brankas" (
    "id" text PRIMARY KEY NOT NULL,
    "nama" text NOT NULL,
    "saldo" integer DEFAULT 0 NOT NULL,
    "pic_id" text REFERENCES "users"("id"),
    "updated_at" integer
);
`;

try {
    console.log("Dropping old table...");
    sqlite.exec(dropSql);
    console.log("Creating new table...");
    sqlite.exec(createSql);
    console.log("Success: Table recreated.");
} catch (e) {
    console.error("Migration failed:", e);
}
