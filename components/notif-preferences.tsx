"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { goGet, goPut } from "@/lib/api-client";

const CATEGORIES = [
  {
    key: "absensi",
    label: "Presensi",
    desc: "Kabar anak hadir, izin, sakit, atau alpha.",
  },
  {
    key: "tabungan",
    label: "Tabungan",
    desc: "Setoran & penarikan yang telah diverifikasi.",
  },
  {
    key: "pengumuman",
    label: "Pengumuman",
    desc: "Pengumuman sekolah untuk semua orang tua.",
  },
  { key: "pr", label: "PR / Tugas", desc: "Tugas dan catatan dari guru." },
  { key: "umum", label: "Lain-lain", desc: "Info lain dari sekolah." },
];

export function NotifPreferences() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await goGet<Record<string, boolean>>(
          "/api/parent/notification-preferences",
        );
        setPrefs(data || {});
      } catch {
        // Default: semua aktif bila gagal memuat.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (category: string, enabled: boolean) => {
    setSavingKey(category);
    const prev = prefs;
    setPrefs({ ...prefs, [category]: enabled });
    try {
      const res = await goPut<{ success?: boolean }>(
        "/api/parent/notification-preferences",
        {
          category,
          enabled,
        },
      );
      if (res?.success === false) throw new Error();
    } catch {
      setPrefs(prev);
      toast.error("Gagal menyimpan preferensi");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" /> Jenis Notifikasi
        </CardTitle>
        <CardDescription>
          Pilih kabar sekolah yang ingin Anda terima.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{cat.label}</p>
                <p className="text-xs text-muted-foreground">{cat.desc}</p>
              </div>
              <Switch
                checked={prefs[cat.key] !== false}
                onCheckedChange={(v) => toggle(cat.key, v)}
                disabled={savingKey === cat.key}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
