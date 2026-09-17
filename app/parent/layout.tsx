"use client";

import React from "react";
import ParentLayoutClient from "./layout-client";
import { AuthGuard } from "@/components/auth-guard";
import { ChatSocketProvider } from "@/components/chat/chat-socket-provider";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ChatSocketProvider>
        <ParentLayoutClient>{children}</ParentLayoutClient>
      </ChatSocketProvider>
    </AuthGuard>
  );
}
