// Script to reset user password
// Run with: npx tsx scripts/reset-password.ts

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { users } from "../db/schema/users";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const sqlite = new Database("./data/sekolahku.db");
const db = drizzle(sqlite);

async function resetPassword() {
  const email = "admin@sekolah.sch.id";
  const newPassword = "admin123";

  console.log("\n🔐 Reset Password User\n");
  console.log(`Email: ${email}`);

  // Check if user exists
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (!user) {
    console.log("\n❌ User dengan email tersebut tidak ditemukan!");
    sqlite.close();
    return;
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Update password
  await db.update(users)
    .set({ 
      passwordHash,
      updatedAt: new Date(),
    } as any)
    .where(eq(users.email, email));

  console.log("\n✅ Password berhasil direset!");
  console.log("");
  console.log("=".repeat(40));
  console.log("📧 Email        :", email);
  console.log("🔑 Password Baru:", newPassword);
  console.log("👤 Nama         :", user.fullName);
  console.log("🎭 Role         :", user.role);
  console.log("=".repeat(40));
  console.log("");
  console.log("Gunakan kredensial di atas untuk login.");
  sqlite.close();
}

resetPassword()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
