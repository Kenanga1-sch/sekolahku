import React from "react";
import { db } from "@/db";
import { schoolSettings } from "@/db/schema/misc";
import DashboardLayoutClient from "./layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch school settings
  // Since it's a singleton table, we just get the first record
  const settingsArray = await db.select().from(schoolSettings).limit(1);
  const settings = settingsArray[0];

  return (
    <DashboardLayoutClient schoolSettings={settings}>
      {children}
    </DashboardLayoutClient>
  );
}
