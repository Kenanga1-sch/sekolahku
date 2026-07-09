"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  GraduationCap,
  Bell,
  LogOut,
  User,
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
  ArrowRight,
  ShieldCheck,
  Globe,
  Banknote,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronUp,
  Menu,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
const NotificationPopover = dynamic(
  () => import("@/components/notification-popover").then((mod) => mod.NotificationPopover),
  {
    ssr: false,
    loading: () => <Bell className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />,
  }
);
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SchoolSettings } from "@/types";

// Page title mapping for mobile header
const PAGE_TITLES: Record<string, string> = {
  "/overview": "Beranda",
  "/perpustakaan": "Perpustakaan",
  "/inventaris": "Inventaris",
  "/arsip": "E-Arsip",
  "/tabungan": "Tabungan",
  "/admin/master/gtk": "Direktori GTK",
  "/admin/akademik": "Akademik",
  "/admin/siswa": "Manajemen Siswa",
  "/presensi": "Presensi",
  "/admin/konten-informasi": "Informasi",
  "/admin/halaman-depan": "Halaman Depan",
  "/profile": "Profil",
  "/admin/notifikasi": "Notifikasi",
  "/admin/surat": "Surat",
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match (longest match first)
  const sorted = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (pathname.startsWith(key)) return PAGE_TITLES[key];
  }
  return "Dashboard";
}

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
const ALL_DASHBOARD_ROLES: UserRole[] = ["admin", "superadmin", "guru", "staff"];
const TABUNGAN_ROLES: UserRole[] = ["admin", "superadmin", "guru", "staff"]; 

const navGroups: NavGroup[] = [
  {
    label: "Menu Utama",
    items: [
      { href: "/overview", label: "Beranda", icon: LayoutDashboard, roles: ALL_DASHBOARD_ROLES },
      { href: "/perpustakaan", label: "Perpustakaan", icon: Library, roles: ADMIN_ROLES },
      { href: "/inventaris", label: "Inventaris", icon: Package, roles: INVENTARIS_ROLES },
      { href: "/arsip", label: "E-Arsip", icon: FileText, roles: ADMIN_ROLES },
    ],
  }, 
  {
      label: "Keuangan",
      items: [
          { href: "/tabungan", label: "Tabungan Siswa", icon: Wallet, roles: TABUNGAN_ROLES },
      ]
  },
  {
      label: "Pusat Data",
      items: [
          { href: "/admin/master/gtk", label: "Direktori GTK", icon: IdCard, roles: ADMIN_ROLES },
          { href: "/admin/akademik", label: "Kelas & Akademik", icon: BookOpen, roles: ADMIN_ROLES },
      ]
  },


  {
    label: "Kesiswaan",
    items: [
      { href: "/admin/siswa", label: "Manajemen Siswa", icon: Users, roles: ADMIN_ROLES },
      { href: "/presensi", label: "Presensi", icon: ClipboardList, roles: GURU_ACCESS_ROLES },
    ],
  },
  {
    label: "Komunikasi & Konten",
    items: [
      { href: "/admin/konten-informasi", label: "Pusat Informasi", icon: Megaphone, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Pengaturan Website",
    items: [
      { href: "/admin/halaman-depan", label: "Halaman Depan", icon: LayoutDashboard, roles: ADMIN_ROLES },
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
        .filter((item): item is NavItem => item !== null);

      return {
        ...group,
        items: filteredItems,
      };
    })
    .filter((group) => group.items.length > 0);
}



export default function DashboardLayoutClient({
  children,
  schoolSettings,
}: {
  children: React.ReactNode;
  schoolSettings?: SchoolSettings;
}) {
  const { user, logout, isLoading: authLoading } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false); // Sidebar open state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // Track dropdown state
  const [sidebarVisible, setSidebarVisible] = useState(true); // Sidebar completely hidden/visible
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Custom setOpen handler to prevent closing when dropdown is open
  const handleSetOpen = (value: boolean | ((prevState: boolean) => boolean)) => {
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
  };
  const router = useRouter();
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isReallyMounted = mounted && !authLoading;
  const rawRole = isReallyMounted ? (user?.role || (user as any)?.Role || null) : null;
  // Normalize role to lowercase
  const normalizedRaw = typeof rawRole === "string" ? rawRole.toLowerCase() : null;
  
  const filteredNav = normalizedRaw ? filterNavByRole(navGroups, normalizedRaw as UserRole) : [];
  const displayName = isReallyMounted && user?.name ? user.name : "Admin";
  const displayInitials = isReallyMounted && user?.name ? user.name.substring(0, 2).toUpperCase() : "A";
  const userImage = isReallyMounted && user?.image
    ? (user.image.startsWith("http") || user.image.startsWith("/") ? user.image : `/uploads/${user.image}`)
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;
  
  const { settings } = useSchoolSettings();
  const schoolName = settings?.school_name || "Sekolahku";
  const schoolLogo = settings?.school_logo 
    ? (settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/") 
      ? settings.school_logo 
      : `/uploads/${settings.school_logo}`) 
    : "/logo.png";
  const schoolInitial = schoolName.substring(0, 2).toUpperCase();

  return (
    <div className={cn(
      "flex min-w-0 flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 overflow-x-hidden md:overflow-hidden",
      "min-h-dvh md:h-dvh"
    )}>
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarVisible((prev) => !prev)}
        className={cn(
          "hidden md:flex fixed top-1/2 -translate-y-1/2 z-[60] h-12 w-5 rounded-r-md border border-l-0 border-neutral-200 dark:border-neutral-700 shadow-sm items-center justify-center transition-all cursor-pointer group",
          "bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700",
          sidebarVisible
            ? "left-[280px] xl:left-[300px]"
            : "left-0"
        )}
        aria-label={sidebarVisible ? "Sembunyikan navigasi" : "Tampilkan navigasi"}
      >
        <PanelLeftClose className={cn("h-3.5 w-3.5 transition-transform", !sidebarVisible && "rotate-180")} />
      </button>

      <div className={cn("flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden h-0 md:h-full", sidebarVisible ? "max-w-[300px]" : "max-w-0")}>
      <Sidebar open={open} setOpen={handleSetOpen} animate={false}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Logo */}
            <div className="flex flex-col">
                <Link href="#" className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20">
                    <div className="h-6 w-6 relative flex-shrink-0 rounded-full bg-black dark:bg-white flex items-center justify-center overflow-hidden">
                        {schoolLogo ? (
                           <Image src={schoolLogo} alt="Logo" width={24} height={24} className="h-full w-full object-cover" />
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
              {!isReallyMounted ? (
                // Loading Skeletons for Sidebar
                <div className="flex flex-col gap-4 px-2">
                   {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 w-full animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded-md" />
                   ))}
                </div>
              ) : (
                filteredNav.map((group) => (
                   <div key={group.label} className="flex flex-col gap-1">
                      {group.items.map((link) => {
                        if (link.items) {
                          const isOpen = !!openMenus[link.label];
                          return (
                            <div key={link.label} className="flex flex-col">
                              <button
                                onClick={() => toggleMenu(link.label)}
                                className="flex items-center justify-between w-full py-2 text-left group/sidebar cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <link.icon className="text-neutral-700 dark:text-neutral-200 h-[18px] w-[18px] md:h-5 md:w-5 flex-shrink-0" />
                                  <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre">
                                    {link.label}
                                  </span>
                                </div>
                                {isOpen ? (
                                  <ChevronUp className="h-4 w-4 text-neutral-500 dark:text-neutral-400 mr-1" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-neutral-500 dark:text-neutral-400 mr-1" />
                                )}
                              </button>
                              {isOpen && (
                                <div className="pl-6 flex flex-col border-l border-neutral-200 dark:border-neutral-700 ml-3.5 gap-1 mt-1">
                                  {link.items.map((subItem) => (
                                    <SidebarLink
                                      key={subItem.href}
                                      link={{
                                        label: subItem.label,
                                        href: subItem.href,
                                        icon: subItem.icon ? (
                                          <subItem.icon className="text-neutral-500 dark:text-neutral-400 h-4 w-4 flex-shrink-0" />
                                        ) : (
                                          <div className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 ml-1.5 mr-1 flex-shrink-0" />
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
                                <link.icon className="text-neutral-700 dark:text-neutral-200 h-[18px] w-[18px] md:h-5 md:w-5 flex-shrink-0" />
                              ),
                            }}
                          />
                        );
                      })}
                   </div>
                ))
              )}
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 md:static flex items-center justify-between gap-2 p-2.5 sm:p-3 md:p-4 w-full z-40 bg-gray-100/80 dark:bg-neutral-800/80 backdrop-blur-xl md:bg-transparent md:dark:bg-transparent border-b border-neutral-200/50 dark:border-neutral-700/50 md:border-0">
            {/* Left: Hamburger + Page Title (mobile only) */}
            <div className="flex items-center gap-3 md:hidden">
              <button
                onClick={() => handleSetOpen(true)}
                className="p-1.5 -ml-1 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 active:scale-95 transition-all"
                aria-label="Buka menu"
              >
                <Menu className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
              </button>
              <h1 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                {pageTitle}
              </h1>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 p-1 md:p-2 ml-auto">
             {/* Theme Toggle */}
             <div className="flex items-center justify-center">
                <ThemeToggle />
             </div>

             {/* Notification */}
             <div className={cn("flex items-center justify-center")}>
                <NotificationPopover className="h-5 w-5 text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white transition-colors" />
             </div>

             {/* Profile Dropdown */}
            {mounted ? (
              <DropdownMenu onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 md:h-auto md:w-auto rounded-full md:rounded-xl p-0 md:px-3 md:py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:ring-0 focus-visible:ring-offset-0">
                     <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-8 md:w-8 flex-shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden ring-2 ring-transparent transition-all">
                        <Avatar className="h-full w-full">
                           <AvatarImage src={userImage} className="object-cover" />
                           <AvatarFallback>{displayInitials}</AvatarFallback>
                        </Avatar>
                     </div>
                     <div className="hidden md:flex flex-col items-start ml-2">
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{displayName}</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">{normalizedRaw}</span>
                     </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" className="w-56" sideOffset={8}>
                  <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profil Saya</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push("/")}>
                    <Globe className="mr-2 h-4 w-4" />
                    <span>Kunjungi Website</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/10" onClick={() => { logout(); router.push("/login");}}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Keluar</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="h-8 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded-md" />
            )}
            </div>
          </header>

         <main id="main-content" className="flex min-w-0 flex-1 flex-col gap-2 overflow-x-hidden px-3 pb-20 pt-2 sm:px-4 md:h-full md:overflow-y-auto md:rounded-tl-2xl md:px-5 md:pb-6 md:pt-4 lg:px-6 xl:px-8">
            {children}
         </main>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <BottomNav onMenuClick={() => handleSetOpen(true)} />
    </div>
  );
}


