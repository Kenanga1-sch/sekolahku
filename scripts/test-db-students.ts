
import { db, students, studentClasses } from "../db";
import { eq } from "drizzle-orm";

async function run() {
    console.log("Testing Students Query...");
    try {
        const data = await db.select({
            student: students,
            className: studentClasses.name
        })
        .from(students)
        .leftJoin(studentClasses, eq(students.classId, studentClasses.id))
        .limit(1);

        console.log("Query Success:", data);
    } catch (error) {
        console.error("Query Failed:", error);
    }
}

run();
