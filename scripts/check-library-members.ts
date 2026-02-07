
import { db } from "../db";
import { libraryMembers } from "../db/schema/library";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.select({ count: sql<number>`count(*)` }).from(libraryMembers);
  console.log(`Total Library Members: ${result[0].count}`);
  
  if (result[0].count > 0) {
    const samples = await db.select().from(libraryMembers).limit(5);
    console.log("Sample Members:", samples);
  }
}

main().catch(console.error).finally(() => process.exit(0));
