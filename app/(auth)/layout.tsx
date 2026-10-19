"use client";

import { GraduationCap, Quote, Home, Briefcase, Newspaper, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { WavyBackground } from "@/components/ui/wavy-background";
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
      <div className="hidden lg:flex relative flex-col justify-between bg-zinc-900 text-white overflow-hidden">
        <WavyBackground 
             className="max-w-4xl mx-auto pb-40 flex flex-col justify-between h-full p-12"
             colors={["#38bdf8", "#818cf8", "#c084fc", "#e879f9", "#22d3ee"]}
             backgroundFill="#18181b" 
        >
            {/* Content Container - z-index handled by component but ensuring layout */}
            <div className="relative z-10 flex flex-col h-full justify-between w-full">
              <Link href="/" className="flex items-center gap-3 w-fit">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur border border-white/20 overflow-hidden">
                  {settings?.school_logo ? (
                    <img 
                      src={settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/") 
                        ? settings.school_logo 
                        : `/uploads/${settings.school_logo}`} 
                      alt="Logo" 
                      className="h-full w-full object-contain p-1" 
                    />
                  ) : (
                    <GraduationCap className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">{settings?.school_name || "Sekolah"}</p>
                  <p className="text-xs text-white/70">Website Sekolah Terpadu</p>
                </div>
              </Link>

              <div className="space-y-6 max-w-lg">
                <Quote className="h-10 w-10 text-white/50" />
                <blockquote className="text-2xl font-medium leading-relaxed tracking-tight">
                  &ldquo;Pendidikan bukan persiapan untuk hidup. Pendidikan adalah hidup itu sendiri.&rdquo;
                </blockquote>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                    JD
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">John Dewey</p>
                    <p className="text-white/60">Filsuf Pendidikan</p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-white/70 flex justify-between items-center w-full">
                <p>© {new Date().getFullYear()} {settings?.school_name || "Sekolah"}</p>
                <div className="flex gap-4">
                  <Link href="/spmb" className="hover:text-white transition-colors">SPMB</Link>
                  <Link href="/layanan" className="hover:text-white transition-colors">Layanan</Link>
                </div>
              </div>
            </div>
        </WavyBackground>
      </div>

      {/* Right Side - Form */}
      <AuroraBackground className="min-h-screen w-full p-6 sm:p-12 lg:p-16 pb-24 md:pb-16 bg-background">
        {/* Ambient gradient / aurora sesuai tema (dark mode aware) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden [-webkit-mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        >
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/25" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/15" />
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
      </AuroraBackground>
      {/* Bottom Nav - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 safe-area-pb">
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
