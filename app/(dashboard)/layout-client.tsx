"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Bell,
  Home,
  BookOpen,
  ExternalLink,
  Package,
  Wallet,
  IdCard,
  ClipboardList,
  Mail,
  Megaphone,
  Image as ImageIcon,
  ArrowRightLeft,
  FileText,
  Library,
  MonitorPlay,
  ArrowRight,
  ShieldCheck,
  Globe,
  Banknote,
  PanelLeftClose,
  PanelLeftOpen,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Menu,
  Sprout,
  Backpack,
  Printer,
  Cloud,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { getSchoolLogo } from "@/lib/school-logo";
import { resolveUploadUrl } from "@/lib/upload-url";
import { APP_VERSION } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { getBreadcrumbItems, getPageTitle } from "@/lib/page-titles";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import type { UserRole } from "@/types";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { AccountAvatarMenu } from "@/components/ui/account-avatar-menu";
import { useStableViewportHeight } from "@/lib/hooks/use-viewport-height";
import { LayoutChromeProvider, useLayoutChrome } from "@/lib/contexts/layout-chrome-context";
import dynamic from "next/dynamic";
const NotificationPopover = dynamic(
  () => import("@/components/notification-popover").then((mod) => mod.NotificationPopover),
  {
    ssr: false,
    loading: () => <Bell className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />,
  }
);
import type { SchoolSettings } from "@/types";

// --- Navigation Config (Preserved) ---
interface SubNavItem {
  href: string;
  label: string;
  icon?: any;
  roles?: UserRole[];
}

interface NavItem {
  href?: string;
  label: string;
  icon: any;
  roles?: UserRole[];
  items?: SubNavItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ADMIN_ROLES: UserRole[] = ["admin", "superadmin"];
const SYSTEM_ADMIN_ROLES: UserRole[] = ["admin", "superadmin"];
const INVENTARIS_ROLES: UserRole[] = ["admin", "superadmin", "guru", "staff"];
const GURU_ACCESS_ROLES: UserRole[] = ["admin", "superadmin", "guru"]; 
const DOCSTATION_ROLES: UserRole[] = ["admin", "superadmin", "staff"];
const CLOUDSTORAGE_ROLES: UserRole[] = ["admin", "superadmin", "staff", "guru"];
const ALL_DASHBOARD_ROLES: UserRole[] = ["admin", "superadmin", "guru", "staff", "siswa"];
const TABUNGAN_ROLES: UserRole[] = ["admin", "superadmin", "guru", "staff"];
const KEUANGAN_ROLES: UserRole[] = ["admin", "superadmin", "bendahara", "guru", "staff"];
const SISWA_ROLES: UserRole[] = ["siswa"];

const navGroups: NavGroup[] = [
  {
    label: "Menu Siswa",
    items: [
      { href: "/overview", label: "Beranda", icon: LayoutDashboard, roles: SISWA_ROLES },
      { href: "/praktik", label: "Latihan Soal", icon: BookOpen, roles: SISWA_ROLES },
      { href: "/tugas-saya", label: "Tugas Saya", icon: Backpack, roles: SISWA_ROLES },
      { href: "/ruang-tumbuh", label: "Ruang Tumbuh", icon: Sprout, roles: SISWA_ROLES },
      { href: "/presensi/saya", label: "Presensi Saya", icon: ClipboardList, roles: SISWA_ROLES },
      { href: "/tabungan/saya", label: "Tabungan Saya", icon: Wallet, roles: SISWA_ROLES },
      { href: "/perpustakaan/saya/laporan-baca", label: "Komputer Belajar", icon: MonitorPlay, roles: SISWA_ROLES },
    ],
  },
  {
    label: "Menu Utama",
    items: [
      { href: "/overview", label: "Beranda", icon: LayoutDashboard, roles: ALL_DASHBOARD_ROLES },
      { href: "/chat", label: "Pesan", icon: MessageCircle, roles: ALL_DASHBOARD_ROLES },
      { href: "/perpustakaan", label: "Perpustakaan", icon: Library, roles: ADMIN_ROLES },
      { href: "/inventaris", label: "Inventaris", icon: Package, roles: INVENTARIS_ROLES },
      { href: "/arsip", label: "E-Arsip", icon: FileText, roles: ADMIN_ROLES },
      { href: "/docstation", label: "DocStation", icon: Printer, roles: DOCSTATION_ROLES },
      { href: "/cloud-storage", label: "Cloud Storage", icon: Cloud, roles: CLOUDSTORAGE_ROLES },
      { href: "/keuangan", label: "Keuangan", icon: Banknote, roles: KEUANGAN_ROLES },
    ],
  },
  {
    label: "Manajemen Siswa",
    items: [
      { href: "/admin/siswa", label: "Manajemen Siswa", icon: Users, roles: GURU_ACCESS_ROLES },
      { href: "/bank-soal", label: "Bank Soal", icon: BookOpen, roles: GURU_ACCESS_ROLES },
      { href: "/presensi", label: "Presensi", icon: ClipboardList, roles: GURU_ACCESS_ROLES },
      { href: "/tabungan", label: "Tabungan Siswa", icon: Wallet, roles: TABUNGAN_ROLES },
    ],
  },
  {
    label: "Pusat Data",
    items: [
      { href: "/admin/master/gtk", label: "Direktori GTK", icon: IdCard, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Komunikasi & Konten",
    items: [
      { href: "/admin/konten-informasi", label: "Pusat Informasi", icon: Megaphone, roles: ADMIN_ROLES },
    ],
  },
];

function filterNavByRole(groups: NavGroup[], userRole?: UserRole): NavGroup[] {
  if (!userRole) return [];
  const normalizedUserRole = userRole.toLowerCase();
  const isUserAdmin = normalizedUserRole === "admin" || normalizedUserRole === "superadmin";

  const hasAccess = (roles?: UserRole[]) => {
    if (!roles) return true;
    return roles.some((role) => {
      const normalizedRole = role.toLowerCase();
      if (isUserAdmin && (normalizedRole === "admin" || normalizedRole === "superadmin")) return true;
      return normalizedRole === normalizedUserRole;
    });
  };

  return groups
    .map((group) => {
      const filteredItems = group.items
        .map((item) => {
          if (item.items) {
            const filteredSubItems = item.items.filter((subItem) => hasAccess(subItem.roles));
            if (filteredSubItems.length === 0) return null;
            return {
              ...item,
              items: filteredSubItems,
            };
          }
          if (!hasAccess(item.roles)) return null;
          return item;
        })
        .filter((item): item is NavItem => item !== null)
        // Urutkan menu navigasi berdasarkan abjad label (Indonesia-aware).
        .sort((a, b) => a.label.localeCompare(b.label, "id", { sensitivity: "base" }));

      return {
        ...group,
        items: filteredItems,
      };
    })
    .filter((group) => group.items.length > 0);
}



export default function DashboardLayoutClient(props: {
  children: React.ReactNode;
  schoolSettings?: SchoolSettings;
}) {
  return (
    <LayoutChromeProvider>
      <DashboardLayoutChrome {...props} />
    </LayoutChromeProvider>
  );
}

function DashboardLayoutChrome({
  children,
  schoolSettings,
}: {
  children: React.ReactNode;
  schoolSettings?: SchoolSettings;
}) {
  const { immersive } = useLayoutChrome();
  const { user, logout, isLoading: authLoading } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  // Jaga --app-vh agar tinggi viewport stabil (fix room chat menyusut di
  // PWA Android setelah keyboard / navigasi).
  useStableViewportHeight();
  const [open, setOpen] = useState(false); // Sidebar open state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // Track dropdown state
  const [sidebarVisible, setSidebarVisible] = useState(true); // Sidebar completely hidden/visible
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Custom setOpen handler to prevent closing when dropdown is open
  const handleSetOpen = useCallback((value: boolean | ((prevState: boolean) => boolean)) => {
    if (typeof value === "function") {
      setOpen((prev) => {
        const next = value(prev);
        // If trying to close but dropdown is open, keep it open
        if (!next && isDropdownOpen) return true;
        return next;
      });
    } else {
      // If trying to close but dropdown is open, ignore
      if (!value && isDropdownOpen) {
          setOpen(true);
          return;
      }
      setOpen(value);
    }
  }, [isDropdownOpen]);
  const router = useRouter();
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const breadcrumbItems = getBreadcrumbItems(pathname);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const rawRole = mounted && !authLoading ? (user?.role || (user as any)?.Role || null) : null;
  // Normalize role to lowercase
  const normalizedRaw = typeof rawRole === "string" ? rawRole.toLowerCase() : null;
  
  const filteredNav = normalizedRaw ? filterNavByRole(navGroups, normalizedRaw as UserRole) : [];
  const displayName = mounted && !authLoading && user?.name ? user.name : "Admin";
  const displayInitials = mounted && !authLoading && user?.name ? user.name.substring(0, 2).toUpperCase() : "A";
  const userImage = resolveUploadUrl(mounted && !authLoading && user?.image ? user.image : undefined);
  
  // Add role badge display in header for better visibility
  const getRoleInfo = (role: string) => {
    const roles = [
      { value: "superadmin", label: "Super Admin", color: "bg-purple-100 text-purple-700" },
      { value: "admin", label: "Admin", color: "bg-amber-100 text-amber-700" },
      { value: "guru", label: "Guru", color: "bg-blue-100 text-blue-700" },
      { value: "staff", label: "Staff", color: "bg-cyan-100 text-cyan-700" },
      { value: "bendahara", label: "Bendahara", color: "bg-indigo-100 text-indigo-700" },
      { value: "user", label: "User", color: "bg-zinc-100 text-zinc-700" },
      { value: "siswa", label: "Siswa", color: "bg-green-100 text-success" },
      { value: "calon_siswa", label: "Calon Siswa", color: "bg-teal-100 text-teal-700" },
      { value: "orangtua", label: "Orang Tua", color: "bg-rose-100 text-rose-700" },
    ];
    return roles.find((r) => r.value === role) || roles[0];
  };
  
  const { settings } = useSchoolSettings();
  const schoolName = settings?.school_name || "Sekolahku";
  const schoolLogo = getSchoolLogo(settings?.school_logo);
  const schoolInitial = schoolName.substring(0, 2).toUpperCase();

  return (
    <div className={cn(
      "flex min-w-0 flex-col overflow-x-hidden bg-canvas md:flex-row md:overflow-hidden",
      "min-h-dvh w-full flex-1 md:h-dvh print:block print:h-auto print:min-h-0 print:overflow-visible"
    )}>
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarVisible((prev) => !prev)}
        className={cn(
          "group fixed top-1/2 z-[60] hidden h-12 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-r-md border border-l-0 border-line/70 shadow-sm transition-all print:hidden md:flex",
          "bg-surface hover:bg-surface-muted",
          sidebarVisible
            ? "left-64"
            : "left-0"
        )}
        aria-label={sidebarVisible ? "Sembunyikan navigasi" : "Tampilkan navigasi"}
      >
        <PanelLeftClose className={cn("h-3.5 w-3.5 transition-transform", !sidebarVisible && "rotate-180")} />
      </button>

      <div className={cn("print:hidden flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden h-0 md:h-full", sidebarVisible ? "max-w-64" : "max-w-0")}>
      <Sidebar open={open} setOpen={handleSetOpen} animate={false}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Logo */}
            <div className="flex flex-col">
                <Link href="/overview" className="relative z-20 flex items-center gap-2.5 rounded-lg py-1 text-sm text-foreground">
                    <div className={cn(
                        "h-6 w-6 relative flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden",
                        !schoolLogo && "bg-black dark:bg-white"
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
             
              {/* Nav Links */}
            <div className="mt-6 md:mt-8 flex flex-col gap-2 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
              {!(mounted && !authLoading) ? (
                // Loading Skeletons for Sidebar
                <div className="flex flex-col gap-4 px-2">
                   {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 w-full animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded-md" />
                   ))}
                </div>
              ) : (
                filteredNav.map((group) => (
                   <div key={group.label} className="flex flex-col gap-1">
                      <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-soft first:pt-0">
                        {group.label}
                      </p>
                      {group.items.map((link) => {
                        if (link.items) {
                          const isOpen = !!openMenus[link.label];
                          return (
                            <div key={link.label} className="flex flex-col">
                              <button
                                onClick={() => toggleMenu(link.label)}
                                className="group/sidebar -mx-2 flex min-h-11 w-[calc(100%+1rem)] cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-left text-foreground/80 transition-colors hover:bg-surface-muted/70 hover:text-foreground md:min-h-0"
                              >
                                <div className="flex items-center gap-2.5">
                                  <link.icon className="h-[18px] w-[18px] flex-shrink-0 md:h-5 md:w-5" />
                                  <span className="min-w-0 truncate whitespace-pre text-sm transition-transform duration-150 group-hover/sidebar:translate-x-0.5">
                                    {link.label}
                                  </span>
                                </div>
                                {isOpen ? (
                                  <ChevronUp className="mr-1 h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="mr-1 h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                              {isOpen && (
                                <div className="ml-3.5 mt-1 flex flex-col gap-1 border-l border-line/70 pl-5">
                                  {link.items.map((subItem) => (
                                    <SidebarLink
                                      key={subItem.href}
                                      link={{
                                        label: subItem.label,
                                        href: subItem.href,
                                        icon: subItem.icon ? (
                                          <subItem.icon className="h-4 w-4 flex-shrink-0" />
                                        ) : (
                                          <div className="mx-1 ml-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-50" />
                                        ),
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return (
                          <SidebarLink
                            key={link.href}
                            link={{
                              label: link.label,
                              href: link.href!,
                              icon: (
                                <link.icon className="h-[18px] w-[18px] flex-shrink-0 md:h-5 md:w-5" />
                              ),
                            }}
                          />
                        );
                      })}
                   </div>
                ))
              )}
              <div className="mt-auto pt-4 pb-2 px-2">
                <span className="text-[10px] text-muted-foreground font-mono tracking-widest select-none print:hidden">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top Navigation Bar */}
          <header className={cn(
            "print:hidden sticky top-0 z-40 flex w-full items-center justify-between gap-2 border-b border-line/50 bg-canvas/85 p-2.5 backdrop-blur-xl sm:p-3 md:static md:border-0 md:bg-transparent md:p-4 md:backdrop-blur-none",
            immersive && "hidden"
          )}>
            {/* Left: breadcrumb desktop, page title mobile */}
            <div className="hidden min-w-0 items-center gap-3 pl-1 md:flex">
              <BreadcrumbNav
                items={
                  breadcrumbItems.length > 0
                    ? breadcrumbItems
                    : [{ label: "Beranda", href: "/overview", current: true }]
                }
              />
            </div>
            <div className="flex items-center gap-3 pl-2 md:hidden">
              <p className="truncate text-lg font-bold text-foreground">
                {pageTitle}
              </p>
            </div>

            {/* Right: Actions */}
            <div className="ml-auto flex items-center gap-1 sm:gap-3 md:gap-4">
             {/* Install PWA */}
             <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
                <PwaInstallButton iconOnly className="sm:hidden" />
                <PwaInstallButton className="hidden sm:flex" />
             </div>

             {/* Notification */}
             <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
                <NotificationPopover className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
             </div>

              {/* Profile Dropdown (desktop only — mobile accesses akun via bottom nav) */}
            <div className="hidden md:block">
              {mounted ? (
                <AccountAvatarMenu placement="header" />
              ) : (
                <div className="h-8 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded-md" />
              )}
            </div>
            </div>
          </header>

          <main
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            className={cn(
              "outline-none",
              "flex min-w-0 flex-1 flex-col gap-6 overflow-x-hidden px-3 pb-24 pt-4 sm:px-5 md:h-full md:overflow-y-auto md:px-6 md:pb-8 md:pt-5 lg:px-8 xl:px-10 print:h-auto print:overflow-visible [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[1440px]",
              immersive && "gap-0 p-0 md:p-0 [&>*]:max-w-none"
            )}
          >
            <React.Fragment key={pathname}>{children}</React.Fragment>
         </main>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <div className={cn("print:hidden", immersive && "hidden")}>
        <BottomNav onMenuClick={() => handleSetOpen(true)} userRole={normalizedRaw} />
      </div>
    </div>
  );
}


