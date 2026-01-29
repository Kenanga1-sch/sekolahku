import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { students } from "@/db/schema/students";
import { staffProfiles, staffCategoryEnum } from "@/db/schema/staff";
import { eq, and, isNull, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/auth";

const sanitizeUsername = (name: string) => {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["superadmin", "admin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, className, staffData } = body;

    // ==========================================
    // GENERATE STUDENT ACCOUNTS
    // ==========================================
    if (type === "student") {
      if (!className) {
        return NextResponse.json(
          { success: false, error: "Kelas wajib dipilih" },
          { status: 400 }
        );
      }

      // 1. Get students in class
    //   const classStudents = await db.select().from(students).where(eq(students.className, className));
      
      // FIX: Use like or exact match depending on how className is stored (1 vs 1A). 
      // Based on UI it's just "1", "2". But DB might have "1A". 
      // The user said "rombel disekolah hanya 6, jadi tidak ada kategori a, b, c".
      // So assuming DB stores "1", "2" etc.
      const classStudents = await db.select().from(students).where(eq(students.className, className));

      if (classStudents.length === 0) {
        return NextResponse.json({ success: false, error: "Tidak ada siswa di kelas ini" }, { status: 404 });
      }

      // Find students who ALREADY have a user account (linked by username=NISN)
      const studentNisns = classStudents.map(s => s.nisn).filter(Boolean) as string[];
      
      if (studentNisns.length === 0) {
         return NextResponse.json({ success: false, error: "Siswa di kelas ini tidak memiliki NISN valid" }, { status: 400 });
      }

      const existingUsers = await db
        .select({ username: users.username })
        .from(users)
        .where(inArray(users.username, studentNisns));

      const existingUsernames = new Set(existingUsers.map(u => u.username));
      
      const studentsToCreate = classStudents.filter(s => s.nisn && !existingUsernames.has(s.nisn));

      if (studentsToCreate.length === 0) {
        return NextResponse.json({ 
          success: true, 
          message: "Semua siswa di kelas ini sudah memiliki akun.",
          count: 0 
        });
      }

      let createdCount = 0;
      
      await Promise.all(studentsToCreate.map(async (student) => {
        if (!student.nisn) return;

        // Default Password = NISN
        const hashedPassword = await bcrypt.hash(student.nisn, 10);
        
        // Generate Email: nama@sekolah.sch.id
        // Handle Sanitize
        const cleanName = sanitizeUsername(student.fullName);
        let email = `${cleanName}@sekolah.sch.id`;

        // Simple collision check (fetch check inside loop is slow but safer for collisions, or just accept risk for now)
        // For robustness, append NISN part if name is very common? 
        // User requested "nama@sekolah.sch.id", strictly.
        // We will assume names are unique enough or allow overwrite? No, email must be unique.
        // Let's try to append last 3 digits of NISN if strictly needed, OR just trust name uniqueness for now 
        // and fail silently on duplicate email constraint?
        // To safely handle this without complex unique checks per iteration, let's stick to user request.
        // But to avoid unique key error crashing everything, we can try-catch the insert.
        
        try {
            await db.insert(users).values({
              id: createId(),
              name: student.fullName,
              email: email,
              username: student.nisn, // Login with NISN
              passwordHash: hashedPassword,
              role: "siswa",
              phone: student.parentPhone,
              image: student.photo,
              emailVerified: new Date(),
            });
            createdCount++;
        } catch (e) {
            // Fallback for email collision?
            // Try appending NISN to email
            try {
                email = `${cleanName}${student.nisn.slice(-3)}@sekolah.sch.id`;
                await db.insert(users).values({
                    id: createId(),
                    name: student.fullName,
                    email: email,
                    username: student.nisn,
                    passwordHash: hashedPassword,
                    role: "siswa",
                    phone: student.parentPhone,
                    image: student.photo,
                    emailVerified: new Date(),
                  });
                  createdCount++;
            } catch (ignored) {
                console.log(`Failed to create student ${student.fullName} - likely duplicate`);
            }
        }
      }));

      return NextResponse.json({
        success: true,
        message: `Berhasil membuat ${createdCount} akun siswa.`,
        count: createdCount,
      });
    }

    // ==========================================
    // GENERATE STAFF ACCOUNT (MANUAL)
    // ==========================================
    if (type === "staff") {
       // ... (Keep existing manual logic if needed, or remove? I'll keep it for custom adds)
       if (!staffData?.name || !staffData?.email || !staffData?.role) {
         return NextResponse.json({ success: false, error: "Data staff tidak lengkap" }, { status: 400 });
       }
       // ... existing manual logic ...
       const existing = await db.query.users.findFirst({ where: eq(users.email, staffData.email) });
       if (existing) return NextResponse.json({ success: false, error: "Email sudah terdaftar" }, { status: 400 });

       const password = staffData.password || "Staff123!";
       const hashedPassword = await bcrypt.hash(password, 10);

       await db.insert(users).values({
         id: createId(),
         name: staffData.name,
         email: staffData.email,
         username: staffData.username || staffData.email.split("@")[0],
         passwordHash: hashedPassword,
         role: staffData.role,
         phone: staffData.phone,
         emailVerified: new Date(),
       });

       return NextResponse.json({ success: true, message: "Akun staff berhasil dibuat" });
    }

    // ==========================================
    // GENERATE STAFF ACCOUNT (BULK AUTO)
    // ==========================================
    if (type === "staff-auto") {
        const { mode } = body; // "skip" | "overwrite"
        
        // 1. Fetch all staff profiles
        const allStaff = await db.select().from(staffProfiles);
        
        if (allStaff.length === 0) {
            return NextResponse.json({ success: false, error: "Data Guru/Staff kosong di database" }, { status: 404 });
        }

        let createdCount = 0;
        let updatedCount = 0;
        
        await Promise.all(allStaff.map(async (staff) => {
            // Generate Email: nama@sekolah.sch.id
            const cleanName = sanitizeUsername(staff.name);
            const email = `${cleanName}@sekolah.sch.id`;

            // Password Fixed: 20216609
            const hashedPassword = await bcrypt.hash("20216609", 10);
            
            // Map Role
            let role: "guru" | "staff" | "user" = "staff";
            if (staff.category === "guru" || staff.category === "kepsek") role = "guru";
            if (staff.category === "support") role = "user";

            // Check if user with this email exists
            const existing = await db.query.users.findFirst({
                where: eq(users.email, email)
            });

            if (existing) {
                if (mode === "overwrite") {
                    // Update existing user (Reset password & sync info)
                    await db.update(users).set({
                        name: staff.name,
                        passwordHash: hashedPassword,
                        role: role,
                        image: staff.photoUrl,
                        // Don't change email/username as they are identity keys
                        updatedAt: new Date()
                    }).where(eq(users.id, existing.id));
                    updatedCount++;
                }
                // If skip, do nothing
                return;
            }

            // Create New
            try {
                await db.insert(users).values({
                    id: createId(),
                    name: staff.name,
                    email: email,
                    username: cleanName,
                    passwordHash: hashedPassword,
                    role: role,
                    image: staff.photoUrl,
                    emailVerified: new Date(),
                });
                createdCount++;
            } catch (e) {
                console.error(`Failed to auto-create staff ${staff.name}`, e);
            }
        }));

        const actionText = mode === "overwrite" ? "direset/dibuat" : "dibuat";
        return NextResponse.json({
            success: true,
            message: `Proses selesai. ${createdCount} akun baru, ${updatedCount} akun direset.`,
            count: createdCount + updatedCount
        });
    }

    return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });

  } catch (error) {
    console.error("Generate Account Error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}
