
import { db } from "@/db";
import { spmbPeriods } from "@/db/schema/spmb";
import { schoolSettings } from "@/db/schema/misc";

async function checkSPMBStatus() {
    console.log("\n--- Checking SPMB Periods ---");
    const periods = await db.select().from(spmbPeriods);
    if (periods.length === 0) {
        console.log("No periods found.");
    } else {
        periods.forEach(p => {
            console.log(`Period ID: ${p.id}`);
            console.log(`  Name: ${p.name}`);
            console.log(`  isActive: ${p.isActive}`);
            console.log(`  Dates: ${p.startDate} - ${p.endDate}`);
        });
    }

    console.log("\n--- Checking School Settings ---");
    const settings = await db.select().from(schoolSettings).limit(1);
    if (settings.length > 0) {
        console.log(`spmbIsOpen: ${settings[0].spmbIsOpen}`);
    } else {
        console.log("No school settings found (using defaults).");
    }
}

checkSPMBStatus();
