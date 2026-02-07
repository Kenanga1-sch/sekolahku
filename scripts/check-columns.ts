
import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Checking columns for library tables...");

  const tables = ["library_loans", "library_assets"];

  for (const table of tables) {
    console.log(`\nTable: ${table}`);
    const columns = await db.all(sql`PRAGMA table_info(${sql.raw(table)})`);
    columns.forEach((col: any) => {
      console.log(`- ${col.name} (${col.type})`);
    });
  }
}

main().catch(console.error).finally(() => process.exit(0));
