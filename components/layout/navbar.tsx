"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, GraduationCap, ChevronDown, User, LogOut, Settings, LayoutDashboard } from "lucide-react";
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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { logout as pbLogout } from "@/lib/pocketbase";

const navLinks = [
  { href: "/", label: "Beranda" },
  {
    label: "Profil",
    children: [
      { href: "/profil/visi-misi", label: "Visi & Misi" },
      { href: "/profil/sejarah", label: "Sejarah" },
      { href: "/kurikulum", label: "Kurikulum & Ekskul" },
      { href: "/galeri", label: "Galeri Foto" },
    ],
  },
  { href: "/berita", label: "Berita" },
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

  const handleLogout = () => {
    pbLogout();
    storeLogout();
    router.push("/");
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-500 shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
            <GraduationCap className="h-6 w-6 text-white" />
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
            <ThemeToggle />
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
                    <Link href="/school-settings" className="cursor-pointer gap-2">
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
            <Button variant="ghost" size="icon" className="rounded-full">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] border-l-0 rounded-l-2xl sm:max-w-xs">
            <SheetTitle className="flex items-center gap-3 mb-8 px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <span className="block font-bold">{settings?.school_name || "Sekolah"}</span>
                <span className="block text-xs text-muted-foreground font-medium">Menu Navigasi</span>
              </div>
            </SheetTitle>
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) =>
                link.children ? (
                  <div key={link.label} className="space-y-1 py-2">
                    <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {link.label}
                    </p>
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setIsOpen(false)}
                        className="block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href!}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors",
                      pathname === link.href ? "bg-primary/5 text-primary" : ""
                    )}
                  >
                    {link.label}
                  </Link>
                )
              )}
              <div className="mt-8 px-4">
                <Link href="/login" onClick={() => setIsOpen(false)}>
                  <Button className="w-full rounded-xl py-6 text-base shadow-lg shadow-primary/20">
                    <User className="mr-2 h-5 w-5" />
                    Masuk Akun
                  </Button>
                </Link>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
