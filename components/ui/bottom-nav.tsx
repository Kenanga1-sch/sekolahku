"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Library,
  Wallet,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  matchPaths?: string[];
}

const navItems: BottomNavItem[] = [
  {
    href: "/overview",
    label: "Beranda",
    icon: LayoutDashboard,
    matchPaths: ["/overview"],
  },
  {
    href: "/admin/siswa",
    label: "Siswa",
    icon: Users,
    matchPaths: ["/admin/siswa", "/admin/akademik", "/admin/master"],
  },
  {
    href: "/perpustakaan",
    label: "Perpus",
    icon: Library,
    matchPaths: ["/perpustakaan"],
  },
  {
    href: "/tabungan",
    label: "Tabungan",
    icon: Wallet,
    matchPaths: ["/tabungan"],
  },
];

interface BottomNavProps {
  onMenuClick: () => void;
}

export function BottomNav({ onMenuClick }: BottomNavProps) {
  const pathname = usePathname();

  const isActive = (item: BottomNavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.some((p) => pathname.startsWith(p));
    }
    return pathname.startsWith(item.href);
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl",
        "border-t border-neutral-200/80 dark:border-neutral-700/80",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div className="flex items-stretch justify-around h-[60px] max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1.5 rounded-xl mx-0.5 transition-all duration-200",
                "active:scale-95",
                active
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200",
                  active
                    ? "bg-blue-100 dark:bg-blue-900/40 scale-105"
                    : "bg-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "h-[20px] w-[20px] transition-all duration-200",
                    active ? "stroke-[2.5]" : "stroke-[1.75]"
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] leading-tight truncate max-w-full px-1 transition-all duration-200",
                  active ? "font-bold" : "font-medium"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Menu / More Button */}
        <button
          onClick={onMenuClick}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1.5 rounded-xl mx-0.5 transition-all duration-200",
            "active:scale-95",
            "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
            "cursor-pointer"
          )}
        >
          <div className="flex items-center justify-center w-10 h-7 rounded-full">
            <Menu className="h-[20px] w-[20px] stroke-[1.75]" />
          </div>
          <span className="text-[10px] leading-tight font-medium">Menu</span>
        </button>
      </div>
    </nav>
  );
}
