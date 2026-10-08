"use client";

/**
 * Halaman mandiri Manajemen Hari Libur.
 * Konten ada di HariLiburTab (dipakai juga sebagai tab di /presensi).
 * Hanya admin/superadmin (canManageHolidays) yang boleh mengakses.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { canManageHolidays } from "@/lib/presensi-access";
import { HariLiburTab } from "../_components/hari-libur-tab";

export default function HolidayManagementPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !canManageHolidays(user?.role)) {
      router.replace("/presensi");
    }
  }, [isLoading, user, router]);

  if (!canManageHolidays(user?.role)) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <HariLiburTab />;
}
