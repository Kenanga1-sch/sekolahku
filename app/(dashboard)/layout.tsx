"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  BookOpenCheck,
  NotebookPen,
  Presentation,
  Recycle,
  Library,
  ArrowRight,
  Banknote,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLayoutStore } from "@/lib/stores/layout-store";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle"; // Keep theme toggle access
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

const ADMIN_ROLES: UserRole[] = ["superadmin", "admin"];
const SUPERADMIN_ONLY: UserRole[] = ["superadmin"];
const INVENTARIS_ROLES: UserRole[] = ["superadmin", "admin", "guru", "staff"];
const GURU_ACCESS_ROLES: UserRole[] = ["superadmin", "admin", "guru"]; 
const NON_STAFF_ROLES: UserRole[] = ["superadmin", "admin", "guru"];
const TABUNGAN_ROLES: UserRole[] = ["superadmin", "admin", "guru", "staff"]; 

const navGroups: NavGroup[] = [
  {
    label: "Menu Utama",
    items: [
      { href: "/overview", label: "Beranda", icon: LayoutDashboard, roles: NON_STAFF_ROLES },
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
    label: "Kurikulum",
    items: [
       { href: "/admin/kurikulum", label: "Ringkasan", icon: BookOpenCheck, roles: GURU_ACCESS_ROLES },
       { href: "/admin/kurikulum/perencanaan", label: "Rencana Ajar", icon: NotebookPen, roles: GURU_ACCESS_ROLES },
       { href: "/admin/kurikulum/kbm", label: "Jurnal Mengajar", icon: Presentation, roles: GURU_ACCESS_ROLES },
       { href: "/admin/kurikulum/penilaian", label: "Asesmen & Rapor", icon: GraduationCap, roles: GURU_ACCESS_ROLES },
       { href: "/admin/kurikulum/p5", label: "Projek P5", icon: Recycle, roles: GURU_ACCESS_ROLES },
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
      { href: "/users", label: "Pengguna", icon: User, roles: SUPERADMIN_ONLY },
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
      items: group.items.filter(
        (item) => !item.roles || (userRole && item.roles.includes(userRole))
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false); // Sidebar open state
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const forcedRole = mounted ? (user?.role || "user") : "user";
  const filteredNav = filterNavByRole(navGroups, forcedRole);
  const displayName = mounted && user?.name ? user.name : "Admin";
  const displayInitials = mounted && user?.name ? user.name.substring(0, 2).toUpperCase() : "A";

  return (
    <div className={cn(
      "flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 max-w-7xl mx-auto border-neutral-200 dark:border-neutral-700 overflow-hidden",
      "h-screen" // Enforce full height
    )}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {/* Logo */}
            <div className="flex flex-col">
                <Link href="#" className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20">
                    <div className="h-6 w-6 relative flex-shrink-0 rounded-full bg-black dark:bg-white flex items-center justify-center">
                        <span className="text-white dark:text-black font-bold text-xs">{displayInitials}</span>
                    </div>
                    <span className="font-medium text-black dark:text-white whitespace-pre opacity-100">
                        Sekolahku
                    </span>
                </Link>
             </div>
             
             {/* Nav Links */}
            <div className="mt-8 flex flex-col gap-2">
              {filteredNav.map((group) => (
                 <div key={group.label} className="flex flex-col gap-1">
                    <p className="text-[10px] uppercase font-bold text-neutral-500 mb-1 px-1 truncate">
                        {open ? group.label : "•"}
                    </p>
                    {group.items.map((link) => (
                        <SidebarLink key={link.href} link={{
                            label: link.label,
                            href: link.href,
                            icon: <link.icon className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                        }} />
                    ))}
                 </div>
              ))}
            </div>
          </div>
          
          {/* Footer User Profile */}
          <div>
            <SidebarLink
              link={{
                label: displayName,
                href: "/profile",
                icon: (
                     <div className="h-7 w-7 flex-shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                        <Avatar className="h-full w-full">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`} />
                            <AvatarFallback>{displayInitials}</AvatarFallback>
                        </Avatar>
                     </div>
                ),
              }}
            />
            <div className="mt-2" onClick={() => { logout(); router.push("/login");}}>
                 <SidebarLink 
                    link={{
                        label: "Keluar",
                        href: "#",
                        icon: <LogOut className="text-red-500 h-5 w-5 flex-shrink-0" />
                    }}
                 />
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      <div className="flex flex-1">
         <div className="p-2 md:p-10 rounded-tl-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col gap-2 flex-1 w-full h-full overflow-y-auto">
            {children}
         </div>
      </div>
    </div>
  );
}
