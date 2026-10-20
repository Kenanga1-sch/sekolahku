"use client";

import { GraduationCap, Quote, Home, Briefcase, Newspaper, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { cn } from "@/lib/utils";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = useSchoolSettings();
  const pathname = usePathname();

  const navItems = [
    { id: "home", label: "Beranda", href: "/", icon: Home },
    { id: "spmb", label: "SPMB", href: "/spmb", icon: GraduationCap },
    { id: "layanan", label: "Layanan", href: "/layanan", icon: Briefcase },
    { id: "berita", label: "Berita", href: "/berita", icon: Newspaper },
    { id: "guru", label: "Guru & Staf", href: "/guru-staf", icon: Users },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left Side - Visual & Branding */}
      <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col">
        <div className="pattern-dots pointer-events-none absolute inset-0 opacity-15" />
        <div className="pattern-contour pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-12">
          <Link href="/" className="flex w-fit items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/10">
              {settings?.school_logo ? (
                <img
                  src={settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/")
                    ? settings.school_logo
                    : `/uploads/${settings.school_logo}`}
                  alt="Logo"
                  className="h-full w-full object-contain p-1.5"
                />
              ) : (
                <GraduationCap className="h-6 w-6" aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">{settings?.school_name || "Sekolah"}</p>
              <p className="text-xs text-primary-foreground-soft">Website Sekolah Terpadu</p>
            </div>
          </Link>

          <div className="max-w-lg space-y-6">
            <Quote className="h-10 w-10 text-secondary" aria-hidden="true" />
            <blockquote className="font-serif text-3xl font-medium leading-[1.25] tracking-tight">
              &ldquo;Pendidikan bukan persiapan untuk hidup. Pendidikan adalah hidup itu sendiri.&rdquo;
            </blockquote>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
                JD
              </div>
              <div className="text-sm">
                <p className="font-semibold">John Dewey</p>
                <p className="text-primary-foreground-soft">Filsuf Pendidikan</p>
              </div>
            </div>
          </div>

          <div className="flex w-full items-center justify-between text-xs text-primary-foreground-soft">
            <p>© {new Date().getFullYear()} {settings?.school_name || "Sekolah"}</p>
            <div className="flex gap-4">
              <Link href="/spmb" className="transition-colors hover:text-white">SPMB</Link>
              <Link href="/layanan" className="transition-colors hover:text-white">Layanan</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-canvas p-6 pb-24 sm:p-12 md:pb-16 lg:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden [-webkit-mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        >
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-secondary/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[400px] space-y-6 mx-auto my-auto"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg text-primary-foreground overflow-hidden">
              {settings?.school_logo ? (
                <img 
                  src={settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/") 
                    ? settings.school_logo 
                    : `/uploads/${settings.school_logo}`} 
                  alt="Logo" 
                  className="h-full w-full object-contain p-1.5 bg-white" 
                />
              ) : (
                <GraduationCap className="h-7 w-7" />
              )}
            </div>
          </div>

          {/* Slot untuk konten card (login / lupa password) */}
          {children}
        </motion.div>
      </div>
      {/* Bottom Nav - Mobile Only */}
      <nav className="safe-area-pb fixed bottom-0 left-0 right-0 z-50 border-t border-line/60 bg-surface/95 backdrop-blur-xl md:hidden">
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
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
