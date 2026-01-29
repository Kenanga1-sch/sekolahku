// Script to create an admin user
// Run with: npx tsx scripts/create-admin.ts

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { users } from "../db/schema/users";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";

const sqlite = new Database("./data/sekolahku.db");
const db = drizzle(sqlite);

async function createAdmin() {
  const email = "admin@sekolah.id";
  const password = "admin123";
  const fullName = "Administrator";
  const role = "superadmin";

  console.log("\n🔧 Membuat user admin...\n");

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (existing.length > 0) {
    console.log("⚠️  User dengan email tersebut sudah ada!");
    console.log("");
    console.log("=".repeat(40));
    console.log("📧 Email    :", email);
    console.log("🔑 Password : admin123 (default)");
    console.log("👤 Nama     :", existing[0].fullName);
    console.log("🎭 Role     :", existing[0].role);
    console.log("=".repeat(40));
    sqlite.close();
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  await db.insert(users).values({
    id: createId(),
    email,
    passwordHash,
    fullName,
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  console.log("✅ User berhasil dibuat!");
  console.log("");
  console.log("=".repeat(40));
  console.log("📧 Email    :", email);
  console.log("🔑 Password :", password);
  console.log("👤 Nama     :", fullName);
  console.log("🎭 Role     :", role);
  console.log("=".repeat(40));
  console.log("");
  console.log("Gunakan kredensial di atas untuk login.");
  sqlite.close();
}

createAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
