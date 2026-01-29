
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  ChevronDown,
  User,
  LogOut,
  Settings,
  LayoutDashboard,
  Home,
  FileText,
  Building2,
  HelpCircle,
  Phone,
  Briefcase,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { signOut } from "next-auth/react";

const navLinks = [
  { href: "/", label: "Beranda", icon: Home },
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
      { href: "/layanan/mutasi-keluar", label: "Mutasi Keluar" },
      { href: "/layanan/cek-saldo", label: "Cek Saldo Tabungan" },
    ],
  },
  { href: "/spmb", label: "SPMB", icon: Users },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/kontak", label: "Kontak", icon: Phone },
];

interface PublicSidebarProps {
  isCollapsed?: boolean;
  toggleSidebar?: () => void;
}

export default function PublicSidebar({
  isCollapsed = false,
  toggleSidebar,
}: PublicSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, isAuthenticated, logout: storeLogout } = useAuthStore();
  const { settings } = useSchoolSettings();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
    storeLogout();
  };

  if (pathname?.startsWith("/kiosk")) return null;

  /* Sidebar Content Component */
  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => {
    // If mobile, always expanded
    const collapsed = mobile ? false : isCollapsed;
    
    return (
      <div className={cn(
        "flex flex-col h-full bg-white dark:bg-zinc-950/50 backdrop-blur-xl border-r border-zinc-200 dark:border-white/10 transition-all duration-300",
        mobile ? "w-full" : (collapsed ? "w-[70px]" : "w-64")
      )}>
        {/* Header */}
        <div className="flex flex-col gap-4 p-4 md:p-6 transition-all">
          <div className={cn("flex items-center gap-3 transition-all", collapsed ? "justify-center" : "")}>
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-primary/10">
              <Image
                src="/logo.png"
                alt="Logo Sekolah"
                fill
                className="object-contain p-1"
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm leading-tight text-foreground line-clamp-2">
                  {settings?.school_name || "Sekolah"}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Menu Utama
                </span>
              </div>
            )}
          </div>
          
          {/* Toggle Button - Moved to Header (Hidden on Mobile) */}
          {!mobile && (
            <div className={cn("flex transition-all", collapsed ? "justify-center" : "justify-end")}>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={toggleSidebar} 
                      className={cn(
                        "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/5 shrink-0", 
                        collapsed ? "w-8 h-8" : "h-8 w-8"
                      )}
                    >
                      {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={collapsed ? "right" : "bottom"}>
                    {collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
  
        {/* Navigation */}
        <div className={cn("flex-1 overflow-y-auto space-y-1 scrollbar-none", collapsed ? "px-2" : "px-3 py-2")}>
          <TooltipProvider delayDuration={0}>
            {navLinks.map((link) => (
              <div key={link.label}>
                {link.children ? (
                  collapsed ? (
                    // Collapsed Submenu (Icon Only -> Tooltip)
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <Button
                          variant="ghost"
                          className="w-full justify-center h-10 px-0 hover:bg-zinc-100 dark:hover:bg-white/5"
                        >
                          <link.icon className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" className="ml-2 w-48">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mb-1">
                          {link.label}
                        </div>
                        <DropdownMenuSeparator />
                        {link.children.map((child) => (
                           <DropdownMenuItem key={child.href} asChild>
                             <Link href={child.href} className={cn("cursor-pointer", pathname === child.href && "text-primary font-medium")}>
                               {child.label}
                             </Link>
                           </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    // Expanded Submenu
                    <Collapsible className="group/collapsible">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between h-11 px-3 hover:bg-zinc-100 dark:hover:bg-white/5 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <link.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{link.label}</span>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="pl-10 space-y-1 py-1">
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                "block py-2 px-3 rounded-lg text-sm transition-colors",
                                pathname === child.href
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/5"
                              )}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )
                ) : (
                  collapsed ? (
                     <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={link.href!}>
                          <Button
                            variant="ghost"
                            className={cn(
                              "w-full justify-center h-10 px-0 hover:bg-zinc-100 dark:hover:bg-white/5",
                              pathname === link.href && "bg-primary/10 text-primary"
                            )}
                          >
                            <link.icon className={cn("h-4 w-4", pathname !== link.href && "text-muted-foreground")} />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {link.label}
                      </TooltipContent>
                     </Tooltip>
                  ) : (
                    <Link href={link.href!}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start h-11 px-3 gap-3 hover:bg-zinc-100 dark:hover:bg-white/5",
                          pathname === link.href &&
                            "bg-primary/10 text-primary hover:bg-primary/20",
                        )}
                      >
                        <link.icon className={cn("h-4 w-4", pathname !== link.href && "text-muted-foreground")} />
                        <span className="font-medium">{link.label}</span>
                      </Button>
                    </Link>
                  )
                )}
              </div>
            ))}
          </TooltipProvider>
        </div>
  
        {/* Footer / User Actions */}
        <div className={cn("border-t border-zinc-200 dark:border-white/10 flex flex-col gap-2", collapsed ? "p-2 items-center" : "p-4")}>
          {!collapsed ? (
             <div className="flex items-center justify-between px-2">
                <span className="text-xs font-medium text-muted-foreground">Tema</span>
                <ThemeToggle />
             </div>
          ) : (
             <ThemeToggle />
          )}
  
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "rounded-xl border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5",
                    collapsed ? "w-10 h-10 p-0 justify-center" : "w-full justify-start gap-3 h-12 px-3"
                  )}
                >
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  {!collapsed && (
                    <>
                      <div className="text-left flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.name || "User"}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" side="top">
                {(user.role === "admin" || user.role === "superadmin") && (
                  <DropdownMenuItem asChild>
                    <Link href="/overview" className="cursor-pointer gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/admin/master/sekolah" className="cursor-pointer gap-2">
                    <Settings className="h-4 w-4" />
                    Pengaturan
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login" className="block w-full">
              <Button className={cn("rounded-xl shadow-lg shadow-primary/20", collapsed ? "w-10 h-10 p-0" : "w-full gap-2")}>
                <User className="h-4 w-4" />
                {!collapsed && "Masuk"}
              </Button>
            </Link>
          )}
  
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <aside className={cn(
        "hidden md:block fixed left-0 top-0 bottom-0 z-50 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[70px]" : "w-64"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Navbar (Top) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/10 z-50 px-4 flex items-center justify-between">
         <Link href="/" className="flex items-center gap-2">
            <div className="relative h-8 w-8 rounded-lg overflow-hidden bg-primary/10">
                 <Image src="/logo.png" alt="Logo" fill className="object-contain p-1" />
            </div>
            <span className="font-bold text-sm">{settings?.school_name || "Sekolah"}</span>
         </Link>
         
         <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
                <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
                <SidebarContent mobile={true} />
            </SheetContent>
         </Sheet>
      </header>
    </>
  );
}

