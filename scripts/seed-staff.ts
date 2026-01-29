import { db, staffProfiles } from "@/db";

async function seed() {
    console.log("Seeding staff...");
    
    // Check if exists
    const existing = await db.query.staffProfiles.findFirst();
    if(existing) {
        console.log("Staff data already exists active/inactive.");
        return;
    }

    await db.insert(staffProfiles).values([
        {
            name: "Dr. H. Ahmad Dahlan, M.Pd",
            position: "Kepala Sekolah",
            category: "kepsek",
            quote: "Pendidikan adalah senjata paling ampuh untuk mengubah dunia.",
            displayOrder: 1,
            isActive: true
        },
        {
            name: "Siti Aminah, S.Pd",
            position: "Guru Kelas 1",
            category: "guru",
            quote: "Belajar sambil bermain.",
            displayOrder: 2,
            isActive: true
        },
        {
            name: "Budi Santoso, S.Kom",
            position: "Operator Sekolah",
            category: "staff",
            displayOrder: 3,
            isActive: true
        }
    ]);
    console.log("Seeding done.");
}

seed().catch(console.error);
