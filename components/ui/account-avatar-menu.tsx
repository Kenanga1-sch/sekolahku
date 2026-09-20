"use client";

import { useRouter } from "next/navigation";
import { Globe, LogOut, Settings, User, Undo2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resetAuthGuard } from "@/components/auth-guard";
import { useAuthStore } from "@/lib/stores/auth-store";
import { returnToAdminAction } from "@/actions/auth";
import { resolveUploadUrl } from "@/lib/upload-url";
import { SwitchAccountDialog } from "@/components/ui/switch-account-dialog";

type Placement = "header" | "bottom-nav";

interface Props {
  placement: Placement;
  /** Rute halaman profil (default "/profile"; portal orang tua pakai "/parent/profil"). */
  profileHref?: string;
  /** Tampilkan menu Pengaturan (default true; portal orang tua tidak punya halaman pengaturan). */
  showSettings?: boolean;
  /** Rute website (default "/"). */
  websiteHref?: string;
}

export function resolveUserImage(image: string | null | undefined): string | undefined {
  return resolveUploadUrl(image);
}

function initialsFromName(name: string | undefined): string {
  if (!name) return "A";
  return name.substring(0, 2).toUpperCase();
}

export function AccountAvatarMenu({ placement, profileHref = "/profile", showSettings = true, websiteHref = "/" }: Props) {
  const router = useRouter();
  const { user, logout, isLoading } = useAuthStore();
  const mounted = typeof window !== "undefined";

  const displayName = mounted && !isLoading && user?.name ? user.name : "Admin";
  const displayInitials = mounted && !isLoading && user?.name
    ? initialsFromName(user.name)
    : "A";
  const userImage = mounted && !isLoading && user?.image
    ? resolveUserImage(user.image)
    : undefined;
  const normalizedRole = (user?.role ?? "").toString().toLowerCase();

  // Hanya admin/superadmin yang boleh mengganti akun (endpoint admin-only).
  const canSwitch = normalizedRole === "admin" || normalizedRole === "superadmin";
  // Sedang di-impersonasi? user_info.imp diisi backend saat /api/auth/switch.
  const impersonating = !!(user as any)?.impersonatedBy;

  const handleReturnToAdmin = async () => {
    await returnToAdminAction();
    // returnToAdminAction melakukan hard redirect ke /overview saat sukses.
  };

  const isHeader = placement === "header";

  const handleLogout = () => {
    resetAuthGuard();
    logout();
    router.push("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isHeader ? (
          <Button
            variant="ghost"
            className="relative min-w-[44px] min-h-[44px] md:h-auto md:w-auto rounded-full md:rounded-xl p-0 md:px-3 md:py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-8 md:w-8 flex-shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden ring-2 ring-transparent transition-all">
              <Avatar className="h-full w-full">
                <AvatarImage src={userImage} className="object-cover" />
                <AvatarFallback>{displayInitials}</AvatarFallback>
              </Avatar>
            </div>
            <div className="hidden md:flex flex-col items-start ml-2">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{displayName}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">{normalizedRole}</span>
            </div>
          </Button>
        ) : (
          <button
            type="button"
            aria-label="Akun"
            className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1 transition-all duration-200 active:scale-95 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 focus-visible:outline-none"
          >
            <div className="flex items-center justify-center w-12 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden ring-2 ring-transparent transition-all">
              <Avatar className="h-full w-full">
                <AvatarImage src={userImage} className="object-cover" />
                <AvatarFallback className="text-[10px] font-semibold">
                  {displayInitials}
                </AvatarFallback>
              </Avatar>
            </div>
            <span className="text-[10px] leading-tight truncate px-1 font-medium">
              {displayName || "Akun"}
            </span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isHeader ? "end" : "center"}
        side={isHeader ? "bottom" : "top"}
        sideOffset={isHeader ? 8 : 12}
        className="w-56"
      >
        <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(profileHref)}>
          <User className="mr-2 h-4 w-4" />
          <span>Profil Saya</span>
        </DropdownMenuItem>
        {showSettings && (
          <DropdownMenuItem onClick={() => router.push("/pengaturan")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Pengaturan</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => router.push(websiteHref)}>
          <Globe className="mr-2 h-4 w-4" />
          <span>Kunjungi Website</span>
        </DropdownMenuItem>

        {impersonating && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-amber-700 dark:text-amber-500 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/30"
              onClick={handleReturnToAdmin}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              <span>Kembali ke Admin</span>
            </DropdownMenuItem>
          </>
        )}

        {canSwitch && (
          <>
            <DropdownMenuSeparator />
            <SwitchAccountDialog />
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/10"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Keluar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
