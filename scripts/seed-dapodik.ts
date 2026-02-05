
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { db, students, studentClasses, users, employeeDetails, tabunganKelas, tabunganSiswa } from "@/db"; // Adjust imports based on your alias
import { createId } from "@paralleldrive/cuid2";
import { eq, sql } from "drizzle-orm";

async function seed() {
    console.log("Starting Dapodik Seeding...");
    const baseDir = path.resolve("d:/antigravity/sekolahku/docs/dapodik");

    // 1. Seed Students
    const studentFile = path.join(baseDir, "daftar_PD.xlsx");
    if (fs.existsSync(studentFile)) {
        console.log("Processing Students...");
        
        const wb = XLSX.readFile(studentFile);
        const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        console.log(`Found ${data.length} students.`);

        // 1.1 Extract and Seed Classes (Rombel)
        const uniqueRombels = new Set<string>();
        data.forEach(row => {
            const rombel = row["Rombel Saat Ini"] || row["Kelas"];
            if (rombel) uniqueRombels.add(rombel.trim());
        });

        console.log(`Found ${uniqueRombels.size} unique classes:`, Array.from(uniqueRombels));

        const rombelMap = new Map<string, string>(); // Name -> ID

        for (const rombelName of uniqueRombels) {
            // Heuristic to determine grade from name (e.g., "Kelas 1A" -> 1, "1" -> 1)
            const gradeMatch = rombelName.match(/\d+/);
            const grade = gradeMatch ? parseInt(gradeMatch[0]) : 0; // Default to 0 if unknown

            const classId = createId();
            
            // Try to find existing first to maintain IDs if possible, or just upsert
            // For simplicity in this script, we'll try to get existing by name or create new
            const existing = await db.query.studentClasses.findFirst({
                where: eq(studentClasses.name, rombelName)
            });

            if (existing) {
                rombelMap.set(rombelName.toLowerCase(), existing.id);
            } else {
                await db.insert(studentClasses).values({
                    id: classId,
                    name: rombelName,
                    grade: grade,
                    academicYear: "2024/2025", // Default current year
                    isActive: true,
                    capacity: 30
                });
                rombelMap.set(rombelName.toLowerCase(), classId);
            }
        }
        console.log("Classes seeded/synced.");
        
        // 1.2 Sync to Tabungan Kelas
        const tabunganKelasMap = new Map<string, string>();
        for (const rombelName of uniqueRombels) {
             const existing = await db.query.tabunganKelas.findFirst({
                 where: eq(tabunganKelas.nama, rombelName)
             });

             if (existing) {
                 tabunganKelasMap.set(rombelName.toLowerCase(), existing.id);
             } else {
                 const newId = createId();
                 await db.insert(tabunganKelas).values({
                     id: newId,
                     nama: rombelName,
                 });
                 tabunganKelasMap.set(rombelName.toLowerCase(), newId);
             }
        }

        const preparedStudents = data.map((row) => {
            const rombel = row["Rombel Saat Ini"] || row["Kelas"] || "";
            const classId = rombelMap.get(rombel.toLowerCase().trim()) || null;
            
            return {
                id: createId(),
                fullName: row["Nama"] || row["Nama Peserta Didik"],
                nis: row["NIPD"] ? String(row["NIPD"]) : null,
                nisn: row["NISN"] ? String(row["NISN"]) : null,
                nik: row["NIK"] ? String(row["NIK"]) : null,
                gender: ((row["JK"] === "L" || row["JK"] === "Laki-laki") ? "L" : "P") as "L" | "P",
                birthPlace: row["Tempat Lahir"],
                birthDate: parseDate(row["Tanggal Lahir"]),
                religion: row["Agama"],
                address: row["Alamat Jalan"],
                fatherName: row["Nama Ayah"],
                motherName: row["Nama Ibu Kandung"],
                motherNik: row["NIK Ibu"] ? String(row["NIK Ibu"]) : null, // Helper if exists
                status: "active" as "active" | "graduated" | "transferred" | "dropped" | "deceased",
                qrCode: row["NISN"] ? String(row["NISN"]) : `QR-${createId()}`, // Fallback
                classId: classId,
                className: rombel || null,
            };
        }).filter(s => s.fullName); // Basic validation

        // Chunk insert
        const CHUNK_SIZE = 50;
        for (let i = 0; i < preparedStudents.length; i += CHUNK_SIZE) {
            const chunk = preparedStudents.slice(i, i + CHUNK_SIZE);
            
            // Insert Students
            const insertedStudents = await db.insert(students).values(chunk).onConflictDoUpdate({
                target: students.nisn,
                set: {
                    classId: sql`excluded.class_id`,
                    className: sql`excluded.class_name`,
                    updatedAt: new Date(),
                }
            }).returning();

            // Insert Tabungan Siswa
            for (const student of insertedStudents) {
                if (!student.classId || !student.className) continue; // Skip if no class

                const tabunganKelasId = tabunganKelasMap.get(student.className.toLowerCase().trim());
                if (!tabunganKelasId) continue;

                await db.insert(tabunganSiswa).values({
                    studentId: student.id,
                    nisn: student.nisn || `NISN-${student.id}`,
                    nama: student.fullName,
                    kelasId: tabunganKelasId,
                    saldoTerakhir: 0,
                    qrCode: student.qrCode,
                    isActive: true,
                    foto: null,
                }).onConflictDoUpdate({
                    target: tabunganSiswa.nisn,
                    set: {
                        kelasId: tabunganKelasId,
                        nama: student.fullName,
                        updatedAt: new Date(),
                    }
                });
            }
        }
        console.log("Students and Tabungan seeded.");
    }

    // 2. Seed Teachers & Staff
    await seedStaff(path.join(baseDir, "daftar_Guru.xlsx"), "guru");
    await seedStaff(path.join(baseDir, "daftar_Tendik.xlsx"), "staff");

    console.log("Seeding Complete!");
}

async function seedStaff(filePath: string, category: "guru" | "staff") {
    if (!fs.existsSync(filePath)) return;
    
    console.log(`Processing ${category}...`);
    const wb = XLSX.readFile(filePath);
    const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    
    console.log(`Found ${data.length} entries.`);

    // Pre-calculate hash for "123456" to speed up
    // $2a$10$..... usually
    const passwordHash = "$2a$10$abcdefghijklmnopqrstuvwxyz123456"; // Dummy hash or calculate real one if needed, but for speed...
    // Actually let's import hash and do it once
    const { hash } = require("bcryptjs");
    const realHash = await hash("123456", 10);

    for (const row of data) {
         const name = row["Nama"];
         if(!name) continue;

         const nip = row["NIP"] ? String(row["NIP"]) : null;
         const nuptk = row["NUPTK"] ? String(row["NUPTK"]) : null;
         const nik = row["NIK"] ? String(row["NIK"]) : null;
         
         // Generate Email: nip@sekolahku.id OR name.cleaned@sekolahku.id
         const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
         const email = nip ? `${nip}@sekolahku.id` : `${cleanName}.${category}@sekolahku.id`;
         
         // Upsert User
         // We use onConflictUpdate on email
         const userId = createId();
         
         try {
             // Check if exists
             const existingUser = await db.query.users.findFirst({
                 where: eq(users.email, email)
             });

             let finalUserId = existingUser?.id;

             if (!existingUser) {
                 await db.insert(users).values({
                     id: userId,
                     email,
                     name: name,
                     fullName: name,
                     role: category, // "guru" or "staff"
                     passwordHash: realHash,
                     isActive: true,
                     createdAt: new Date(),
                     updatedAt: new Date(),
                 });
                 finalUserId = userId;
             } else {
                 // Update?
             }

             if (finalUserId) {
                 // Check if details exist
                 const existingDetails = await db.query.employeeDetails.findFirst({
                     where: eq(employeeDetails.userId, finalUserId)
                 });

                 if (existingDetails) {
                     await db.update(employeeDetails).set({
                         nip: nip,
                         nuptk: nuptk,
                         nik: nik,
                         employmentStatus: row["Status Kepegawaian"] || "GTY", 
                         jobType: row["Jenis PTK"] || (category === "guru" ? "Guru Mapel" : "Staff"),
                         updatedAt: new Date(),
                     }).where(eq(employeeDetails.id, existingDetails.id));
                 } else {
                     await db.insert(employeeDetails).values({
                         userId: finalUserId,
                         nip: nip,
                         nuptk: nuptk,
                         nik: nik,
                         employmentStatus: row["Status Kepegawaian"] || "GTY", 
                         jobType: row["Jenis PTK"] || (category === "guru" ? "Guru Mapel" : "Staff"),
                         updatedAt: new Date(),
                     });
                 }
             }
         } catch (e) {
             console.error(`Failed to seed ${name}:`, e);
         }
    }
    console.log(`${category} seeded.`);
}

function parseDate(val: any): string | null {
    if (!val) return null;
    if (typeof val === 'number') {
        const date = XLSX.SSF.parse_date_code(val);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    return String(val); // Assume YYYY-MM-DD or handled by app
}

function calculateDegree(val: string): string {
    // Basic heuristics if needed, or leave blank
    return "";
}

seed().catch(console.error);
