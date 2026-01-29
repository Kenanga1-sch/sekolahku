import { RegistrationPageClient } from "@/components/spmb/registration-page-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pendaftaran Siswa Baru",
  description: "Formulir pendaftaran Penerimaan Peserta Didik Baru (PPDB) SDN 1 Kenanga.",
};

import { db } from "@/db";
import { schoolSettings } from "@/db/schema/misc";
import { siteConfig } from "@/lib/config";

export default async function RegistrationPage() {
  // Fetch settings from DB
  let settings = null;
  try {
    const [dbSettings] = await db.select().from(schoolSettings).limit(1);
    settings = dbSettings;
  } catch (error) {
    console.error("Failed to fetch school settings for registration page:", error);
  }

  // Use DB settings or fallback to siteConfig
  const schoolLat = settings?.schoolLat ?? siteConfig.location.lat;
  const schoolLng = settings?.schoolLng ?? siteConfig.location.lng;
  const maxDistanceKm = settings?.maxDistanceKm ?? siteConfig.location.maxDistanceKm;

  return (
    <RegistrationPageClient 
      schoolLat={schoolLat} 
      schoolLng={schoolLng} 
      maxDistanceKm={maxDistanceKm} 
    />
  );
}

