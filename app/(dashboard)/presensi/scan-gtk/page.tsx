"use client";

/**
 * Halaman Scan Presensi GTK — khusus presensi GTK honorer (GTT/GTY/Honorer/PTT
 * + Pembina Ekskul). Berbeda dari /presensi/scan (workbench siswa+tabungan),
 * halaman ini fokus: scan QR GTK + validasi radius lokasi (GPS) di server.
 *
 * PNS/PPPK/P3K ditolak backend (tidak wajib presensi). Scan di luar radius
 * juga ditolak kecuali override oleh admin (dengan alasan).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Crosshair,
  IdCard,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { QRScanner } from "@/components/ui/qr-scanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/stores/auth-store";
import { showError, showSuccess, showWarning } from "@/lib/toast";
import {
  gtkAttendanceApi,
  attendancePointsApi,
  ekskulTeachersApi,
  formatDistance,
  type AttendancePoint,
  type EkskulTeacher,
} from "@/lib/presensi-gtk";

type GeoState = {
  status: "idle" | "loading" | "ready" | "error";
  lat?: number;
  lng?: number;
  accuracy?: number;
  error?: string;
};

type ScanResult = {
  tone: "success" | "warning" | "error";
  name?: string;
  message: string;
  distanceM?: number | null;
  withinRadius?: boolean | null;
  pointName?: string;
  already?: boolean;
};

const SAME_CODE_BLOCK_MS = 3000;

export default function ScanGtkPage() {
  const { user } = useAuthStore();
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [points, setPoints] = useState<AttendancePoint[]>([]);
  const [ekskul, setEkskul] = useState<EkskulTeacher[]>([]);
  const [mode, setMode] = useState<"gtk" | "ekskul">("gtk");
  const [pointId, setPointId] = useState<string>("");
  const [ekskulId, setEkskulId] = useState<string>("");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [phase, setPhase] = useState<"ready" | "processing" | "result">("ready");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [stats, setStats] = useState({ recorded: 0, already: 0, rejected: 0 });
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const isPrivileged = user?.role === "admin" || user?.role === "superadmin";

  // Muat titik & pengajar ekskul.
  const loadData = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([attendancePointsApi.list(), ekskulTeachersApi.list()]);
      const pts = (p as any)?.data || [];
      setPoints(pts);
      setEkskul((e as any)?.data || []);
      const def = pts.find((x: AttendancePoint) => x.pointType === "sekolah" && x.isActive) || pts.find((x: AttendancePoint) => x.isActive);
      if (def) setPointId(def.id);
    } catch {
      showError("Gagal memuat data titik presensi");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ambil lokasi GPS saat halaman dibuka.
  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ status: "error", error: "Perangkat tidak mendukung geolokasi" });
      return;
    }
    setGeo((g) => ({ ...g, status: "loading", error: undefined }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          status: "ready",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        setGeo({ status: "error", error: err.message || "Gagal membaca lokasi (izinkan akses lokasi)" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const activePoint = useMemo(
    () => points.find((p) => p.id === pointId) || points.find((p) => p.pointType === "sekolah") || null,
    [points, pointId]
  );

  const processCode = useCallback(
    async (raw: string) => {
      const qr = raw.trim();
      if (!qr || phase === "processing") return;
      const now = Date.now();
      if (lastScanRef.current?.code === qr && now - lastScanRef.current.at < SAME_CODE_BLOCK_MS) return;
      lastScanRef.current = { code: qr, at: now };

      setPhase("processing");
      setResult(null);

      try {
        const payload: any = {
          qrCode: qr,
          status: "hadir",
          recordedBy: user?.id || "scanner",
        };
        if (pointId) payload.pointId = pointId;
        if (mode === "ekskul" && ekskulId) payload.extracurricularId = ekskulId;
        if (geo.status === "ready" && geo.lat != null && geo.lng != null) {
          payload.latitude = geo.lat;
          payload.longitude = geo.lng;
        }
        if (override && isPrivileged && overrideReason.trim()) {
          payload.overrideRadius = true;
          payload.overrideReason = overrideReason.trim();
        }

        const res: any = await gtkAttendanceApi.scan(payload);
        const data = res?.location || {};
        const name = res?.employee?.name || "GTK";
        const already = Boolean(res?.already);
        setResult({
          tone: already ? "warning" : "success",
          name,
          message: res?.message || (already ? "Sudah tercatat hadir" : "Kehadiran tercatat"),
          distanceM: data.distanceM ?? null,
          withinRadius: data.withinRadius ?? null,
          pointName: data.pointName,
          already,
        });
        setStats((s) => (already ? { ...s, already: s.already + 1 } : { ...s, recorded: s.recorded + 1 }));
        if (already) {
          showWarning(`${name} sudah absen hari ini`);
        } else {
          showSuccess("Kehadiran GTK tercatat", name);
        }
      } catch (err: any) {
        const msg: string = err?.message || "Gagal memproses scan";
        const isRadius = /radius/i.test(msg);
        const isExcluded = /PNS|PPPK|P3K|wajib presensi/i.test(msg);
        setResult({
          tone: "error",
          message: msg,
          distanceM: err?.data?.data?.distanceM ?? null,
          withinRadius: false,
          pointName: err?.data?.data?.pointName,
        });
        setStats((s) => ({ ...s, rejected: s.rejected + 1 }));
        if (isRadius) showError("Di luar radius", msg);
        else if (isExcluded) showError("GTK dikecualikan", msg);
        else showError("Scan gagal", msg);
      } finally {
        setPhase("result");
        setTimeout(() => {
          setResult(null);
          setPhase("ready");
        }, 3500);
      }
    },
    [phase, pointId, mode, ekskulId, geo, override, isPrivileged, overrideReason, user?.id]
  );

  const scannerActive = phase === "ready";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button asChild variant="outline" size="icon" className="mt-1">
          <Link href="/presensi" aria-label="Kembali ke Presensi">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Scan Presensi GTK</h1>
            <Badge variant="outline" className="gap-1 bg-indigo-50 text-indigo-700 border-indigo-200">
              <IdCard className="h-3.5 w-3.5" /> Honorer & Pembina Ekskul
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            PNS/PPPK/P3K dikecualikan. Lokasi divalidasi terhadap radius titik presensi.
          </p>
        </div>
      </div>

      {/* Status lokasi */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            {geo.status === "ready" ? (
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 border border-emerald-200">
                <Crosshair className="h-5 w-5" />
              </div>
            ) : geo.status === "loading" ? (
              <div className="rounded-lg bg-sky-50 p-2 text-sky-600 border border-sky-200">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="rounded-lg bg-rose-50 p-2 text-rose-600 border border-rose-200">
                <ShieldAlert className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">
                {geo.status === "ready"
                  ? "Lokasi terdeteksi"
                  : geo.status === "loading"
                  ? "Mendeteksi lokasi..."
                  : "Lokasi tidak tersedia"}
              </p>
              <p className="text-xs text-muted-foreground">
                {geo.status === "ready"
                  ? `Akurasi ±${Math.round(geo.accuracy || 0)} m · ${activePoint ? `${activePoint.name} (radius ${activePoint.radiusM} m)` : "titik default"}`
                  : geo.error || "Aktifkan izin lokasi pada perangkat."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={requestLocation} disabled={geo.status === "loading"}>
            <RefreshCw className="h-4 w-4 mr-2" /> Perbarui Lokasi
          </Button>
        </CardContent>
      </Card>

      {/* Pengaturan sesi */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pengaturan Sesi Scan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Jenis Presensi</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "gtk" | "ekskul")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gtk">Presensi GTK Harian</SelectItem>
                <SelectItem value="ekskul">Presensi Sesi Ekskul</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Titik Lokasi</Label>
            <Select value={pointId} onValueChange={setPointId}>
              <SelectTrigger><SelectValue placeholder="Pilih titik" /></SelectTrigger>
              <SelectContent>
                {points.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.radiusM} m
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mode === "ekskul" && (
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-semibold">Sesi Ekskul</Label>
              <Select value={ekskulId} onValueChange={setEkskulId}>
                <SelectTrigger><SelectValue placeholder="Pilih ekskul" /></SelectTrigger>
                <SelectContent>
                  {ekskul.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.extracurricularName} — {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ekskul.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">
                  Belum ada pengajar ekskul. Atur di Direktori GTK.
                </p>
              )}
            </div>
          )}

          {isPrivileged && (
            <div className="sm:col-span-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-800">Override Radius (Admin)</p>
                  <p className="text-[11px] text-amber-700/80">Catat kehadiran walau di luar radius. Alasan wajib.</p>
                </div>
                <Switch checked={override} onCheckedChange={setOverride} />
              </div>
              {override && (
                <Input
                  placeholder="Alasan override (mis. dinas luar)"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="bg-white"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border bg-white px-3 py-2">
          <p className="text-xs text-muted-foreground font-medium">Tercatat</p>
          <p className="text-xl font-bold font-mono">{stats.recorded}</p>
        </div>
        <div className="rounded-lg border bg-white px-3 py-2">
          <p className="text-xs text-muted-foreground font-medium">Sudah Absen</p>
          <p className="text-xl font-bold font-mono">{stats.already}</p>
        </div>
        <div className="rounded-lg border bg-white px-3 py-2">
          <p className="text-xs text-muted-foreground font-medium">Ditolak</p>
          <p className="text-xl font-bold font-mono">{stats.rejected}</p>
        </div>
      </div>

      {/* Scanner + hasil */}
      <Card>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <QRScanner
              active={scannerActive}
              mirrored={false}
              onScan={processCode}
              onError={(m) => showError("Kamera bermasalah", m)}
              caption="Arahkan kamera ke QR kartu GTK"
            />
            {!scannerActive && (
              <p className="mt-2 text-center text-xs text-slate-400">
                {phase === "processing" ? "Memproses..." : "Menampilkan hasil..."}
              </p>
            )}
          </div>

          <div className="flex flex-col justify-center">
            {!result ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-center">
                <IdCard className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Menunggu scan kartu GTK</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kehadiran dicatat untuk {format(new Date(), "dd MMM yyyy")}.
                </p>
              </div>
            ) : (
              <div
                className={`rounded-lg border p-4 ${
                  result.tone === "success"
                    ? "border-emerald-200 bg-emerald-50/50"
                    : result.tone === "warning"
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-rose-200 bg-rose-50/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.tone === "success" ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : result.tone === "warning" ? (
                    <ShieldAlert className="h-6 w-6 text-amber-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-rose-600" />
                  )}
                  <div className="min-w-0">
                    {result.name && <p className="font-bold truncate">{result.name}</p>}
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                  </div>
                </div>
                {(result.distanceM != null || result.pointName) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {result.distanceM != null && (
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="h-3 w-3" /> {formatDistance(result.distanceM)}
                      </Badge>
                    )}
                    {result.pointName && <Badge variant="outline">{result.pointName}</Badge>}
                    {result.withinRadius != null && (
                      <Badge
                        variant="outline"
                        className={result.withinRadius ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}
                      >
                        {result.withinRadius ? "Dalam radius" : "Luar radius"}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Alert className="border-slate-200">
        <MapPin className="h-4 w-4" />
        <AlertTitle className="text-sm">Tentang radius & pengecualian</AlertTitle>
        <AlertDescription className="text-xs">
          Presensi hanya untuk GTT/GTY/Honorer/PTT & Pembina Ekskul. PNS/PPPK/P3K tidak perlu absen.
          Jarak dihitung dari titik presensi yang dipilih.
        </AlertDescription>
      </Alert>
    </div>
  );
}
