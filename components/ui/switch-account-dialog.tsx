"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Users, Search, ArrowLeftRight, Check } from "lucide-react";

import { goGet, goPost } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveUserImage } from "@/components/ui/account-avatar-menu";
import { cn } from "@/lib/utils";

type UserItem = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  username?: string | null;
  role?: string | null;
  image?: string | null;
  is_active?: boolean | number | null;
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  guru: "Guru",
  bendahara: "Bendahara",
  siswa: "Siswa",
  orangtua: "Orang Tua",
  calon_siswa: "Calon Siswa",
  user: "User",
};

export function SwitchAccountDialog() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await goGet<{ items: UserItem[] }>(
        `/api/users?search=${encodeURIComponent(q)}&limit=30`,
      );
      setUsers(data?.items ?? []);
    } catch (e: any) {
      setError(e.message || "Gagal memuat daftar akun");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce pencarian agar tidak memanggil API setiap ketikan.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, fetchUsers]);

  const handleSwitch = async (target: UserItem) => {
    setSwitching(target.id);
    setError(null);
    try {
      const data = await goPost("/api/auth/switch", { userId: target.id }, { skipRetry: true });
      if (data && (data as any).success) {
        setOpen(false);
        const role = (data as any).user?.role;
        const home = role === "staff" ? "/inventaris" : role === "orangtua" ? "/parent" : "/overview";
        setTimeout(() => { window.location.href = home; }, 150);
      } else {
        setError((data as any)?.error || "Gagal mengganti akun");
        setSwitching(null);
      }
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
      setSwitching(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-amber-700 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          title="Ganti akun (mode admin)"
        >
          <ArrowLeftRight className="h-4 w-4" /> Ganti Akun
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Ganti Akun
          </DialogTitle>
          <DialogDescription>
            Pindah ke akun lain untuk pengetesan tanpa logout. Anda akan kembali
            ke akun admin dengan tombol &quot;Kembali ke Admin&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama / email / username…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
        )}

        <div className="max-h-72 overflow-y-auto -mx-1 divide-y">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Memuat…</p>
          ) : users.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Tidak ada akun ditemukan.
            </p>
          ) : (
            users.map((u) => {
              const isMe = u.id === user?.id;
              const active = u.is_active === true || u.is_active === 1 || u.is_active === undefined;
              const displayName = u.name || u.full_name || u.email || u.username || "Tanpa nama";
              return (
                <button
                  key={u.id}
                  disabled={isMe || !active || switching !== null}
                  onClick={() => handleSwitch(u)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    isMe || !active
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted cursor-pointer",
                  )}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={resolveUserImage(u.image)} alt={displayName} />
                    <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email || u.username}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                    {ROLE_LABELS[u.role || ""] || u.role}
                  </span>
                  {isMe ? (
                    <Check className="h-4 w-4 text-muted-foreground" />
                  ) : switching === u.id ? (
                    <span className="text-xs text-muted-foreground">…</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
