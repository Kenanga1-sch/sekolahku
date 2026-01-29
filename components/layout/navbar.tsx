"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ChevronDown, User, LogOut, Settings, LayoutDashboard } from "lucide-react";
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
import { cn } from "@/lib/utils";

import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { signOut } from "next-auth/react";

const navLinks = [
  { href: "/", label: "Beranda" },
  {
    label: "Profil",
    children: [
      { href: "/profil/visi-misi", label: "Visi & Misi" },
      { href: "/profil/sejarah", label: "Sejarah" },
      { href: "/profil/guru-staff", label: "Guru & Staff" },
      { href: "/kurikulum", label: "Kurikulum & Ekskul" },
      { href: "/galeri", label: "Galeri Foto" },
    ],
  },
  { href: "/berita", label: "Berita" },
  {
    label: "Layanan Administratif",
    children: [
      { href: "/layanan/mutasi-masuk", label: "Mutasi Masuk" },
      { href: "/layanan/mutasi-keluar", label: "Mutasi Keluar" },
      { href: "/layanan/cek-saldo", label: "Cek Saldo Tabungan" },
    ],
  },
  { href: "/spmb", label: "SPMB" },
  { href: "/faq", label: "FAQ" },
  { href: "/kontak", label: "Kontak" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout: storeLogout } = useAuthStore();
  const { settings } = useSchoolSettings();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
    storeLogout(); // Keep store sync if needed, though signOut redirects
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (pathname?.startsWith("/kiosk")) return null;

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "glass py-2"
          : "bg-transparent py-4 border-transparent"
      )}
    >
      <div className="container flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
            <Image 
              src="/logo.png" 
              alt="Logo Sekolah" 
              fill
              className="object-contain p-1"
            />
          </div>
          <div className="hidden sm:block">
            <p className={cn("font-bold text-lg leading-none group-hover:text-primary transition-colors",
              !scrolled && pathname === "/" ? "text-zinc-900" : "text-foreground"
            )}>
              {settings?.school_name || "Sekolah"}
            </p>
            <p className="text-xs text-muted-foreground font-medium">Website Sekolah Terpadu</p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) =>
            link.children ? (
              <DropdownMenu key={link.label}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn("gap-1 rounded-full px-4 font-medium hover:bg-primary/5",
                      !scrolled && pathname === "/" ? "hover:bg-black/5" : ""
                    )}
                  >
                    {link.label}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48 p-2 rounded-xl shadow-xl border-none ring-1 ring-black/5">
                  {link.children.map((child) => (
                    <DropdownMenuItem key={child.href} asChild>
                      <Link
                        href={child.href}
                        className="w-full cursor-pointer rounded-lg px-3 py-2 text-sm font-medium hover:text-primary transition-colors"
                      >
                        {child.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link key={link.href} href={link.href!}>
                <Button
                  variant="ghost"
                  className={cn(
                    "rounded-full px-4 font-medium hover:bg-primary/5 transition-colors",
                    pathname === link.href ? "text-primary bg-primary/5" : "",
                    !scrolled && pathname === "/" ? "hover:bg-black/5" : ""
                  )}
                >
                  {link.label}
                </Button>
              </Link>
            )
          )}

          <div className="pl-2 ml-2 border-l border-zinc-200 dark:border-zinc-800 h-6 flex items-center gap-2">

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full px-4 gap-2 font-medium">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="hidden lg:inline">{user.name || user.email?.split('@')[0]}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl">
                  <div className="px-3 py-2 mb-2">
                    <p className="font-semibold">{user.name || 'User'}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {(user.role === 'admin' || user.role === 'superadmin') && (
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
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-medium">
                  Masuk
                </Button>
              </Link>
            )}
          </div>
        </nav>

        {/* Mobile Navigation */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="right" 
            className="w-[300px] border-l border-white/20 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-3xl rounded-l-3xl p-0 flex flex-col shadow-2xl"
          >
            <div className="p-6 md:p-8 flex-1 overflow-y-auto scrollbar-none">
              <SheetTitle className="flex items-center gap-3 mb-8">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl overflow-hidden shadow-xl shadow-primary/20">
                  <Image 
                    src="/logo.png" 
                    alt="Logo Sekolah" 
                    fill
                    className="object-contain p-1"
                  />
                </div>
                <div className="text-left space-y-0.5">
                  <span className="block font-bold text-lg leading-none">{settings?.school_name || "Sekolah"}</span>
                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Menu Navigasi</span>
                </div>
              </SheetTitle>
              
              <nav className="flex flex-col gap-2">
                {navLinks.map((link, i) => (
                  <div key={link.label} className="animate-in slide-in-from-right-8 fade-in duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                    {link.children ? (
                      <div className="space-y-1">
                        <p className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                          {link.label}
                        </p>
                        <div className="grid gap-1 pl-2 border-l-2 border-primary/10 ml-2">
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setIsOpen(false)}
                              className="block px-4 py-3 text-sm font-medium rounded-xl hover:bg-primary/5 active:bg-primary/10 transition-colors group relative overflow-hidden"
                            >
                               {child.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Link
                        href={link.href!}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center justify-between px-4 py-3.5 text-sm font-medium rounded-xl transition-all duration-200",
                          pathname === link.href 
                             ? "bg-primary/10 text-primary shadow-sm shadow-primary/10" 
                             : "hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98]"
                        )}
                      >
                        {link.label}
                        {pathname === link.href && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>

              <div className="mt-8 pt-8 border-t border-dashed border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-bottom-4 fade-in duration-500 delay-300">
                <Link href="/login" onClick={() => setIsOpen(false)}>
                  <Button className="w-full rounded-2xl h-14 text-base font-semibold shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform">
                    <User className="mr-2 h-5 w-5" />
                    Akses Akun
                  </Button>
                </Link>
                <div className="mt-6 flex flex-col gap-2 text-center">
                    <p className="text-xs text-muted-foreground">
                        {/* Type safe access or fallback */}
                        Tahun Ajaran {new Date().getFullYear()}
                    </p>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
