import { NextResponse } from "next/server";
import { db, students, libraryMembers } from "@/db";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function POST() {
  try {
    const session = await auth();
    if (!session || !["superadmin", "admin", "staff"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Synchronous fetch with better-sqlite3 Query Builder
    const activeStudents = db.select().from(students)
      .where(eq(students.isActive, true))
      .all();

    if (!activeStudents.length) {
      return NextResponse.json({ 
        success: true, 
        message: "Tidak ada siswa aktif untuk disinkronisasi",
        stats: { added: 0, updated: 0, total: 0 } 
      });
    }

    let added = 0;
    let updated = 0;

    // 2. Perform Upsert for each student synchronously
    db.transaction((tx) => {
      for (const student of activeStudents) {
        // Check if member already exists by studentId using Query Builder
        const existingMember = tx.select().from(libraryMembers)
          .where(eq(libraryMembers.studentId, student.id))
          .get();

        if (existingMember) {
          // Update
          tx.update(libraryMembers)
            .set({
              name: student.fullName,
              className: student.className,
              qrCode: student.qrCode,
              photo: student.photo,
              updatedAt: new Date(),
            })
            .where(eq(libraryMembers.id, existingMember.id))
            .run();
          updated++;
        } else {
          // Check if QR code exists (edge case: manual entry collision)
          const qrCollision = tx.select().from(libraryMembers)
            .where(eq(libraryMembers.qrCode, student.qrCode))
            .get();

          if (qrCollision) {
            // Update the collision record to link to this student
             tx.update(libraryMembers)
            .set({
              studentId: student.id,
              name: student.fullName,
              className: student.className,
              photo: student.photo,
              updatedAt: new Date(),
            })
            .where(eq(libraryMembers.id, qrCollision.id))
            .run();
            updated++;
          } else {
             // Insert
            tx.insert(libraryMembers).values({
              studentId: student.id,
              userId: undefined,
              name: student.fullName,
              className: student.className,
              qrCode: student.qrCode,
              photo: student.photo,
              isActive: true,
            }).run();
            added++;
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi berhasil. ${added} siswa ditambahkan, ${updated} diperbarui.`,
      stats: { added, updated, total: activeStudents.length },
    });

  } catch (error) {
    console.error("Library sync error:", error);
    return NextResponse.json(
      { 
        error: "Gagal melakukan sinkronisasi data", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
