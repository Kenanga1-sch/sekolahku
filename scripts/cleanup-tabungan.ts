
import { db, tabunganKelas, tabunganSiswa } from "@/db";
import { eq, sql, or, like } from "drizzle-orm";

async function cleanup() {
    console.log("Searching for potentially invalid classes...");
    
    // Find suspicous classes
    const classes = await db.select({
        id: tabunganKelas.id,
        nama: tabunganKelas.nama,
        studentCount: sql<number>`count(${tabunganSiswa.id})`
    })
    .from(tabunganKelas)
    .leftJoin(tabunganSiswa, eq(tabunganSiswa.kelasId, tabunganKelas.id))
    .where(or(
        like(tabunganKelas.nama, "%Tanpa%"),
        eq(tabunganKelas.nama, ""),
        eq(tabunganKelas.nama, " ")
    ))
    .groupBy(tabunganKelas.id);

    console.log("Found:", classes);

    for (const cls of classes) {
        if (cls.studentCount === 0) {
            console.log(`Deleting empty class: ${cls.nama} (${cls.id})`);
            await db.delete(tabunganKelas).where(eq(tabunganKelas.id, cls.id));
            console.log("Deleted.");
        } else {
            console.log(`Class ${cls.nama} has ${cls.studentCount} students. Cannot delete automatically.`);
            // List students
            const students = await db.select().from(tabunganSiswa).where(eq(tabunganSiswa.kelasId, cls.id));
            console.log("Students:", students.map(s => s.nama));
        }
    }
}

cleanup();
