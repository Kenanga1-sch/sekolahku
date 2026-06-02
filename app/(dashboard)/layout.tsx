"use client";

import React from "react";
import DashboardLayoutClient from "./layout-client";
import { AuthGuard } from "@/components/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // We can't fetch settings here easily without a provider or useEffect.
  // For static export, we'll let the client layout handle it.
  const settings = {
    id: "default",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    school_name: "Sekolahku",
    school_address: "",
    school_phone: "",
    school_email: "",
    school_website: "",
    school_logo: "",
    school_lat: 0,
    school_lng: 0,
    max_distance_km: 10,
    spmb_is_open: true,
  };

  return (
    <AuthGuard>
      <DashboardLayoutClient schoolSettings={settings}>
        {children}
      </DashboardLayoutClient>
    </AuthGuard>
  );
}
