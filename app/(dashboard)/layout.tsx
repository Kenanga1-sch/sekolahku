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
    schoolName: "Sekolahku",
    schoolAddress: "",
    schoolPhone: "",
    schoolEmail: "",
    schoolWebsite: "",
    logoUrl: "",
  };

  return (
    <AuthGuard>
      <DashboardLayoutClient schoolSettings={settings}>
        {children}
      </DashboardLayoutClient>
    </AuthGuard>
  );
}
