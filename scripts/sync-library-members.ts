
import { db } from "../db";
import { students } from "../db/schema/students";
import { users } from "../db/schema/users";
import { employeeDetails } from "../db/schema/employees";
import { libraryMembers } from "../db/schema/library";
import { eq, or, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

async function main() {
  console.log("🔄 Starting Library Member Sync...");

  // 1. Sync Students
  console.log("👥 Syncing Students to Library...");
  const allStudents = await db.select().from(students).where(eq(students.status, "active"));
  let studentCount = 0;
  let studentSkips = 0;

  for (const student of allStudents) {
    // Check if already in libraryMembers
    const existing = await db.select().from(libraryMembers)
      .where(eq(libraryMembers.studentId, student.id))
      .limit(1);

    if (existing.length === 0) {
      if (!student.qrCode) {
        console.warn(`⚠️ Warning: Student ${student.fullName} has no QR code, skipping.`);
        studentSkips++;
        continue;
      }

      await db.insert(libraryMembers).values({
        id: createId(),
        studentId: student.id,
        name: student.fullName,
        className: student.className,
        qrCode: student.qrCode,
        isActive: true,
      });
      studentCount++;
    } else {
        // Maybe update name/class if changed?
        await db.update(libraryMembers).set({
            name: student.fullName,
            className: student.className,
            updatedAt: new Date()
        }).where(eq(libraryMembers.id, existing[0].id));
    }
  }
  console.log(`✅ Synced ${studentCount} new students. (Skiped: ${studentSkips})`);

  // 2. Sync Staff/Teachers
  console.log("👨‍🏫 Syncing Staff/Teachers to Library...");
  const allStaff = await db.select({
      user: users,
      details: employeeDetails
  })
  .from(users)
  .leftJoin(employeeDetails, eq(users.id, employeeDetails.userId))
  .where(or(eq(users.role, "guru"), eq(users.role, "staff"), eq(users.role, "admin")));
  
  let staffCount = 0;

  for (const entry of allStaff) {
    const { user, details } = entry;
    
    // Check if already in libraryMembers
    const existing = await db.select().from(libraryMembers)
      .where(eq(libraryMembers.userId, user.id))
      .limit(1);

    if (existing.length === 0) {
      // Use NIP as QR code if available, otherwise generate one
      const qrCode = details?.nip || details?.nuptk || details?.nik || `STAFF-${user.id.slice(-6).toUpperCase()}`;
      
      await db.insert(libraryMembers).values({
        id: createId(),
        userId: user.id,
        name: user.fullName || user.name || "N/A",
        className: (user.role === "guru" ? "GURU" : "STAFF"),
        qrCode: qrCode,
        isActive: true,
      });
      staffCount++;
    } else {
        await db.update(libraryMembers).set({
            name: user.fullName || user.name || "N/A",
            updatedAt: new Date()
        }).where(eq(libraryMembers.id, existing[0].id));
    }
  }
  console.log(`✅ Synced ${staffCount} new staff/teachers.`);

  console.log("✨ Library Member Sync Complete!");
}

main().catch(console.error).finally(() => process.exit(0));
