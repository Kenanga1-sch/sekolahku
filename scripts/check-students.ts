
import { db, students } from "@/db";
import { isNull, sql } from "drizzle-orm";

async function checkStudents() {
    const unassigned = await db.select({ count: sql<number>`count(*)` })
        .from(students)
        .where(isNull(students.classId));
    
    console.log("Unassigned Students:", unassigned[0].count);
}

checkStudents();
