"use client";

import { LandingSidebar } from "@/components/layout/landing-sidebar";
import Footer from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, User, LayoutDashboard, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function PublicLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, logout: storeLogout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await logoutAction();
    storeLogout();
    window.location.href = "/login";
  };

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-900 w-full flex-1 mx-auto border-neutral-200 dark:border-neutral-700 overflow-hidden",
        "h-screen" // Main App container
      )}
    >
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen((prev) => !prev)}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-[60] h-12 w-5 rounded-r-md border border-l-0 border-neutral-200 dark:border-neutral-700 shadow-sm flex items-center justify-center transition-all cursor-pointer group",
          "bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700",
          sidebarOpen
            ? "left-[280px] xl:left-[300px]"
            : "left-0"
        )}
        aria-label={sidebarOpen ? "Sembunyikan navigasi" : "Tampilkan navigasi"}
      >
        <PanelLeftClose className={cn("h-3.5 w-3.5 transition-transform", !sidebarOpen && "rotate-180")} />
      </button>

      <div className={cn("flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden", sidebarOpen ? "max-w-[300px]" : "max-w-0")}>
        <LandingSidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden relative no-scrollbar">
         {/* Top Navigation Bar */}
         <header 
            className="absolute top-0 right-0 flex items-center justify-end gap-4 p-4 z-50 bg-transparent"
            suppressHydrationWarning
         >
            <div className="flex items-center gap-2">
               <ThemeToggle />
            </div>

            {mounted && isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 pl-0 hover:bg-transparent"
                  >
                    <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center overflow-hidden">
                       <User className="h-4 w-4 text-neutral-500" />
                    </div>
                    <div className="hidden md:flex flex-col items-start text-left">
                       <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{user.name}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" className="w-56" sideOffset={8}>
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
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer gap-2">
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
               <Link href="/login">
                  <Button size="sm" className="rounded-full px-4">
                     Masuk
                  </Button>
               </Link>
            )}
         </header>

         {/* Sticky Footer Scrollable Content Wrapper */}
         <div className="flex-1 flex flex-col min-h-full w-full">
            <main className="flex-1 w-full relative">
               {children}
            </main>
            <Footer />
         </div>
      </div>
    </div>
  );
}
