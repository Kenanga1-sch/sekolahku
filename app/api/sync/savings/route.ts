import { NextResponse } from "next/server";
import { db, students, tabunganSiswa, tabunganKelas } from "@/db";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function POST() {
  try {
    const session = await auth(); // async
    if (!session || !["superadmin", "admin", "staff"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Synchronous fetch with better-sqlite3
    console.log("Savings Sync: Fetching active students...");
    // Use standard Query Builder for explicit sync execution and type safety
    const activeStudents = db.select().from(students).where(eq(students.isActive, true)).all();
    console.log("Savings Sync: Active students found:", activeStudents.length);

    if (!activeStudents.length) {
      return NextResponse.json({ 
        success: true, 
        message: "Tidak ada siswa aktif untuk disinkronisasi",
        stats: { added: 0, updated: 0, total: 0 } 
      });
    }

    let added = 0;
    let updated = 0;
    
    // Cache for class IDs: Record<string, string> -> ClassName : ClassId
    const classMap: Record<string, string> = {};

    // 2. Perform Upsert Synchronously
    db.transaction((tx) => {
      
      // Helper inside transaction (must be sync)
      const getOrGenericClassIdSync = (className: string | null) => {
        const targetName = className || "Tanpa Kelas"; // Default if null
        
        if (classMap[targetName]) return classMap[targetName];

        // Find existing using Query Builder
        const existingClass = tx.select().from(tabunganKelas)
          .where(eq(tabunganKelas.nama, targetName))
          .get();

        if (existingClass) {
          classMap[targetName] = existingClass.id;
          return existingClass.id;
        }

        // Create new
        const result = tx.insert(tabunganKelas).values({
          nama: targetName,
        }).returning().get();
        
        classMap[targetName] = result.id;
        return result.id;
      };

      for (const student of activeStudents) {
        // Resolve Class ID
        const kelasId = getOrGenericClassIdSync(student.className);

        const nisnToUse = student.nisn || `TEMP-${student.id}`; 
        
        let existing = tx.select().from(tabunganSiswa)
          .where(eq(tabunganSiswa.studentId, student.id))
          .get();
        
        if (!existing) {
             existing = tx.select().from(tabunganSiswa)
              .where(eq(tabunganSiswa.nisn, nisnToUse))
              .get();
        }

        if (existing) {
          // Update
          tx.update(tabunganSiswa)
            .set({
              nama: student.fullName,
              kelasId: kelasId,
              qrCode: student.qrCode,
              foto: student.photo,
              studentId: student.id, 
              nisn: nisnToUse, 
              updatedAt: new Date(),
            })
            .where(eq(tabunganSiswa.id, existing.id))
            .run();
          updated++;
        } else {
          // QR collision check
          const qrCollision = tx.select().from(tabunganSiswa)
            .where(eq(tabunganSiswa.qrCode, student.qrCode))
            .get();

          if (qrCollision) {
             tx.update(tabunganSiswa)
            .set({
              nama: student.fullName,
              kelasId: kelasId,
              studentId: student.id,
              nisn: nisnToUse,
              foto: student.photo,
              updatedAt: new Date(),
            })
            .where(eq(tabunganSiswa.id, qrCollision.id))
            .run();
             updated++;
          } else {
             // Insert
            tx.insert(tabunganSiswa).values({
              studentId: student.id,
              nisn: nisnToUse,
              nama: student.fullName,
              kelasId: kelasId,
              qrCode: student.qrCode,
              foto: student.photo,
              saldoTerakhir: 0,
              isActive: true,
            }).run();
            added++;
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi berhasil. ${added} nasabah ditambahkan, ${updated} diperbarui.`,
      stats: { added, updated, total: activeStudents.length },
    });

  } catch (error) {
    console.error("Savings sync error:", error);
    return NextResponse.json(
      { 
        error: "Gagal melakukan sinkronisasi data",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
