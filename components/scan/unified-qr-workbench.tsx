"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Banknote,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Keyboard,
  Loader2,
  QrCode,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";

import { QRScanner } from "@/components/ui/qr-scanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { goGet, goPost } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { showError, showSuccess, showWarning } from "@/lib/toast";
import type { TabunganSiswaWithRelations } from "@/types/tabungan";

type ScanMode = "camera" | "manual";
type WorkPhase = "ready" | "resolving" | "awaitingSavings" | "saving" | "feedback";
type IdentityKind = "student" | "savings-only";
type AttendanceStatus =
  | "recorded"
  | "already"
  | "wrong-class"
  | "no-session"
  | "not-found"
  | "error";

interface AttendanceSession {
  id: string;
  date: string;
  className: string;
  teacherName?: string;
  status: "open" | "closed";
  recordCount?: number;
}

interface AttendanceStudent {
  id: string;
  fullName: string;
  className?: string;
  photo?: string;
}

interface AttendanceOutcome {
  status: AttendanceStatus;
  message: string;
  student: AttendanceStudent | null;
}

interface CurrentScan {
  qrCode: string;
  identity: IdentityKind;
  displayName: string;
  className?: string;
  attendance: AttendanceOutcome;
  savingsAccount: TabunganSiswaWithRelations | null;
}

interface ScanLogItem {
  id: string;
  name: string;
  detail: string;
  time: string;
  tone: "success" | "warning" | "error" | "neutral";
}

interface UnifiedQRWorkbenchProps {
  backHref: string;
  backLabel: string;
  title?: string;
  description?: string;
}

const SAME_CODE_BLOCK_MS = 3000;
const RESET_AFTER_ACTION_MS = 700;
const INVALID_RESET_MS = 1800;
const QUICK_AMOUNTS = [2000, 5000, 10000, 20000];

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function toArray<T>(response: unknown): T[] {
  const value = response as { data?: T[]; items?: T[] } | T[] | null | undefined;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function getApiMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

function getApiData(error: unknown): Record<string, unknown> | undefined {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    return data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;
  }
  return undefined;
}

function getSavingsName(account: TabunganSiswaWithRelations | null): string {
  return account?.nama || "Penabung";
}

function getSavingsClass(account: TabunganSiswaWithRelations | null): string | undefined {
  return account?.kelas?.nama || account?.kelasId;
}

function attendanceBadgeClass(status: AttendanceStatus): string {
  switch (status) {
    case "recorded":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300";
    case "already":
      return "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300";
    case "wrong-class":
    case "no-session":
      return "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300";
    default:
      return "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300";
  }
}

export function UnifiedQRWorkbench({
  backHref,
  backLabel,
  title = "Scan QR Presensi & Tabungan",
  description = "Satu tempat scan untuk mencatat kehadiran dan setoran tabungan tanpa keluar dari layar antrean.",
}: UnifiedQRWorkbenchProps) {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [scanMode, setScanMode] = useState<ScanMode>("camera");
  const [phase, setPhase] = useState<WorkPhase>("ready");
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [currentScan, setCurrentScan] = useState<CurrentScan | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [nominal, setNominal] = useState("");
  const [catatan, setCatatan] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [stats, setStats] = useState({ attendance: 0, deposits: 0, skipped: 0, invalid: 0 });
  const [scanLog, setScanLog] = useState<ScanLogItem[]>([]);

  const manualInputRef = useRef<HTMLInputElement>(null);
  const nominalInputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const selectedSessionDetail = useMemo(
    () => sessions.find((session) => session.id === selectedSession),
    [selectedSession, sessions]
  );

  const scannerActive = scanMode === "camera" && phase === "ready";
  const hasSavingsAccount = Boolean(currentScan?.savingsAccount);
  const canSubmitDeposit = hasSavingsAccount && Number(nominal) >= 1000 && phase === "awaitingSavings";

  const addLog = useCallback((item: Omit<ScanLogItem, "id" | "time">) => {
    setScanLog((prev) => [
      {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev.slice(0, 5),
    ]);
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const resetWorkbench = useCallback(() => {
    clearResetTimer();
    setPhase("ready");
    setCurrentScan(null);
    setNominal("");
    setCatatan("");
    setFeedback(null);
    if (scanMode === "manual") {
      requestAnimationFrame(() => manualInputRef.current?.focus());
    }
  }, [clearResetTimer, scanMode]);

  const scheduleReset = useCallback(
    (delay = RESET_AFTER_ACTION_MS) => {
      clearResetTimer();
      resetTimerRef.current = setTimeout(resetWorkbench, delay);
    },
    [clearResetTimer, resetWorkbench]
  );

  useEffect(() => {
    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const today = format(new Date(), "yyyy-MM-dd");
        const response = await goGet(`/api/attendance/sessions?date=${today}&status=open`);
        const data = toArray<AttendanceSession>(response);
        setSessions(data);

        const requestedSession = searchParams.get("sessionId");
        const requestedExists = data.some((session) => session.id === requestedSession);
        if (requestedSession && requestedExists) {
          setSelectedSession(requestedSession);
        } else if (data.length > 0) {
          setSelectedSession(data[0].id);
        } else {
          setSelectedSession("");
        }
      } catch {
        showError("Gagal memuat sesi presensi");
        setSessions([]);
        setSelectedSession("");
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchSessions();
  }, [searchParams]);

  useEffect(() => {
    if (phase === "awaitingSavings" && currentScan?.savingsAccount) {
      requestAnimationFrame(() => nominalInputRef.current?.focus());
    }
  }, [currentScan, phase]);

  useEffect(() => {
    if (scanMode === "manual" && phase === "ready") {
      requestAnimationFrame(() => manualInputRef.current?.focus());
    }
  }, [phase, scanMode]);

  useEffect(() => {
    return () => clearResetTimer();
  }, [clearResetTimer]);

  const lookupSavings = useCallback(async (qrCode: string): Promise<TabunganSiswaWithRelations | null> => {
    const response = await goGet(`/api/tabungan/siswa?qrCode=${encodeURIComponent(qrCode)}`);
    const accounts = toArray<TabunganSiswaWithRelations>(response);
    return accounts[0] || null;
  }, []);

  const recordAttendance = useCallback(async (qrCode: string): Promise<AttendanceOutcome> => {
    const payload: Record<string, unknown> = {
      qrCode,
      status: "hadir",
      recordedBy: user?.id || "scanner",
    };

    if (selectedSession) {
      payload.sessionId = selectedSession;
    }

    try {
      const response = await goPost("/api/attendance/scan", payload);
      const student = (response as { student?: AttendanceStudent })?.student || null;
      return {
        status: "recorded",
        message: "Kehadiran tercatat",
        student,
      };
    } catch (error) {
      const message = getApiMessage(error);
      const student = ((getApiData(error)?.student || null) as AttendanceStudent | null);

      if (message.includes("sudah diabsen")) {
        return {
          status: "already",
          message: "Siswa sudah tercatat hadir",
          student,
        };
      }

      if (message.includes("bukan kelas")) {
        return {
          status: "wrong-class",
          message,
          student,
        };
      }

      if (message.includes("Tidak ada sesi") || message.includes("Sesi tidak")) {
        return {
          status: "no-session",
          message,
          student,
        };
      }

      if (message.includes("Siswa tidak ditemukan")) {
        return {
          status: "not-found",
          message: "QR tidak cocok dengan data siswa presensi",
          student: null,
        };
      }

      return {
        status: "error",
        message,
        student,
      };
    }
  }, [selectedSession, user?.id]);

  const processQrCode = useCallback(
    async (rawCode: string) => {
      const qrCode = rawCode.trim();
      if (!qrCode || phase !== "ready") return;

      const now = Date.now();
      if (
        lastScanRef.current?.code === qrCode &&
        now - lastScanRef.current.at < SAME_CODE_BLOCK_MS
      ) {
        return;
      }
      lastScanRef.current = { code: qrCode, at: now };

      clearResetTimer();
      setPhase("resolving");
      setFeedback(null);
      setManualCode("");

      try {
        const [attendance, savingsResult] = await Promise.allSettled([
          recordAttendance(qrCode),
          lookupSavings(qrCode),
        ]);

        const attendanceOutcome =
          attendance.status === "fulfilled"
            ? attendance.value
            : {
                status: "error" as AttendanceStatus,
                message: getApiMessage(attendance.reason),
                student: null,
              };

        const savingsAccount =
          savingsResult.status === "fulfilled" ? savingsResult.value : null;

        if (savingsResult.status === "rejected") {
          showWarning("Data tabungan belum bisa dibaca", getApiMessage(savingsResult.reason));
        }

        const student = attendanceOutcome.student;
        if (!student && !savingsAccount) {
          setStats((prev) => ({ ...prev, invalid: prev.invalid + 1 }));
          setFeedback("QR tidak valid untuk presensi maupun tabungan.");
          setCurrentScan(null);
          setPhase("feedback");
          addLog({
            name: "QR tidak valid",
            detail: qrCode,
            tone: "error",
          });
          scheduleReset(INVALID_RESET_MS);
          return;
        }

        const identity: IdentityKind = student ? "student" : "savings-only";
        const displayName = student?.fullName || getSavingsName(savingsAccount);
        const className = student?.className || getSavingsClass(savingsAccount);

        setCurrentScan({
          qrCode,
          identity,
          displayName,
          className,
          attendance: attendanceOutcome,
          savingsAccount,
        });

        if (attendanceOutcome.status === "recorded") {
          setStats((prev) => ({ ...prev, attendance: prev.attendance + 1 }));
        }

        addLog({
          name: displayName,
          detail:
            identity === "student"
              ? attendanceOutcome.message
              : "Penabung non-siswa, presensi dilewati",
          tone:
            attendanceOutcome.status === "recorded"
              ? "success"
              : attendanceOutcome.status === "already" || identity === "savings-only"
                ? "warning"
                : "neutral",
        });

        setPhase("awaitingSavings");
      } catch (error) {
        const message = getApiMessage(error);
        setFeedback(message);
        setPhase("feedback");
        showError("Scan gagal", message);
        scheduleReset(INVALID_RESET_MS);
      }
    },
    [addLog, clearResetTimer, lookupSavings, phase, recordAttendance, scheduleReset]
  );

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    processQrCode(manualCode);
  };

  const submitDeposit = async () => {
    if (!currentScan?.savingsAccount) {
      showWarning("Rekening tabungan tidak ditemukan");
      return;
    }

    const amount = Number(nominal);
    if (!Number.isFinite(amount) || amount < 1000) {
      showWarning("Nominal minimal Rp1.000");
      return;
    }

    setPhase("saving");
    try {
      await goPost("/api/tabungan/transaksi", {
        siswaId: currentScan.savingsAccount.id,
        tipe: "setor",
        type: "setor",
        nominal: amount,
        catatan: catatan.trim() || undefined,
        userId: user?.id || "scanner",
      });

      setStats((prev) => ({ ...prev, deposits: prev.deposits + 1 }));
      setFeedback(`${formatRupiah(amount)} tercatat untuk ${currentScan.displayName}.`);
      setPhase("feedback");
      showSuccess("Setoran tercatat", `${currentScan.displayName} - ${formatRupiah(amount)}`);
      addLog({
        name: currentScan.displayName,
        detail: `Setoran ${formatRupiah(amount)}`,
        tone: "success",
      });
      scheduleReset();
    } catch (error) {
      const message = getApiMessage(error);
      setPhase("awaitingSavings");
      showError("Gagal mencatat setoran", message);
    }
  };

  const skipSavings = () => {
    if (!currentScan) return;
    setStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
    setFeedback(`${currentScan.displayName} tidak menabung.`);
    setPhase("feedback");
    addLog({
      name: currentScan.displayName,
      detail: "Tidak menabung",
      tone: "neutral",
    });
    scheduleReset();
  };

  const statusCopy = useMemo(() => {
    if (phase === "resolving") return "Membaca QR dan mencocokkan data";
    if (phase === "awaitingSavings" && currentScan?.savingsAccount) return "Isi nominal atau pilih tidak menabung";
    if (phase === "awaitingSavings") return "Tidak ada rekening tabungan, lanjutkan antrean";
    if (phase === "saving") return "Mencatat setoran";
    if (phase === "feedback") return feedback || "Selesai";
    return "Siap scan";
  }, [currentScan?.savingsAccount, feedback, phase]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 pb-8 sm:px-4 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="outline" size="icon" className="mt-1">
            <Link href={backHref} aria-label={`Kembali ke ${backLabel}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">{title}</h1>
              <Badge variant="outline" className="gap-1">
                <QrCode className="h-3.5 w-3.5" />
                Antrean aktif
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" />
              Hadir
            </div>
            <div className="text-lg font-semibold">{stats.attendance}</div>
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5" />
              Setor
            </div>
            <div className="text-lg font-semibold">{stats.deposits}</div>
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Lewat
            </div>
            <div className="text-lg font-semibold">{stats.skipped}</div>
          </div>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardContent className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(320px,0.95fr)_minmax(360px,1.05fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-lg border bg-background/70 p-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Label className="text-xs font-medium text-muted-foreground">Sesi presensi aktif</Label>
                <Select
                  value={selectedSession || "auto"}
                  onValueChange={(value) => setSelectedSession(value === "auto" ? "" : value)}
                  disabled={loadingSessions}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Pilih sesi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Deteksi dari kelas siswa</SelectItem>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        Kelas {session.className} - {session.date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/presensi/sesi/baru">Buat Sesi</Link>
              </Button>
            </div>

            {!loadingSessions && sessions.length === 0 && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Sesi presensi belum dibuka</AlertTitle>
                <AlertDescription>
                  Scan tetap bisa mengenali tabungan. Untuk mencatat hadir otomatis, buka sesi presensi kelas terlebih dulu.
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border bg-zinc-950 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  {phase === "ready" ? (
                    <QrCode className="h-4 w-4 text-emerald-300" />
                  ) : phase === "resolving" || phase === "saving" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  )}
                  {statusCopy}
                </div>
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                  <Button
                    type="button"
                    variant={scanMode === "camera" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 text-white hover:text-white"
                    onClick={() => setScanMode("camera")}
                  >
                    <Camera className="h-4 w-4" />
                    Kamera
                  </Button>
                  <Button
                    type="button"
                    variant={scanMode === "manual" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 text-white hover:text-white"
                    onClick={() => setScanMode("manual")}
                  >
                    <Keyboard className="h-4 w-4" />
                    Manual
                  </Button>
                </div>
              </div>

              {scanMode === "camera" ? (
                <QRScanner
                  active={scannerActive}
                  mirrored={false}
                  onScan={processQrCode}
                  onError={(message) => showError("Kamera bermasalah", message)}
                  className="mx-auto max-w-[520px]"
                />
              ) : (
                <form onSubmit={handleManualSubmit} className="flex flex-col gap-3 rounded-lg bg-white p-3 dark:bg-zinc-900">
                  <Label htmlFor="manual-qr">Kode QR / NISN / NIS</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="manual-qr"
                      ref={manualInputRef}
                      value={manualCode}
                      onChange={(event) => setManualCode(event.target.value)}
                      placeholder="Scan dengan barcode reader atau ketik kode"
                      disabled={phase !== "ready"}
                    />
                    <Button type="submit" disabled={phase !== "ready" || !manualCode.trim()}>
                      Proses
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <Card className="rounded-lg shadow-none">
              <CardHeader className="px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  Hasil Scan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4">
                {!currentScan && phase !== "feedback" && (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center">
                    <QrCode className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Menunggu QR berikutnya</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Setelah QR terbaca, presensi diproses dulu lalu input tabungan muncul di sini.
                    </p>
                  </div>
                )}

                {phase === "feedback" && !currentScan && (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-800 dark:bg-red-950/20 dark:text-red-200">
                    <ShieldAlert className="mb-3 h-10 w-10" />
                    <p className="font-medium">{feedback}</p>
                    <Button className="mt-4" variant="outline" onClick={resetWorkbench}>
                      Scan Lagi
                    </Button>
                  </div>
                )}

                {currentScan && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-background/80 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              {currentScan.identity === "student" ? "Siswa" : "Penabung non-siswa"}
                            </Badge>
                            {currentScan.className && <Badge variant="secondary">{currentScan.className}</Badge>}
                          </div>
                          <h2 className="mt-2 text-2xl font-semibold leading-tight">{currentScan.displayName}</h2>
                          <p className="mt-1 break-all text-xs text-muted-foreground">{currentScan.qrCode}</p>
                        </div>
                        <Badge variant="outline" className={attendanceBadgeClass(currentScan.attendance.status)}>
                          {currentScan.identity === "savings-only"
                            ? "Presensi dilewati"
                            : currentScan.attendance.message}
                        </Badge>
                      </div>
                    </div>

                    {currentScan.savingsAccount ? (
                      <div className="rounded-lg border bg-background/80 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">Setoran tabungan</p>
                            <p className="text-xs text-muted-foreground">
                              Saldo saat ini {formatRupiah(currentScan.savingsAccount.saldoTerakhir || 0)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="gap-1">
                            <Banknote className="h-3.5 w-3.5" />
                            Setor
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="nominal">Nominal</Label>
                            <Input
                              id="nominal"
                              ref={nominalInputRef}
                              type="number"
                              inputMode="numeric"
                              min={1000}
                              step={500}
                              value={nominal}
                              onChange={(event) => setNominal(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && canSubmitDeposit) {
                                  event.preventDefault();
                                  submitDeposit();
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  skipSavings();
                                }
                              }}
                              placeholder="Masukkan nominal setoran"
                              disabled={phase !== "awaitingSavings"}
                              className="h-12 text-lg font-semibold"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {QUICK_AMOUNTS.map((amount) => (
                              <Button
                                key={amount}
                                type="button"
                                variant="outline"
                                onClick={() => setNominal(String(amount))}
                                disabled={phase !== "awaitingSavings"}
                              >
                                {formatRupiah(amount)}
                              </Button>
                            ))}
                          </div>

                          <div>
                            <Label htmlFor="catatan">Catatan</Label>
                            <Textarea
                              id="catatan"
                              value={catatan}
                              onChange={(event) => setCatatan(event.target.value)}
                              placeholder="Opsional"
                              disabled={phase !== "awaitingSavings"}
                              className="min-h-20"
                            />
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <Button
                              type="button"
                              className="sm:col-span-2"
                              onClick={submitDeposit}
                              disabled={!canSubmitDeposit}
                            >
                              {phase === "saving" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CircleDollarSign className="h-4 w-4" />
                              )}
                              Catat Setoran
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={skipSavings}
                              disabled={phase !== "awaitingSavings"}
                            >
                              Tidak Menabung
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Alert>
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Rekening tabungan tidak ditemukan</AlertTitle>
                        <AlertDescription>
                          Kehadiran tetap diproses sesuai status di atas. Lanjutkan antrean atau daftarkan rekening tabungan siswa.
                        </AlertDescription>
                        <div className="col-start-2 mt-3 flex gap-2">
                          <Button type="button" onClick={skipSavings}>
                            Lanjut Scan
                          </Button>
                          <Button asChild variant="outline">
                            <Link href="/tabungan/siswa">Data Tabungan</Link>
                          </Button>
                        </div>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-lg shadow-none">
              <CardHeader className="px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RotateCcw className="h-4 w-4 text-primary" />
                  Riwayat Antrean
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {scanLog.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Belum ada scan pada sesi layar ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {scanLog.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            item.tone === "success"
                              ? "border-emerald-200 text-emerald-700 dark:text-emerald-300"
                              : item.tone === "warning"
                                ? "border-amber-200 text-amber-700 dark:text-amber-300"
                                : item.tone === "error"
                                  ? "border-red-200 text-red-700 dark:text-red-300"
                                  : ""
                          }
                        >
                          {item.time}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {selectedSessionDetail && (
        <p className="text-center text-xs text-muted-foreground">
          Sesi terpilih: kelas {selectedSessionDetail.className}, {selectedSessionDetail.date}. Jika siswa dari kelas lain discan, presensi tidak dicatat tetapi tabungan tetap bisa diproses bila rekeningnya ada.
        </p>
      )}
    </div>
  );
}
