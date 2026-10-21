"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getGoogleLinkStatusAction,
  linkGoogleAccountAction,
  unlinkGoogleAccountAction,
} from "@/actions/auth";

/**
 * Kartu "Hubungkan akun Google" untuk akun lama yang dibuat dengan nomor HP
 * (tanpa email). Setelah callback OAuth, backend mengembalikan pengguna ke
 * halaman profil dengan ?google=link dan identitas Google masih tersimpan di
 * cookie tiket — satu klik untuk menautkan.
 *
 * Bisa dipakai SEMUA role: sesi yang sedang aktif sudah membuktikan
 * kepemilikan akun, jadi tidak perlu kode verifikasi tambahan.
 *
 * Query string dibaca dari window.location (bukan useSearchParams) supaya
 * halaman ini tidak wajib dibungkus <Suspense> pada static export.
 */
export function GoogleLinkCard({ redirect = "/profile?google=link" }: { redirect?: string }) {
  const [linking, setLinking] = useState(false);
  const [linkedEmail, setLinkedEmail] = useState<string | null>(null);
  const [awaitingLink, setAwaitingLink] = useState(false);

  useEffect(() => {
    let alive = true;

    // Status tautan saat halaman dimuat (agar email tertaut langsung terlihat).
    getGoogleLinkStatusAction().then((res) => {
      if (!alive) return;
      if (res.linked) setLinkedEmail(res.email || null);
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "link") {
      setAwaitingLink(true);
      toast.info('Akun Google terverifikasi. Klik "Hubungkan" untuk menautkan.');
    }
    return () => {
      alive = false;
    };
  }, []);

  const connect = () => {
    setLinking(true);
    const qs = new URLSearchParams({ mode: "link", redirect });
    window.location.href = `/api/auth/google/start?${qs.toString()}`;
  };

  const finish = async () => {
    setLinking(true);
    try {
      const res = await linkGoogleAccountAction();
      if (res.success) {
        setLinkedEmail(res.email || null);
        setAwaitingLink(false);
        toast.success("Akun Google berhasil ditautkan");
      } else {
        toast.error(res.error || "Gagal menautkan akun Google");
      }
    } finally {
      setLinking(false);
    }
  };

  const unlink = async () => {
    setLinking(true);
    try {
      const res = await unlinkGoogleAccountAction();
      if (res.success) {
        setLinkedEmail(null);
        toast.success("Tautan Google dilepas");
      } else {
        toast.error(res.error || "Gagal melepas tautan Google");
      }
    } finally {
      setLinking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" /> Akun Google
        </CardTitle>
        <CardDescription>
          Tautkan akun Google agar bisa masuk tanpa mengetik nomor HP dan password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {linkedEmail && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Tertaut ke <strong>{linkedEmail}</strong>
          </p>
        )}
        {awaitingLink && !linkedEmail ? (
          <Button onClick={finish} disabled={linking} className="w-full">
            {linking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Hubungkan akun Google
          </Button>
        ) : linkedEmail ? (
          <>
            <Button onClick={connect} disabled={linking} variant="outline" className="w-full">
              {linking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Ganti akun Google
            </Button>
            <Button onClick={unlink} disabled={linking} variant="ghost" className="w-full text-muted-foreground">
              {linking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="mr-2 h-4 w-4" />
              )}
              Lepas tautan Google
            </Button>
          </>
        ) : (
          <Button onClick={connect} disabled={linking} variant="outline" className="w-full">
            {linking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Hubungkan akun Google
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
