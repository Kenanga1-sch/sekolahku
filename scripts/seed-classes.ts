
import { db, studentClasses } from "../db";

const CLASS_LIST = [
    { name: "1A", grade: 1 }, { name: "1B", grade: 1 },
    { name: "2A", grade: 2 }, { name: "2B", grade: 2 },
    { name: "3A", grade: 3 }, { name: "3B", grade: 3 },
    { name: "4A", grade: 4 }, { name: "4B", grade: 4 },
    { name: "5A", grade: 5 }, { name: "5B", grade: 5 },
    { name: "6A", grade: 6 }, { name: "6B", grade: 6 },
];

async function seed() {
    console.log("Seeding classes...");
    for (const c of CLASS_LIST) {
        await db.insert(studentClasses).values({
            name: c.name,
            grade: c.grade,
            academicYear: "2024/2025",
            isActive: true,
            capacity: 28
        }).onConflictDoNothing();
    }
    console.log("Done.");
}

seed();
