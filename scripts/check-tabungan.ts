
import { db, tabunganKelas, tabunganSiswa } from "@/db";
import { eq, sql } from "drizzle-orm";

async function check() {
    const classes = await db.select({
        id: tabunganKelas.id,
        nama: tabunganKelas.nama,
        studentCount: sql<number>`count(${tabunganSiswa.id})`
    })
    .from(tabunganKelas)
    .leftJoin(tabunganSiswa, eq(tabunganSiswa.kelasId, tabunganKelas.id))
    .groupBy(tabunganKelas.id);

    console.log("Tabungan Classes:", classes);
}

check();
