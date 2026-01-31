import { db, users } from "@/db";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
    console.log("Seeding superadmin...");
    
    // Check if superadmin exists
    const existing = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, "admin@sekolahku.id")
    });
    
    if (existing) {
        console.log("Superadmin already exists.");
        
        // Optional: Update password if needed
        const passwordHash = await hash("admin123", 10);
        await db.update(users)
            .set({ passwordHash })
            .where(eq(users.email, "admin@sekolahku.id"));
            
        console.log("Password reset to: admin123");
        return;
    }

    const passwordHash = await hash("admin123", 10);
    
    await db.insert(users).values({
        name: "Super Admin",
        email: "admin@sekolahku.id",
        username: "admin",
        passwordHash,
        role: "superadmin",
        emailVerified: new Date(),
        isActive: true,
    });
    
    console.log("Superadmin created.");
    console.log("Email: admin@sekolahku.id");
    console.log("Pass: admin123");
}

seed().catch(console.error);
