
import { db } from "@/db";
import { spmbPeriods } from "@/db/schema/spmb";
import { eq } from "drizzle-orm";

async function checkPeriod() {
  try {
    const periods = await db.select().from(spmbPeriods);
    console.log("Total periods:", periods.length);
    const active = periods.find(p => p.isActive);
    if (active) {
      console.log("Active period found:", active.name, active.academicYear);
    } else {
      console.log("No active period found!");
    }
  } catch (error) {
    console.error("Error checking periods:", error);
  } finally {
    process.exit(0);
  }
}

checkPeriod();
