"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, BellRing, Loader2, Smartphone, Send, Download, Music } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PwaInstallButton } from "@/components/pwa-install-button";
import {
  disablePush,
  enablePush,
  getPushStatus,
  getPushSupportState,
  sendTestPush,
  type PushStatus,
  type PushSupportState,
} from "@/lib/push";

interface PushToggleProps {
  /** Tampilkan tombol "Kirim Notifikasi Uji". Default true: semua user
   * boleh menguji perangkatnya sendiri (route kirim ke pemanggil). */
  showTest?: boolean;
}

export function PushToggle({ showTest = true }: PushToggleProps) {
  const [support, setSupport] = useState<PushSupportState>("unsupported");
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setSupport(getPushSupportState());
    try {
      setStatus(await getPushStatus());
    } catch {
      setStatus({ enabled: false, devices: 0, permission: "unsupported", subscribed: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Perbarui saat tab kembali aktif (mis. user balik dari pengaturan izin).
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const devices = await enablePush();
      toast.success(`Notifikasi aktif di ${devices} perangkat ini`);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengaktifkan notifikasi");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await disablePush();
      toast.success("Notifikasi dimatikan di perangkat ini");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const sent = await sendTestPush();
      if (sent > 0) {
        toast.success(`Notifikasi uji terkirim ke ${sent} perangkat`);
      } else {
        toast.error("Tidak ada perangkat yang menerima — coba aktifkan ulang notifikasi di perangkat ini.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengirim notifikasi uji");
    } finally {
      setBusy(false);
    }
  };

  const supported = support === "ready";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-5 w-5 text-primary" /> Notifikasi Push (PWA)
        </CardTitle>
        <CardDescription>
          Terima pemberitahuan langsung di perangkat, walau situs sedang tidak dibuka.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Install PWA */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Aplikasi</span>
          </div>
          <PwaInstallButton />
        </div>

        {/* Panduan nada dering khusus */}
        <details className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <Music className="h-4 w-4 text-muted-foreground" />
            Atur nada dering khusus untuk notifikasi sekolah
          </summary>
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            <p>
              Notifikasi akan memakai <strong>pola getar khas</strong> dan berbunyi
              setiap kali masuk. Nada deringnya mengikuti sistem — berikut cara
              memilih nada khusus agar mudah dikenali:
            </p>
            <div>
              <p className="font-medium text-foreground">Android (Chrome):</p>
              <p>
                Setelan → Aplikasi → Chrome → Notifikasi → cari kanal
                &ldquo;Situs web sekolah&rdquo; / nama situs ini → <em>Nada dering</em> →
                pilih suara khusus. Aktifkan juga <em>Getaran</em>.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">iPhone / iPad:</p>
              <p>
                Setelan → Notifikasi → cari nama aplikasi ini → aktifkan
                <em> Suara</em> &amp; <em>Getaran</em>. Pilihan nada terbatas
                (mengikuti sistem iOS).
              </p>
            </div>
            <p className="italic">
              Catatan: aplikasi web tidak dapat memaksa nada dering tertentu —
              bunyi diatur oleh sistem operasi perangkat.
            </p>
          </div>
        </details>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa status…
          </div>
        ) : support === "unsupported" ? (
          <p className="text-sm text-muted-foreground">
            Perangkat atau browser ini tidak mendukung notifikasi push.
          </p>
        ) : support === "ios-needs-install" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            Di iPhone/iPad, notifikasi hanya bisa aktif setelah situs ini
            ditambahkan ke Home Screen: buka menu <strong>Bagikan</strong> →
            <strong> Tambahkan ke Layar Utama</strong>, lalu buka situs dari ikon tersebut.
          </div>
        ) : !status?.enabled ? (
          <p className="text-sm text-muted-foreground">
            Server belum mengaktifkan notifikasi push. Hubungi administrator.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {status.subscribed ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <BellRing className="h-4 w-4" /> Aktif di {status.devices} perangkat
                </span>
                <Button variant="outline" size="sm" onClick={handleDisable} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellOff className="mr-2 h-4 w-4" />}
                  Matikan
                </Button>
                {showTest && (
                  <Button variant="secondary" size="sm" onClick={handleTest} disabled={busy}>
                    <Send className="mr-2 h-4 w-4" /> Kirim Uji
                  </Button>
                )}
              </>
            ) : (
              <Button onClick={handleEnable} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                Aktifkan Notifikasi
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
