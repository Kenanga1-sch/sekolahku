"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Library,
  Wallet,
  ClipboardList,
  Package,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { AccountAvatarMenu } from "@/components/ui/account-avatar-menu";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  matchPaths?: string[];
  roles?: UserRole[];
  /**
   * Roles yang TIDAK melihat item ini di bottom nav. Item tetap bisa
   * diakses dari menu lain (FAB / sidebar). Berguna untuk memberi ruang
   * bagi slot Akun (avatar) di bottom nav mobile.
   */
  excludeFromBottomNav?: string[];
  /**
   * Cocokkan href secara eksak (pathname === href), bukan startsWith.
   * Wajib untuk rute induk yang menjadi prefix rute lain (mis. "/parent"
   * yang diikuti "/parent/presensi"), agar tidak selalu aktif.
   */
  exact?: boolean;
}

// Ordered by priority; first 3 visible items fill the link slots (2 left, 1 right of FAB);
// the 4th slot is reserved for the account avatar dropdown.
const allItems: BottomNavItem[] = [
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
    roles: ["admin", "superadmin", "guru"],
  },
  {
    href: "/perpustakaan",
    label: "Perpus",
    icon: Library,
    matchPaths: ["/perpustakaan"],
    roles: ["admin", "superadmin"],
  },
  {
    href: "/tabungan",
    label: "Tabungan",
    icon: Wallet,
    matchPaths: ["/tabungan"],
    roles: ["admin", "superadmin", "guru", "staff"],
    excludeFromBottomNav: ["admin", "superadmin"],
  },
  {
    href: "/inventaris",
    label: "Inventaris",
    icon: Package,
    matchPaths: ["/inventaris"],
    roles: ["admin", "superadmin", "guru", "staff"],
    excludeFromBottomNav: ["guru", "staff"],
  },
  {
    href: "/presensi",
    label: "Presensi",
    icon: ClipboardList,
    matchPaths: ["/presensi"],
    roles: ["admin", "superadmin", "guru"],
  },
  {
    href: "/presensi/saya",
    label: "Presensi",
    icon: ClipboardList,
    matchPaths: ["/presensi/saya"],
    roles: ["siswa"],
  },
  {
    href: "/tabungan/saya",
    label: "Tabungan",
    icon: Wallet,
    matchPaths: ["/tabungan/saya"],
    roles: ["siswa"],
  },
];

function filterItemsByRole(items: BottomNavItem[], userRole?: string | null): BottomNavItem[] {
  // While auth is loading (no role), only show role-agnostic items to avoid flashing restricted links
  if (!userRole) return items.filter((item) => !item.roles);
  const normalized = userRole.toLowerCase();
  return items.filter(
    (item) =>
      (!item.roles || item.roles.some((role) => role.toLowerCase() === normalized)) &&
      !item.excludeFromBottomNav?.some((r) => r.toLowerCase() === normalized)
  );
}

interface BottomNavProps {
  onMenuClick: () => void;
  userRole?: string | null;
  /**
   * Daftar item custom (mis. untuk portal orang tua). Jika diberikan,
   * item ini dipakai apa adanya tanpa filter role; 3 pertama mengisi
   * slot link mobile, sisanya tampil di bottom sheet FAB (bersama semua
   * item lain yang dirender layout di SidebarBody).
   */
  items?: BottomNavItem[];
  /**
   * Rute halaman profil untuk avatar di slot ke-4 (default "/profile";
   * portal orang tua pakai "/parent/profil").
   */
  profileHref?: string;
}

export function BottomNav({ onMenuClick, userRole, items, profileHref }: BottomNavProps) {
  const pathname = usePathname();

  const visibleItems = useMemo(
    () => (items ?? filterItemsByRole(allItems, userRole)).slice(0, 3),
    [userRole, items]
  );
  const splitIndex = Math.ceil(visibleItems.length / 2);
  const leftItems = visibleItems.slice(0, splitIndex);
  const rightItems = visibleItems.slice(splitIndex);

  const isActive = (item: BottomNavItem) => {
    if (item.exact) return pathname === item.href;
    if (item.matchPaths) {
      return item.matchPaths.some((p) => pathname.startsWith(p));
    }
    return pathname.startsWith(item.href);
  };

  const renderItem = (item: BottomNavItem) => {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-label={item.label}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 transition-colors duration-150 active:scale-[0.98]",
          active
            ? "font-semibold text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <div
          className={cn(
            "flex h-9 w-12 items-center justify-center rounded-lg transition-colors duration-150",
            active ? "bg-surface-muted" : "bg-transparent"
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5 transition-colors duration-150",
              active ? "stroke-[2.25]" : "stroke-[1.75]"
            )}
          />
        </div>
        <span
          className={cn(
            "text-[10px] leading-tight truncate px-1 transition-all duration-200",
            active ? "font-bold" : "font-medium"
          )}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "bg-surface/95 backdrop-blur-xl",
        "border-t border-line/60",
        "pb-[env(safe-area-inset-bottom)]",
        "shadow-[0_-8px_24px_rgba(4,34,43,0.06)]"
      )}
    >
      <div className="flex items-end justify-between h-[65px] px-2 max-w-md mx-auto relative pb-1">
        {/* Left Items */}
        <div className="flex flex-1 items-center justify-around">
          {leftItems.map(renderItem)}
        </div>

        {/* Center FAB (Floating Action Button) */}
        <div className="flex-shrink-0 w-16 flex justify-center pb-2">
          <button
            onClick={onMenuClick}
            className={cn(
              "absolute -top-6",
              "flex flex-col items-center justify-center",
              "h-14 w-14 rounded-full",
              "bg-primary text-primary-foreground",
              "shadow-lg shadow-primary/25",
              "transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]",
              "ring-4 ring-surface"
            )}
            aria-label="Menu"
          >
            <Menu className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Right Items */}
        <div className="flex flex-1 items-center justify-around">
          {rightItems.map(renderItem)}
          <AccountAvatarMenu placement="bottom-nav" profileHref={profileHref} />
        </div>
      </div>
    </nav>
  );
}
