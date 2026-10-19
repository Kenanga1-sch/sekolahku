"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarPlus, Wallet, Bell, User, MessageCircle, ClipboardList, Sprout, Backpack, ArrowRightLeft } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { getSchoolLogo } from "@/lib/school-logo";
import { APP_VERSION } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { BottomNav, type BottomNavItem } from "@/components/ui/bottom-nav";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { AccountAvatarMenu } from "@/components/ui/account-avatar-menu";
import { goGet } from "@/lib/api-client";
import { useStableViewportHeight } from "@/lib/hooks/use-viewport-height";

// Daftar sumber lengkap (urutan di sini tidak menentukan tampilan).
const NAV_ITEMS: BottomNavItem[] = [
  { href: "/parent", label: "Beranda", icon: Home, exact: true },
  { href: "/parent/tabungan", label: "Tabungan", icon: Wallet },
  { href: "/parent/presensi", label: "Presensi", icon: ClipboardList },
  { href: "/parent/perkembangan", label: "Perkembangan", icon: Sprout },
  { href: "/parent/tugas", label: "Tugas", icon: Backpack },
  { href: "/parent/chat", label: "Pesan", icon: MessageCircle },
  { href: "/parent/izin", label: "Izin/Sakit", icon: CalendarPlus },
  { href: "/parent/mutasi", label: "Mutasi", icon: ArrowRightLeft },
  { href: "/parent/notifikasi", label: "Notifikasi", icon: Bell },
  { href: "/parent/profil", label: "Profil", icon: User },
];

// Urutkan berdasar abjad label (Indonesia-aware). Dipakai untuk sidebar
// desktop dan bottom sheet mobile ("Menu Navigasi") yang berbagi daftar sama.
const byLabel = (a: BottomNavItem, b: BottomNavItem) =>
  a.label.localeCompare(b.label, "id", { sensitivity: "base" });
const NAV_ITEMS_SORTED: BottomNavItem[] = [...NAV_ITEMS].sort(byLabel);

// Slot bottom nav mobile di-pin (3 pertama mengisi slot link; sisanya di sheet).
const MOBILE_PINNED_HREFS = ["/parent", "/parent/tabungan", "/parent/presensi"];
const NAV_ITEMS_MOBILE: BottomNavItem[] = MOBILE_PINNED_HREFS
  .map((href) => NAV_ITEMS.find((item) => item.href === href))
  .filter((item): item is BottomNavItem => Boolean(item));

// Judul halaman di header mobile (pola sama dengan dashboard).
const PAGE_TITLES: Record<string, string> = {
  "/parent": "Beranda",
  "/parent/presensi": "Presensi",
  "/parent/perkembangan": "Perkembangan Anak",
  "/parent/tabungan": "Tabungan",
  "/parent/izin": "Izin/Sakit",
  "/parent/mutasi": "Mutasi Keluar",
  "/parent/chat": "Pesan",
  "/parent/notifikasi": "Notifikasi",
  "/parent/profil": "Profil",
};

const PAGE_TITLE_KEYS = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const key of PAGE_TITLE_KEYS) {
    if (pathname.startsWith(key)) return PAGE_TITLES[key];
  }
  return "Portal Orang Tua";
}

export default function ParentLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { settings } = useSchoolSettings();
  // Jaga --app-vh agar tinggi viewport stabil (fix room chat menyusut di
  // PWA Android setelah keyboard / navigasi).
  useStableViewportHeight();

  const schoolName = settings?.school_name || "Sekolahku";
  const schoolLogo = getSchoolLogo(settings?.school_logo);
  const schoolInitial = schoolName.substring(0, 2).toUpperCase();
  const pageTitle = getPageTitle(pathname);

  // Hanya orangtua yang boleh mengakses portal ini.
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
    <div className={cn(
      "flex min-w-0 flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 overflow-x-hidden md:overflow-hidden",
      "min-h-dvh md:h-dvh print:block print:h-auto print:min-h-0 print:overflow-visible",
    )}>
      {/* Sidebar: persisten di desktop, bottom sheet di mobile (dibuka via FAB) */}
      <div className="print:hidden flex-shrink-0 overflow-hidden h-0 md:h-full">
        <Sidebar open={open} setOpen={setOpen} animate={false}>
          <SidebarBody className="justify-between gap-10">
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex flex-col">
                <Link href="/parent" className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20">
                  <div className={cn(
                    "h-6 w-6 relative flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden",
                    !schoolLogo && "bg-black dark:bg-white",
                  )}>
                    {schoolLogo ? (
                      <Image src={schoolLogo} alt="Logo" width={24} height={24} className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-white dark:text-black font-bold text-xs">{schoolInitial}</span>
                    )}
                  </div>
                  <span className="font-medium text-black dark:text-white whitespace-pre opacity-100 truncate">
                    {schoolName}
                  </span>
                </Link>
              </div>

              <div className="mt-6 md:mt-8 flex flex-col gap-2 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
                {NAV_ITEMS_SORTED.map((item) => (
                  <SidebarLink
                    key={item.href}
                    link={{
                      label: item.label,
                      href: item.href,
                      icon: <item.icon className="text-neutral-700 dark:text-neutral-200 h-[18px] w-[18px] md:h-5 md:w-5 flex-shrink-0" />,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-auto pt-4 pb-2 px-2">
              <span className="text-[10px] text-muted-foreground/70 font-mono tracking-widest select-none print:hidden">
                {APP_VERSION}
              </span>
            </div>
          </SidebarBody>
        </Sidebar>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="print:hidden sticky top-0 md:static flex items-center justify-between gap-2 p-2.5 sm:p-3 md:p-4 w-full z-40 bg-gray-100/80 dark:bg-neutral-800/80 backdrop-blur-xl md:bg-transparent md:dark:bg-transparent border-b border-neutral-200/50 dark:border-neutral-700/50 md:border-0">
          {/* Judul halaman (mobile only) */}
          <div className="flex items-center gap-3 md:hidden pl-2">
            <h1 className="text-lg font-bold text-neutral-800 dark:text-neutral-100 truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 md:gap-4 ml-auto">
            <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
              <PwaInstallButton iconOnly className="sm:hidden" />
              <PwaInstallButton className="hidden sm:flex" />
            </div>
            <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
              <Link
                href="/parent/notifikasi"
                className="relative inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Notifikasi"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            </div>
            {/* Avatar menu (desktop; di mobile ada di slot ke-4 bottom nav) */}
            <div className="hidden md:block">
              <AccountAvatarMenu
                placement="header"
                profileHref="/parent/profil"
                showSettings={false}
                websiteHref="/"
              />
            </div>
          </div>
        </header>

        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden px-3 pb-20 pt-2 sm:px-4 md:h-full md:overflow-y-auto md:px-5 md:pb-6 md:pt-4 lg:px-6 xl:px-8 print:h-auto print:overflow-visible">
          <React.Fragment key={pathname}>
            <div className="mx-auto w-full max-w-2xl md:h-full">{children}</div>
          </React.Fragment>
        </main>
      </div>

      {/* Bottom nav mobile: 3 slot link + FAB (buka bottom sheet) + avatar */}
      <div className="print:hidden">
        <BottomNav items={NAV_ITEMS_MOBILE} onMenuClick={() => setOpen(true)} profileHref="/parent/profil" />
      </div>
    </div>
  );
}
