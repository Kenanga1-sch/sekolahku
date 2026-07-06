"use client";

import Footer from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, User, LayoutDashboard } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { useState, useEffect } from "react";

export default function PublicLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, logout: storeLogout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await logoutAction();
    storeLogout();
    window.location.href = "/login";
  };

  return (
    <div className="dark flex flex-col bg-neutral-900 text-neutral-100 w-full flex-1 mx-auto border-neutral-700 overflow-hidden h-screen">
      <div id="public-scroll-container" className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden relative no-scrollbar">
         {/* Top Navigation Bar */}
         <header 
            className="fixed top-6 right-6 flex items-center justify-end gap-4 z-50 bg-transparent"
            suppressHydrationWarning
         >
            {mounted && isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 pl-2 pr-4 py-1.5 h-auto rounded-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 shadow-2xl hover:bg-zinc-900/80 cursor-pointer active:scale-95 transition-all text-neutral-200"
                  >
                    <div className="h-6 w-6 rounded-full bg-neutral-250 dark:bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center overflow-hidden">
                       <User className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <div className="hidden md:flex flex-col items-start text-left">
                       <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-200">{user.name}</span>
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
                    <Link href="/admin/sekolah" className="cursor-pointer gap-2">
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
                  <Button size="sm" className="rounded-full px-5 h-8 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 shadow-2xl hover:bg-zinc-900/80 font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all text-white hover:text-white">
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
            {pathname !== "/" && <Footer />}
         </div>
      </div>
    </div>
  );
}
