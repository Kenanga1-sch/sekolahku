
import { db } from "../db";
import { users } from "../db/schema/users";
import { schoolSettings } from "../db/schema/misc";
import { academicYears } from "../db/schema/academic";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

async function main() {
  console.log("🌱 Seeding database...");

  try {
    // 1. Seed Admin User
    const adminEmail = "admin@sekolahku.id";
    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

    if (existingAdmin.length === 0) {
      console.log("👤 Creating admin user...");
      const passwordHash = await hash("admin123", 10);
      await db.insert(users).values({
        id: createId(),
        email: adminEmail,
        passwordHash,
        fullName: "Administrator",
        username: "admin",
        role: "admin", // As requested: Role ADMIN (lowercase for enum)
        isActive: true,
      });
      console.log("✅ Admin user created.");
    } else {
      console.log("ℹ️ Admin user already exists.");
    }

    // 2. Seed School Settings
    const existingSettings = await db.select().from(schoolSettings).limit(1);
    if (existingSettings.length === 0) {
      console.log("🏫 Creating school settings...");
      await db.insert(schoolSettings).values({
        id: createId(),
        schoolName: "SDN Nusantara 01",
        schoolAddress: "Jl. Pendidikan No. 1",
        schoolEmail: "info@sekolahku.id",
        currentAcademicYear: "2025/2026",
      });
      console.log("✅ School settings created.");
    } else {
      console.log("ℹ️ School settings already exist.");
    }

    // 3. Seed Academic Year
    const ayName = "2025/2026";
    const existingAY = await db.select().from(academicYears).where(eq(academicYears.name, ayName)).limit(1);
    if (existingAY.length === 0) {
      console.log("📅 Creating academic year...");
      await db.insert(academicYears).values({
        id: createId(),
        name: ayName,
        semester: "ganjil",
        isActive: true,
      });
      console.log("✅ Academic year created.");
    } else {
      console.log("ℹ️ Academic year already exists.");
    }

    console.log("✨ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main().catch(console.error).finally(() => process.exit(0));
