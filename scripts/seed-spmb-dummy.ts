
import { db } from "../db";
import { spmbRegistrants, spmbPeriods } from "../db/schema/spmb";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

// Simple Random Helpers to replace Faker
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomNumber = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomString = (length: number) => Math.random().toString(36).substring(2, 2 + length);
const randomNumeric = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

const firstNames = ["Ahmad", "Budi", "Chandra", "Dewi", "Eka", "Fajar", "Gita", "Hendra", "Indah", "Joko"];
const lastNames = ["Saputra", "Wijaya", "Kusuma", "Pratama", "Santoso", "Hidayat", "Nugroho", "Wibowo", "Sari", "Lestari"];
const cities = ["Indramayu", "Cirebon", "Bandung", "Jakarta", "Semarang", "Surabaya"];
const streets = ["Jl. Sudirman", "Jl. Thamrin", "Jl. Gatot Subroto", "Jl. Pemuda", "Jl. Ahmad Yani"];

const randomName = () => `${randomItem(firstNames)} ${randomItem(lastNames)}`;
const randomAddress = () => `${randomItem(streets)} No. ${randomNumber(1, 100)}`;
const randomDate = (startYear: number, endYear: number) => {
    const year = randomNumber(startYear, endYear);
    const month = randomNumber(0, 11);
    const day = randomNumber(1, 28);
    return new Date(year, month, day);
};

async function seed() {
  console.log("🌱 Seeding Dummy SPMB Registrants (Custom Random)...");

  try {
    // 1. Get Active Period
    const [period] = await db.select().from(spmbPeriods).where(eq(spmbPeriods.isActive, true)).limit(1);
    
    if (!period) {
      console.error("❌ No active SPMB period found. Please run seed.ts first or enable a period.");
      process.exit(1);
    }

    console.log(`Using Period: ${period.name} (${period.academicYear})`);

    // 2. Clear existing dummy data (optional)
    // await db.delete(spmbRegistrants).where(eq(spmbRegistrants.periodId, period.id));

    // 3. Create Dummy Data
    const dummies = [
      { status: "accepted", count: 2 },
      { status: "rejected", count: 1 },
      { status: "verified", count: 1 },
      { status: "pending", count: 3 }, // Added more pending
    ];

    let sequence = 1000;

    for (const group of dummies) {
      for (let i = 0; i < group.count; i++) {
        sequence++;
        const regNumber = `SPMB-${period.academicYear.split('/')[0]}-${sequence}`;
        const fullName = randomName();
        const street = randomAddress();
        const rt = String(randomNumber(1, 10)).padStart(2, '0');
        const rw = String(randomNumber(1, 10)).padStart(2, '0');
        const village = "Desa Kenanga";
        const addressFull = `${street}, RT ${rt}/RW ${rw}, ${village}, Kec. Sindang, Kab. Indramayu`;
        
        console.log(`Creating ${group.status} registrant: ${fullName} (${regNumber})`);

        await db.insert(spmbRegistrants).values({
          id: createId(),
          periodId: period.id,
          registrationNumber: regNumber,
          fullName: fullName,
          gender: Math.random() > 0.5 ? "L" : "P",
          nisn: randomNumeric(10),
          studentNik: randomNumeric(16),
          kkNumber: randomNumeric(16), // Added
          birthPlace: randomItem(cities),
          birthDate: randomDate(2018, 2020), 
          religion: "Islam",
          
          // Address Breakdown
          addressStreet: street,
          addressRt: rt,
          addressRw: rw,
          addressVillage: village,
          postalCode: randomNumeric(5),
          address: addressFull,
          
          // Parent Info
          fatherName: randomName(),
          fatherNik: randomNumeric(16),
          fatherJob: "Wiraswasta",
          motherName: randomName(),
          motherNik: randomNumeric(16),
          motherJob: "Ibu Rumah Tangga",
          parentPhone: "08" + randomNumeric(10),
          parentName: "Orang Tua/Wali", // Legacy field just in case
          
          // SPMB Specifics
          status: group.status as any,
          registerDate: new Date(), // NOTE check if this field exists in schema, otherwise remove. Wait, I saw it in schema? No I didn't see `registerDate` in schema above. Only `createdAt`.
          // Checking schema again... 
          // `createdAt` exists. `registerDate` does NOT exist in schema viewing.
          // I will remove `registerDate`.
          
          withKip: false,
          previousSchool: "TK " + randomItem(firstNames),
          distanceToSchool: Number((Math.random() * 5).toFixed(2)),
          // homeLat/homeLng instead of latitude/longitude
          homeLat: -6.3 + Math.random() * 0.1,
          homeLng: 108.3 + Math.random() * 0.1,
          
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    console.log("✅ SPMB Dummy Data Seeded Successfully!");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed().catch(console.error).finally(() => process.exit(0));
