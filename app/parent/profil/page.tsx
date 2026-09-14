"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PushToggle } from "@/components/push-toggle";
import { NotifPreferences } from "@/components/notif-preferences";
import { goGet, goPatch } from "@/lib/api-client";

interface Profile {
  name?: string;
  username?: string;
  phone?: string;
}

export default function ParentProfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await goGet<Profile>("/api/profile");
        setProfile(data);
        setName(data?.name || "");
        setPhone(data?.phone || "");
      } catch {
        toast.error("Gagal memuat profil");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = { name, phone };
      if (newPassword) {
        if (!oldPassword) {
          toast.error("Password lama wajib diisi untuk mengubah password");
          setSaving(false);
          return;
        }
        payload.oldPassword = oldPassword;
        payload.password = newPassword;
        payload.passwordConfirm = newPassword;
      }
      const res = await goPatch<{ success?: boolean }>("/api/profile", payload);
      if (res?.success === false) {
        toast.error("Gagal menyimpan profil");
      } else {
        toast.success("Profil tersimpan");
        setNewPassword("");
        setOldPassword("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Profil</h1>
        <p className="text-sm text-muted-foreground">Kelola data akun dan notifikasi Anda.</p>
      </div>

      <PushToggle />

      <NotifPreferences />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Data Akun
          </CardTitle>
          <CardDescription>Nomor HP digunakan sebagai nama pengguna saat masuk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nomor HP (username)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label>Password Lama</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Wajib diisi bila mengubah password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password Baru (opsional)</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Kosongkan bila tidak diubah"
            />
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
