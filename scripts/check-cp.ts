
import { db } from "@/db";
import { curriculumCp } from "@/db/schema/curriculum";
import { count } from "drizzle-orm";

async function main() {
  try {
    const res = await db.select({ count: count() }).from(curriculumCp);
    console.log("CP Count:", res[0].count);
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
