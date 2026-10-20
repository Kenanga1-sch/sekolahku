"use client";

import Footer from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, User, LogIn, LayoutDashboard, Home, GraduationCap, Briefcase, Users, Newspaper, BookOpen } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { useState, useEffect, useLayoutEffect } from "react";

// Aplikasi yang dipasang (PWA standalone) melewati semua halaman publik dan
// langsung masuk ke aplikasi: login bila belum terauth, atau home per role.
// Browser biasa (mobile maupun desktop) tetap menampilkan halaman publik.
function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

// useLayoutEffect di klien, useEffect di SSR (hindari warning).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { siteConfig } from "@/lib/config";

const navItems = [
  { id: "home", label: "Beranda", href: "/", icon: Home },
  { id: "spmb", label: "SPMB", href: "/spmb", icon: GraduationCap },
  { id: "layanan", label: "Layanan", href: "/layanan", icon: Briefcase },
  { id: "katalog", label: "Perpustakaan", href: "/katalog-buku", icon: BookOpen },
  { id: "berita", label: "Berita", href: "/berita", icon: Newspaper },
  { id: "guru", label: "Guru & Staf", href: "/guru-staf", icon: Users },
];

export default function PublicLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, logout: storeLogout, isLoading } = useAuthStore();
  const { settings } = useSchoolSettings();
  const [mounted, setMounted] = useState(false);
  const [pwaRedirect, setPwaRedirect] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // PWA standalone: jangan pernah tampilkan konten publik. Tunggu sesi
  // terverifikasi dulu (isLoading), lalu arahkan ke login atau home per role.
  useIsomorphicLayoutEffect(() => {
    if (!isStandalonePWA()) return;
    setPwaRedirect(true);
    if (isLoading) return;
    const home = isAuthenticated
      ? user?.role === "staff"
        ? "/inventaris"
        : user?.role === "orangtua"
        ? "/parent"
        : "/overview"
      : "/login";
    router.replace(home);
  }, [isLoading, isAuthenticated, user, router]);

  const handleLogout = async () => {
    await logoutAction();
    storeLogout();
    window.location.href = "/login";
  };

  if (pwaRedirect) return null;

  return (
    <div className="flex flex-col bg-public-bg text-foreground w-full min-h-screen">
      <header className="app-chrome sticky top-0 z-50 hidden border-b border-line/60 bg-surface/85 backdrop-blur-xl md:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight text-primary">
          {settings?.school_name || siteConfig.school.shortName}
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {mounted && isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 h-auto rounded-full border border-public-border hover:bg-secondary/30 cursor-pointer active:scale-[0.97] transition-all"
                >
                  <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                    {user.image ? (
                      <Image src={user.image} alt={user.name || "User"} width={28} height={28} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-primary">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" className="w-56" sideOffset={8}>
                {(user.role === "admin" || user.role === "superadmin") && (
                  <DropdownMenuItem asChild>
                    <Link href="/overview" className="cursor-pointer gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer gap-2">
                    <Settings className="h-4 w-4" />
                    Profil Saya
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer gap-2">
                  <LogOut className="h-4 w-4" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
            >
              Masuk
            </Link>
          )}
        </div>
        </div>
      </header>

      <main className="flex-1 w-full pb-20 md:pb-0">
        {children}
      </main>

      <Footer />

      <nav className="app-chrome safe-area-pb fixed bottom-0 left-0 right-0 z-50 border-t border-line/60 bg-surface/95 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors active:scale-[0.98]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Tombol Masuk mengambang ala FAB chat — hanya mobile, hanya untuk pengunjung yang belum login.
          Mengambang di atas bottom-nav (bottom-20) agar tak menutupi navigasi. */}
      {mounted && !isAuthenticated && (
        <Link
          href="/login"
          aria-label="Masuk ke dashboard"
          className="fixed right-4 bottom-20 z-50 md:hidden flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 ring-4 ring-white/60 backdrop-blur-sm active:scale-90 transition-transform"
        >
          <LogIn className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
