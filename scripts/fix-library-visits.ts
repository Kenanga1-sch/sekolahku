
import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔧 Fixing library_visits table - adding missing columns...");

  try {
    // Add guest_name column
    console.log("Adding guest_name column...");
    db.run(sql`ALTER TABLE library_visits ADD COLUMN guest_name TEXT`);
    console.log("✅ guest_name added");
  } catch (e: any) {
    if (e.message?.includes("duplicate column name")) {
      console.log("ℹ️ guest_name already exists");
    } else {
      console.error("Error adding guest_name:", e.message);
    }
  }

  try {
    // Add institution column
    console.log("Adding institution column...");
    db.run(sql`ALTER TABLE library_visits ADD COLUMN institution TEXT`);
    console.log("✅ institution added");
  } catch (e: any) {
    if (e.message?.includes("duplicate column name")) {
      console.log("ℹ️ institution already exists");
    } else {
      console.error("Error adding institution:", e.message);
    }
  }

  try {
    // Add purpose column
    console.log("Adding purpose column...");
    db.run(sql`ALTER TABLE library_visits ADD COLUMN purpose TEXT`);
    console.log("✅ purpose added");
  } catch (e: any) {
    if (e.message?.includes("duplicate column name")) {
      console.log("ℹ️ purpose already exists");
    } else {
      console.error("Error adding purpose:", e.message);
    }
  }

  console.log("✨ Library visits table fix complete!");
}

main().catch(console.error).finally(() => process.exit(0));
