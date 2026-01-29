
import { db } from "@/db";
import { students } from "@/db/schema/students";

async function main() {
    const count = await db.select().from(students).limit(5);
    console.log("Total Students found:", count.length);
    console.log("Sample Data:", count);
}
main().catch(console.error).finally(() => process.exit(0));
