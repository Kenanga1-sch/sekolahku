"use client";

import React from "react";
import ParentLayoutClient from "./layout-client";
import { AuthGuard } from "@/components/auth-guard";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ParentLayoutClient>{children}</ParentLayoutClient>
    </AuthGuard>
  );
}
