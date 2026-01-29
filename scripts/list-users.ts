// Script to list users from database
// Run with: npx tsx scripts/list-users.ts

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { users } from "../db/schema/users";

const sqlite = new Database("./data/sekolahku.db");
const db = drizzle(sqlite);

async function listUsers() {
  console.log("\n📋 Daftar User yang Terdaftar:\n");
  
  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    fullName: users.fullName,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users);

  if (allUsers.length === 0) {
    console.log("❌ Tidak ada user di database.");
    console.log("\n💡 Anda perlu membuat user baru dengan script:");
    console.log("   npx tsx scripts/create-admin.ts");
    sqlite.close();
    return;
  }

  console.log("=".repeat(80));
  console.log("| Email".padEnd(35) + "| Nama".padEnd(25) + "| Role".padEnd(15) + "|");
  console.log("=".repeat(80));
  
  for (const user of allUsers) {
    const email = (user.email || "-").padEnd(33);
    const name = (user.fullName || "-").substring(0, 22).padEnd(23);
    const role = (user.role || "-").padEnd(13);
    console.log(`| ${email} | ${name} | ${role} |`);
  }
  console.log("=".repeat(80));
  console.log(`\nTotal: ${allUsers.length} user`);
  sqlite.close();
}

listUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
