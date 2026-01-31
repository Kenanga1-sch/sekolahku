// Script to create a test admin user for E2E tests
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { users } from "../db/schema/users";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";

const sqlite = new Database("./data/sekolahku.db");
const db = drizzle(sqlite);

async function createTestAdmin() {
  const email = "testadmin@sekolah.id";
  const password = "test1234";
  const fullName = "Test Administrator";
  const role = "superadmin";

  console.log("\n🔧 Membuat user test admin...\n");

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing.length > 0) {
    console.log("⚠️  User sudah ada, mereset password...");
    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.email, email));
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
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
  }
  sqlite.close();
}

createTestAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
