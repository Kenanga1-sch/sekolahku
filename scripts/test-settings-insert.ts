
import { db } from "@/db";
import { schoolSettings } from "@/db/schema/misc";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Testing School Settings Insert/Update...");

  try {
      // 1. Check existing
      const existing = await db.select().from(schoolSettings).limit(1);
      console.log("Existing settings found:", existing.length);

      // 2. Try simple insert or update
      const data = {
        schoolName: "Test School Update",
        principalName: "Test Principal",
        principalNip: "12345678",
      };

      if (existing.length > 0) {
          console.log("Updating existing ID:", existing[0].id);
          const [updated] = await db.update(schoolSettings)
            .set(data)
            .where(eq(schoolSettings.id, existing[0].id))
            .returning();
          console.log("Update SUCCESS:", updated);
      } else {
          console.log("Inserting new...");
          const [created] = await db.insert(schoolSettings).values({
              ...data,
              schoolName: "New School", // ensuring required fields
          }).returning();
           console.log("Insert SUCCESS:", created);
      }
      
  } catch (e) {
      console.error("DB OPERATION FAILED:", e);
  }
}

main().catch(console.error).finally(() => process.exit(0));
