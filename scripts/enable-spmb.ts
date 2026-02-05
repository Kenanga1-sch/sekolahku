
import { db } from "@/db";
import { schoolSettings } from "@/db/schema/misc";
import { eq } from "drizzle-orm";

async function enableSPMB() {
    console.log("Enabling SPMB...");
    // Update all records (there should be only one)
    await db.update(schoolSettings).set({ spmbIsOpen: true });
    console.log("SPMB has been enabled.");
}

enableSPMB();
