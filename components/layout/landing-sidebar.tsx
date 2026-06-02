"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  FileText,
  Briefcase,
  Users,
  HelpCircle,
  Phone,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  User,
} from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { logoutAction } from "@/actions/auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const navLinks = [
  { href: "/", label: "Halaman Depan", icon: Home },
  {
    label: "Profil",
    icon: Building2,
    children: [
      { href: "/profil/visi-misi", label: "Visi & Misi" },
      { href: "/profil/sejarah", label: "Sejarah" },
      { href: "/profil/guru-staff", label: "Guru & Staff" },
      { href: "/kurikulum", label: "Kurikulum & Ekskul" },
      { href: "/galeri", label: "Galeri Foto" },
    ],
  },
  { href: "/berita", label: "Berita", icon: FileText },
  {
    label: "Layanan Administratif",
    icon: Briefcase,
    children: [
      { href: "/layanan/mutasi-masuk", label: "Mutasi Masuk" },
      { href: "/layanan/mutasi-masuk/status", label: "Lacak Status Mutasi" },
      { href: "/layanan/mutasi-keluar", label: "Mutasi Keluar" },
      { href: "/layanan/cek-saldo", label: "Cek Saldo Tabungan" },
    ],
  },
  { href: "/spmb", label: "SPMB", icon: Users },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/kontak", label: "Kontak", icon: Phone },
];

export function LandingSidebar() {
  const [open, setOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Custom setOpen handler to prevent closing when dropdown is open
  const handleSetOpen = (value: boolean | ((prevState: boolean) => boolean)) => {
    if (typeof value === "function") {
      setOpen((prev) => {
        const next = value(prev);
        if (!next && isDropdownOpen) return true;
        return next;
      });
    } else {
      if (!value && isDropdownOpen) {
        setOpen(true);
        return;
      }
      setOpen(value);
    }
  };

  return (
    <Sidebar open={open} setOpen={handleSetOpen} animate={false}>
      <SidebarBody className="justify-between gap-10">
        <SidebarContent setIsDropdownOpen={setIsDropdownOpen} />
      </SidebarBody>
    </Sidebar>
  );
}

function SidebarContent({ setIsDropdownOpen }: { setIsDropdownOpen: (v: boolean) => void }) {
  const { open, animate, setOpen } = useSidebar(); // Access internal open state provided by SidebarProvider
  const { settings } = useSchoolSettings();
  const { user, isAuthenticated, logout: storeLogout } = useAuthStore();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logoutAction();
    storeLogout();
    window.location.href = "/login";
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden" suppressHydrationWarning>
      {/* Header / Logo */}
      <div className="flex flex-col mb-6">
         <Link href="#" className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20">
            <div className="h-6 w-6 relative flex-shrink-0 rounded-lg bg-black dark:bg-white flex items-center justify-center overflow-hidden">
                {settings?.school_logo ? (
                   <Image src={settings.school_logo} alt="Logo" width={24} height={24} className="h-full w-full object-cover" />
                ) : (
                   <Image src="/logo.png" alt="Logo" width={24} height={24} className="h-full w-full object-contain p-0.5" />
                )}
            </div>
            <motion.span
              animate={{
                display: animate ? (open ? "inline-block" : "none") : "inline-block",
                opacity: animate ? (open ? 1 : 0) : 1,
              }}
              className="font-medium text-black dark:text-white whitespace-pre opacity-100 truncate"
            >
              {settings?.school_name || "Sekolah"}
            </motion.span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
        {navLinks.map((link, idx) => (
          <div key={idx}>
            {link.children ? (
               <NavGroup link={link} open={open} animate={animate} setOpen={setOpen} />
            ) : (
                <SidebarLink 
                    link={{ 
                        label: link.label, 
                        href: link.href, 
                        icon: <link.icon className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" /> 
                    }}
                    onClick={() => {
                        if (window.innerWidth < 768) {
                            setOpen(false);
                        }
                    }}
                />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NavGroup({ link, open, animate, setOpen }: { link: any, open: boolean, animate: boolean, setOpen: (v: boolean) => void }) {
    // Nested items implementation
    // If closed: show icon in dropdown
    // If open: show collapsible
    
    if (animate && !open) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div className="flex items-center justify-start gap-2 group/sidebar py-2 cursor-pointer" suppressHydrationWarning>
                        <link.icon className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    </div>
                </DropdownMenuTrigger>
                 <DropdownMenuContent side="right" className="ml-2 w-48">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mb-1">
                        {link.label}
                    </div>
                    {link.children.map((child: any) => (
                        <DropdownMenuItem key={child.href} asChild onClick={() => {
                            if (window.innerWidth < 768) setOpen(false);
                        }}>
                            <Link href={child.href}>{child.label}</Link>
                        </DropdownMenuItem>
                    ))}
                 </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    return (
        <Collapsible className="group/collapsible">
            <CollapsibleTrigger asChild>
                <div className="flex items-center justify-start gap-2 group/sidebar py-2 cursor-pointer w-full">
                    <link.icon className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                     <motion.div
                         animate={{
                            display: animate ? (open ? "flex" : "none") : "flex",
                            opacity: animate ? (open ? 1 : 0) : 1,
                        }}
                        className="flex-1 flex items-center justify-between overflow-hidden"
                     >
                        <span className="text-neutral-700 dark:text-neutral-200 text-sm whitespace-pre">
                            {link.label}
                        </span>
                        <ChevronDown className="h-4 w-4 text-neutral-500 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                     </motion.div>
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                 <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-8 flex flex-col gap-1 overflow-hidden"
                 >
                    {link.children.map((child: any) => (
                        <Link 
                            key={child.href} 
                            href={child.href}
                            onClick={() => {
                                if (window.innerWidth < 768) setOpen(false);
                            }}
                            className="text-neutral-600 dark:text-neutral-400 text-sm py-1 hover:text-black dark:hover:text-white block"
                        >
                            {child.label}
                        </Link>
                    ))}
                 </motion.div>
            </CollapsibleContent>
        </Collapsible>
    )
}
