"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, ShieldCheck } from "lucide-react";

import type { User as UserType } from "@/types";
import { formatCreatedDate } from "./user-helpers";

/** Dialog detail akun pengguna (read-only) + tombol Edit Profil. */
export function UserProfileDialog({
  user,
  open,
  onOpenChange,
  onEdit,
}: {
  user: UserType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (user: UserType) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail Akun Pengguna</DialogTitle>
          <DialogDescription>
            Informasi lengkap akun pengguna {user?.name}
          </DialogDescription>
        </DialogHeader>

        {user && (
          <div className="space-y-6 py-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-xl font-semibold">
                {user.name?.substring(0, 2).toUpperCase() || "U"}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{user.name}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <Badge className="mt-1 capitalize" variant="outline">
                  {user.role}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Nama Panggilan</Label>
                <p className="text-sm">{user.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Username</Label>
                <p className="text-sm">{user.username || "-"}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Telepon</Label>
                <p className="text-sm">{user.phone || "-"}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
                <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                  {user.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Aktivitas & Keamanan</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Terdaftar</span>
                  <span>{formatCreatedDate(user.created)}</span>
                </div>
                {user.mustChangePassword && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wajib ganti password</span>
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Ya</Badge>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Aksi Terbaru</h4>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  Profil pengguna dengan peran {user.role} di sistem
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button onClick={() => { if (user) { onEdit(user); onOpenChange(false); } }}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Profil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
