"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Settings,
  GraduationCap,
  Bell,
  LogOut,
  User,
  Home,
  Activity,
  BookOpen,
  ExternalLink,
  Package,
  Wallet,
  IdCard,
  ClipboardList,
  Mail,
  Image as ImageIcon,
  ArrowRightLeft,
  FileText,
  Library,
  ArrowRight,
  ShieldCheck,
  Globe,
  Banknote,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle"; // Keep theme toggle access
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

// --- Navigation Config (Preserved) ---
interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles?: UserRole[];
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
          { href: "/keuangan/arus-kas", label: "Bendahara BOS", icon: Banknote, roles: ADMIN_ROLES },
          { href: "/tabungan", label: "Tabungan Siswa", icon: Wallet, roles: TABUNGAN_ROLES },
          { href: "/keuangan/tabungan/bendahara", label: "Bendahara Tabungan", icon: ShieldCheck, roles: ADMIN_ROLES },
      ]
  },
  {
      label: "Pusat Data",
      items: [
          { href: "/admin/master/sekolah", label: "Profil Sekolah", icon: Home, roles: ADMIN_ROLES },
          { href: "/admin/master/siswa", label: "Direktori Siswa", icon: Users, roles: ADMIN_ROLES },
          { href: "/admin/master/gtk", label: "Direktori GTK", icon: IdCard, roles: ADMIN_ROLES },
          { href: "/admin/pendidikan/kelas", label: "Data Kelas", icon: BookOpen, roles: ADMIN_ROLES },
          { href: "/admin/pendidikan/kenaikan-kelas", label: "Kenaikan/Kelulusan", icon: ArrowRight, roles: ADMIN_ROLES },
          { href: "/admin/master/akademik", label: "Ref. Akademik", icon: Library, roles: ADMIN_ROLES },
      ]
  },

  {
    label: "Akademik",
    items: [
      { href: "/spmb-admin", label: "Pendaftar", icon: Users, roles: ADMIN_ROLES },
      { href: "/spmb-admin/periods", label: "Periode SPMB", icon: CalendarDays, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Kesiswaan",
    items: [
      { href: "/peserta-didik", label: "Kartu Siswa", icon: IdCard, roles: ADMIN_ROLES },
      { href: "/presensi", label: "Presensi", icon: ClipboardList, roles: GURU_ACCESS_ROLES },
      { href: "/arsip-alumni", label: "Arsip Alumni", icon: GraduationCap, roles: ADMIN_ROLES },
      { href: "/admin/mutasi", label: "Mutasi Masuk", icon: ArrowRightLeft, roles: ADMIN_ROLES },
      { href: "/admin/mutasi-keluar", label: "Mutasi Keluar", icon: ExternalLink, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Komunikasi",
    items: [
      { href: "/messages", label: "Pesan Masuk", icon: Mail, roles: ADMIN_ROLES },
      { href: "/admin/surat/template", label: "Surat Otomatis", icon: FileText, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Konten",
    items: [
       { href: "/admin/galeri", label: "Galeri Foto", icon: ImageIcon, roles: ADMIN_ROLES },
       { href: "/admin/content/staff", label: "Guru & Staff", icon: Users, roles: ADMIN_ROLES },
       { href: "/announcements", label: "Pengumuman", icon: Bell, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/users", label: "Pengguna", icon: User, roles: SYSTEM_ADMIN_ROLES },
      { href: "/activity-log", label: "Log Aktivitas", icon: Activity, roles: ADMIN_ROLES },
      { href: "/profile", label: "Profil Saya", icon: User },
      { href: "/admin/master/sekolah", label: "Pengaturan", icon: Settings, roles: ADMIN_ROLES },
    ],
  },
];

function filterNavByRole(groups: NavGroup[], userRole?: UserRole): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.roles) return true;
        if (!userRole) return false;
        const normalizedUserRole = userRole.toLowerCase();
        // Allow BOTH admin and superadmin to access things labeled with either
        const isUserAdmin = normalizedUserRole === "admin" || normalizedUserRole === "superadmin";
        
        return item.roles.some((role) => {
          const normalizedRole = role.toLowerCase();
          if (isUserAdmin && (normalizedRole === "admin" || normalizedRole === "superadmin")) return true;
          return normalizedRole === normalizedUserRole;
        });
      }),
    }))
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
  
  const schoolName = schoolSettings?.schoolName || "Sekolahku";
  const schoolLogo = schoolSettings?.schoolLogo || "/logo.png";
  const schoolInitial = schoolName.substring(0, 2).toUpperCase();

  return (
    <div className={cn(
      "flex min-w-0 flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 overflow-x-hidden md:overflow-hidden",
      "min-h-dvh md:h-dvh"
    )}>
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
                      <p className="text-[10px] uppercase font-bold text-neutral-500 mb-1 px-1 truncate">
                          {group.label}
                      </p>
                      {group.items.map((link) => (
                          <SidebarLink key={link.href} link={{
                              label: link.label,
                              href: link.href,
                              icon: <link.icon className="text-neutral-700 dark:text-neutral-200 h-[18px] w-[18px] md:h-5 md:w-5 flex-shrink-0" />
                          }} />
                      ))}
                   </div>
                ))
              )}
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top Navigation Bar - Static/Relative */}
          <header className="sticky top-0 md:static flex items-center justify-end gap-2 p-2.5 sm:p-3 md:p-4 w-full z-40 bg-gray-100/80 dark:bg-neutral-800/80 backdrop-blur md:bg-transparent md:dark:bg-transparent">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 p-1 md:p-2">
             {/* Theme Toggle */}
             <div className="flex items-center justify-center">
                <ThemeToggle />
             </div>

             {/* Notification */}
             <div className={cn("flex items-center justify-center")}>
                <NotificationPopover className="h-6 w-6 md:h-5 md:w-5 text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white transition-colors" />
             </div>

             {/* Profile Dropdown */}
            {mounted ? (
              <DropdownMenu onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 md:h-auto md:w-auto rounded-full md:rounded-xl p-0 md:px-3 md:py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:ring-0 focus-visible:ring-offset-0">
                     <div className="h-9 w-9 md:h-8 md:w-8 flex-shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden ring-2 ring-transparent transition-all">
                        <Avatar className="h-full w-full">
                           <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`} />
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
                    <span>Profil</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push("/")}>
                    <Globe className="mr-2 h-4 w-4" />
                    <span>Halaman Depan</span>
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

         <main id="main-content" className="flex min-w-0 flex-1 flex-col gap-2 overflow-x-hidden px-3 pb-4 pt-2 sm:px-4 md:h-full md:overflow-y-auto md:rounded-tl-2xl md:px-5 md:pb-6 md:pt-4 lg:px-6 xl:px-8">
            {children}
         </main>
      </div>
    </div>
  );
}


