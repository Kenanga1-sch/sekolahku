"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, AlertTriangle, RotateCcw, ListChecks } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { goGet, goPost } from "@/lib/api-client";
import { getItemUnits, getItemBatches, type ItemUnit } from "@/lib/inventory";
import { QRScanner } from "@/components/ui/qr-scanner";

interface AuditResult {
  total: number;
  found: number;
  missingNo: number[];
  unknownNo: number[];
  isComplete: boolean;
}

/**
 * Pemeriksaan barang habis pakai dengan memindai label.
 *
 * Alurnya: petugas memindai setiap bungkus yang ada di rak. Nomor yang
 * dipindai dikirim ke server, lalu nomor yang TIDAK ikut dipindai dilaporkan
 * sebagai temuan. Dengan ini pernyataan "beli 50 rim, harus ada bungkus 1..50"
 * bisa dibuktikan, bukan sekadar diyakini.
 *
 * Pemeriksaan tidak mengubah stok — penyesuaian tetap keputusan petugas.
 */
export function StokOpnameClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const itemId = searchParams.get("item") || "";

  const [item, setItem] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [units, setUnits] = useState<ItemUnit[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const [scanned, setScanned] = useState<number[]>([]);
  const [scanning, setScanning] = useState(false);
  const [manualNo, setManualNo] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);

  useEffect(() => {
    if (!itemId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw: any = await goGet(`/api/inventory/items/${itemId}`);
        const rec = raw?.item || raw?.data || raw;
        if (cancelled) return;
        setItem(rec);
        const bs = await getItemBatches(itemId);
        if (cancelled) return;
        setBatches(bs);
        if (bs.length > 0) {
          // Ikuti tahun batch terbaru.
          setYear(bs[0].year);
        }
        const us = await getItemUnits(itemId, bs.length > 0 ? bs[0].year : new Date().getFullYear(), false);
        if (cancelled) return;
        setUnits(us);
      } catch {
        if (!cancelled) toast.error("Gagal memuat data barang");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  // Muat ulang unit saat tahun berubah.
  useEffect(() => {
    if (!itemId) return;
    getItemUnits(itemId, year, false)
      .then(setUnits)
      .catch(() => setUnits([]));
  }, [itemId, year]);

  const addNumber = (no: number) => {
    if (!units.some((u) => u.unitNo === no)) {
      toast.error(`Nomor ${no} tidak dikenal untuk tahun ${year}`);
      return;
    }
    setScanned((prev) => (prev.includes(no) ? prev : [...prev, no].sort((a, b) => a - b)));
  };

  // QR berformat /inventaris/detail?id=..&t=item&u=N(&b=..)
  const handleScan = (data: string) => {
    try {
      const raw = data.trim();
      let no: number | null = null;
      if (raw.includes("u=")) {
        const qs = raw.includes("?") ? raw.split("?")[1] : raw;
        const params = new URLSearchParams(qs);
        const u = params.get("u");
        if (u) no = parseInt(u, 10);
      } else if (/^\d+$/.test(raw)) {
        // Bila pemindai membaca angka saja.
        no = parseInt(raw, 10);
      }
      if (no && no > 0) {
        addNumber(no);
      } else {
        toast.error("Kode tidak dikenali: " + raw.slice(0, 40));
      }
    } catch {
      toast.error("Gagal membaca kode");
    }
  };

  const submitAudit = async () => {
    if (!itemId) return;
    try {
      const res: any = await goPost(`/api/inventory/items/${itemId}/units/audit`, {
        numbers: scanned,
        year,
      });
      if (res?.error) throw new Error(res.error);
      setResult(res);
      if (res?.isComplete) {
        toast.success(`Lengkap! ${res.found} dari ${res.total} bungkus ditemukan`);
      } else {
        toast.warning(`${res.missingNo?.length || 0} bungkus tidak ditemukan`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memeriksa");
    }
  };

  const reset = () => {
    setScanned([]);
    setResult(null);
  };

  const scannedSet = useMemo(() => new Set(scanned), [scanned]);
  const remaining = units.length - scanned.length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Memuat data…</p>
      </div>
    );
  }

  if (!itemId) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Pilih barang yang akan diperiksa dari halaman stok.</p>
            <Link href="/inventaris/stok">
              <Button className="mt-4" variant="outline">Kembali ke Stok</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-4">
        <Link href="/inventaris/stok">
          <Button variant="outline" size="icon" aria-label="Kembali">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Pemeriksaan Stok</h1>
          <p className="truncate text-sm text-muted-foreground">
            {item?.name || "Barang"}
            {item?.unit ? ` (${item.unit})` : ""} · tahun {year}
          </p>
        </div>
      </div>

      {batches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Penerimaan tercatat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {batches.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{b.batchCode}</span>
                <span className="text-muted-foreground">
                  nomor {b.startNo}–{b.endNo} ({b.quantity})
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4" /> Pindai Label
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scanning ? (
            <div className="space-y-2">
              <QRScanner onScan={handleScan} active={scanning} />
              <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
                Selesai Memindai
              </Button>
            </div>
          ) : (
            <Button className="w-full gap-2" onClick={() => setScanning(true)}>
              <Camera className="h-4 w-4" /> Buka Kamera
            </Button>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs" htmlFor="nomor-manual">Input nomor manual</Label>
              <Input
                id="nomor-manual"
                type="number"
                placeholder="mis. 7"
                value={manualNo}
                onChange={(e) => setManualNo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const n = parseInt(manualNo, 10);
                    if (n > 0) addNumber(n);
                    setManualNo("");
                  }
                }}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                const n = parseInt(manualNo, 10);
                if (n > 0) addNumber(n);
                setManualNo("");
              }}
            >
              Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Terpindai {scanned.length} dari {units.length}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={reset}>
                <RotateCcw className="h-3 w-3" /> Ulang
              </Button>
              <Button size="sm" className="gap-1 text-xs" onClick={submitAudit} disabled={scanned.length === 0}>
                <ListChecks className="h-3 w-3" /> Periksa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada bungkus tercatat untuk tahun {year}. Catat penerimaan barang terlebih dulu.
            </p>
          ) : (
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-8 md:grid-cols-10">
              {units.map((u) => {
                const ok = scannedSet.has(u.unitNo);
                const issued = u.status === "ISSUED";
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addNumber(u.unitNo)}
                    title={
                      issued
                        ? `Nomor ${u.unitNo} — sudah keluar ke ${u.issuedTo || "-"}`
                        : `Nomor ${u.unitNo} — tersedia`
                    }
                    className={`flex h-9 items-center justify-center rounded border text-xs transition-colors ${
                      ok
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : issued
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {u.unitNo}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Kuning = sudah keluar (catatan tujuan). Hijau = sudah dipindai hadir. Ketuk nomor untuk
            menandai hadir tanpa kamera.
          </p>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.isComplete ? "border-emerald-300" : "border-amber-300"}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              {result.isComplete ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Lengkap
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Ada temuan
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Ditemukan <strong>{result.found}</strong> dari <strong>{result.total}</strong> bungkus.
            </p>
            {result.missingNo?.length > 0 && (
              <div>
                <p className="font-medium text-amber-800">Tidak ditemukan ({result.missingNo.length}):</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.missingNo.map((n) => (
                    <Badge key={n} variant="outline" className="border-amber-300 text-amber-800">
                      {n}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {result.unknownNo?.length > 0 && (
              <div>
                <p className="font-medium">Nomor asing ({result.unknownNo.length}):</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.unknownNo.map((n) => (
                    <Badge key={n} variant="outline">{n}</Badge>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nomor ini dipindai tetapi tidak tercatat pada tahun {year}.
                </p>
              </div>
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Pemeriksaan tidak mengubah stok. Penyesuaian tetap dicatat lewat transaksi tersendiri.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
