
import { db } from "../db";
import { users } from "../db/schema/users";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Valid roles: "superadmin", "admin", "staff", "guru", "siswa", "user"

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log("Usage: npx tsx scripts/manage-user.ts <email> <password> [role] [name]");
        process.exit(1);
    }

    const email = args[0];
    const password = args[1];
    const role = (args[2] || "admin") as any;
    const name = args[3] || "Admin User";

    const hashedPassword = await bcrypt.hash(password, 10);

    const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existingUser) {
        console.log(`Updating existing user ${email}...`);
        await db.update(users)
            .set({ 
                passwordHash: hashedPassword,
                role: role,
                isActive: true, // Ensure active
                updatedAt: new Date()
            } as any)
            .where(eq(users.id, existingUser.id));
        console.log(`User ${email} updated successfully.`);
        console.log(`ID: ${existingUser.id}`);
    } else {
        console.log(`Creating new user ${email}...`);
        const [newUser] = await db.insert(users).values({
            email,
            passwordHash: hashedPassword,
            role: role,
            name: name,
            isActive: true,
            emailVerified: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any).returning();
        console.log(`User ${email} created successfully.`);
        console.log(`ID: ${newUser.id}`);
    }
}

main().catch(console.error).finally(() => process.exit(0));
