"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarPlus, Bell, User, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/parent", label: "Beranda", icon: Home },
  { href: "/parent/izin", label: "Izin/Sakit", icon: CalendarPlus },
  { href: "/parent/notifikasi", label: "Notifikasi", icon: Bell },
  { href: "/parent/profil", label: "Profil", icon: User },
];

export default function ParentLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  // Portal ini khusus orang tua — role lain dialihkan ke dashboard staf.
  useEffect(() => {
    if (!isLoading && user && user.role && user.role !== "orangtua") {
      router.replace("/overview");
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-[100dvh] bg-muted/30 flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-2 px-4 h-14">
          <Link href="/parent" className="font-semibold text-sm truncate">
            Portal Orang Tua
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              title="Keluar"
            >
              <LogOut className="h-4 w-4" /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-5 pb-24">{children}</main>

      {/* Navigasi bawah khusus mobile */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur sm:hidden">
        <div className="mx-auto max-w-2xl grid grid-cols-4">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-primary font-medium" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Navigasi atas khusus desktop */}
      <nav className="hidden sm:flex fixed bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-full border bg-background shadow-lg px-2 py-1.5 gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" /> {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
