
import { db } from "../db";
import { users } from "../db/schema/users";
import * as fs from "fs";

async function main() {
    console.log("Checking users table...");
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users.`);
    
    const output = allUsers.map(u => `ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Active: ${u.isActive}, Name: ${u.name}`).join("\n");
    fs.writeFileSync("users-list.txt", output);
    console.log("User list written to users-list.txt");
}

main().catch(console.error).finally(() => process.exit(0));
