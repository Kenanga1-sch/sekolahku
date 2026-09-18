"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarPlus, CalendarCheck, Wallet, Bell, User, LogOut, MessageCircle, Undo2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { cn } from "@/lib/utils";
import { goGet } from "@/lib/api-client";
import { returnToAdminAction } from "@/actions/auth";

const NAV = [
  { href: "/parent", label: "Beranda", icon: Home },
  { href: "/parent/presensi", label: "Presensi", icon: CalendarCheck },
  { href: "/parent/tabungan", label: "Tabungan", icon: Wallet },
  { href: "/parent/izin", label: "Izin/Sakit", icon: CalendarPlus },
  { href: "/parent/chat", label: "Pesan", icon: MessageCircle },
  { href: "/parent/notifikasi", label: "Notifikasi", icon: Bell },
  { href: "/parent/profil", label: "Profil", icon: User },
];

export default function ParentLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  // Sesuatu hasil /api/auth/switch (cookie user_info.imp). Tombol kembali
  // ke akun admin hanya muncul di sesi yang sedang di-impersonasi.
  const impersonating = !!(user as any)?.impersonatedBy;

  useEffect(() => {
    if (!isLoading && user && user.role && user.role !== "orangtua") {
      router.replace("/overview");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const data = await goGet<{ unreadCount: number }>("/api/notifications/stats");
        if (!cancelled) setUnreadCount(data.unreadCount);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="h-dvh bg-muted/30 flex flex-col">
      <header className="shrink-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-1 px-3 sm:px-4 h-14">
          <Link href="/parent" className="font-semibold text-sm truncate">
            Portal Orang Tua
          </Link>
          <div className="flex items-center gap-1">
            <PwaInstallButton iconOnly className="sm:hidden" />
            <PwaInstallButton className="hidden sm:flex" />
            <ThemeToggle />
            {impersonating && (
              <button
                onClick={() => returnToAdminAction()}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                title="Kembali ke akun admin"
              >
                <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline">Kembali ke Admin</span>
              </button>
            )}
            <Link
              href="/parent/notifikasi"
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-muted"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              title="Keluar"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto mx-auto w-full max-w-2xl px-4 py-5 pb-24 md:pb-6">{children}</main>

      {/* Navigasi bawah khusus mobile (fixed, 1 baris) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur sm:hidden">
        <div className="mx-auto max-w-2xl grid grid-cols-7">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 text-[9px] transition-colors",
                  active ? "text-primary font-medium" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Navigasi bawah khusus desktop (mengalir, tidak menumpuk konten) */}
      <nav className="hidden sm:flex shrink-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl w-full flex items-center justify-center gap-1 px-4 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
