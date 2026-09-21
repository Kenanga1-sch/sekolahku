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
    <div className="flex flex-col bg-public-bg text-[#1a2e1a] w-full min-h-screen">
      <header className="app-chrome hidden md:flex items-center justify-between px-6 py-4 sticky top-0 z-50 bg-public-bg/95 backdrop-blur-sm border-b border-public-border">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-[#065F46]">
          {settings?.school_name || siteConfig.school.shortName}
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.id} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "rounded-full px-4 h-9 text-sm font-medium transition-transform active:scale-[0.97]",
                    isActive
                      ? "bg-[#065F46] text-white hover:bg-[#065F46]"
                      : "text-[#4b6b4b] hover:text-[#065F46] hover:bg-[#A7F3D0]/50"
                  )}
                >
                  {item.label}
                </Button>
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
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 h-auto rounded-full border border-public-border hover:bg-[#A7F3D0]/30 cursor-pointer active:scale-[0.97] transition-all"
                >
                  <div className="h-7 w-7 rounded-full bg-[#A7F3D0] flex items-center justify-center overflow-hidden">
                    {user.image ? (
                      <Image src={user.image} alt={user.name || "User"} width={28} height={28} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-[#065F46]" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-[#065F46]">{user.name}</span>
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
            <Link href="/login">
              <Button className="rounded-full bg-[#065F46] text-white hover:bg-[#047857] px-5 h-9 text-sm font-medium active:scale-[0.97] transition-transform">
                Masuk
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 w-full pb-20 md:pb-0">
        {children}
      </main>

      <Footer />

      <nav className="app-chrome md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-public-border safe-area-pb">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors active:scale-[0.95]",
                  isActive
                    ? "text-[#065F46]"
                    : "text-[#4b6b4b] hover:text-[#065F46]"
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
          className="fixed right-4 bottom-20 z-50 md:hidden flex h-14 w-14 items-center justify-center rounded-full bg-[#065F46] text-white shadow-lg shadow-[#065F46]/40 ring-4 ring-white/60 backdrop-blur-sm active:scale-90 transition-transform"
        >
          <LogIn className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
