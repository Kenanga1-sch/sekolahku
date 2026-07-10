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
import { cn } from "@/lib/utils";
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
  variant?: "default" | "tabungan" | "presensi";
}

const SAME_CODE_BLOCK_MS = 3000;
const RESET_AFTER_ACTION_MS = 2500;
const INVALID_RESET_MS = 3000;
const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

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
  variant = "default",
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
  const [flashColor, setFlashColor] = useState<"green" | "red" | "blue" | null>(null);

  const manualInputRef = useRef<HTMLInputElement>(null);
  const nominalInputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const selectedSessionDetail = useMemo(
    () => sessions.find((session) => session.id === selectedSession),
    [selectedSession, sessions]
  );

  const scannerActive = scanMode === "camera" && (phase === "ready" || phase === "awaitingSavings");
  const hasSavingsAccount = Boolean(currentScan?.savingsAccount);
  const canSubmitDeposit = hasSavingsAccount && Number(nominal) >= 1000 && (phase === "awaitingSavings" || phase === "ready");

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

  // Play audio synthesizer beeps for tactile feedback
  const playBeep = useCallback((type: "success" | "error" | "info" = "success") => {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === "success") {
        // High pitch short beep
        osc.type = "sine";
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === "error") {
        // Low pitch double beep
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else {
        // Info beep
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) {
      console.warn("AudioContext beep failed:", e);
    }
  }, []);

  const triggerFlash = useCallback((color: "green" | "red" | "blue") => {
    setFlashColor(color);
    setTimeout(() => {
      setFlashColor(null);
    }, 450);
  }, []);

  // Global Keyboard Shortcuts inside the workbench
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (phase !== "awaitingSavings") return;
      
      if (e.key === "F1") {
        e.preventDefault();
        setNominal(String(QUICK_AMOUNTS[0]));
        playBeep("info");
      } else if (e.key === "F2") {
        e.preventDefault();
        setNominal(String(QUICK_AMOUNTS[1]));
        playBeep("info");
      } else if (e.key === "F3") {
        e.preventDefault();
        setNominal(String(QUICK_AMOUNTS[2]));
        playBeep("info");
      } else if (e.key === "F4") {
        e.preventDefault();
        setNominal(String(QUICK_AMOUNTS[3]));
        playBeep("info");
      }
    };
    
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [phase, playBeep]);

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
      if (!qrCode) return;

      // Only restrict when resolving or saving
      if (phase === "resolving" || phase === "saving") return;

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
      setNominal("");
      setCatatan("");

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
          
          playBeep("error");
          triggerFlash("red");
          
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

        playBeep("success");
        triggerFlash("green");

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
        
        playBeep("error");
        triggerFlash("red");
        
        showError("Scan gagal", message);
        scheduleReset(INVALID_RESET_MS);
      }
    },
    [addLog, clearResetTimer, lookupSavings, phase, recordAttendance, scheduleReset, playBeep, triggerFlash]
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
      
      playBeep("success");
      triggerFlash("green");
      
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
      
      playBeep("error");
      triggerFlash("red");
      
      showError("Gagal mencatat setoran", message);
    }
  };

  const skipSavings = () => {
    if (!currentScan) return;
    setStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
    setFeedback(`${currentScan.displayName} tidak menabung.`);
    setPhase("feedback");
    
    playBeep("info");
    triggerFlash("blue");
    
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
    if (phase === "awaitingSavings") return "Tidak ada rekening tabungan, melanjutkan antrean...";
    if (phase === "saving") return "Mencatat setoran";
    if (phase === "feedback") return feedback || "Selesai";
    return "Siap scan QR / barcode siswa";
  }, [currentScan?.savingsAccount, feedback, phase]);

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 pb-8 sm:px-4 lg:px-6">
      
      {/* Sound & Flash visual effects container */}
      {flashColor && (
        <div 
          className={`absolute inset-0 z-50 pointer-events-none transition-all duration-300 rounded-xl ${
            flashColor === "green" 
              ? "bg-emerald-500/10 border-2 border-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.3)]" 
              : flashColor === "red" 
              ? "bg-rose-500/15 border-2 border-rose-500 shadow-[inset_0_0_20px_rgba(244,63,94,0.3)]" 
              : "bg-blue-500/10 border-2 border-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)]"
          }`}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="outline" size="icon" className="mt-1 border-slate-200 bg-white shadow-sm hover:bg-slate-50">
            <Link href={backHref} aria-label={`Kembali ke ${backLabel}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
              <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse">
                <QrCode className="h-3.5 w-3.5" />
                Sistem Scan Aktif
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {/* Real-time counters */}
        <div className={cn(
          "grid grid-cols-3 gap-2 sm:min-w-[360px] shadow-sm",
          variant === "tabungan" && "hidden md:grid"
        )}>
          <div className="rounded-lg border bg-white dark:bg-slate-900 px-3.5 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
              Presensi Hadir
            </div>
            <div className="text-xl font-bold font-mono mt-0.5">{stats.attendance}</div>
          </div>
          <div className="rounded-lg border bg-white dark:bg-slate-900 px-3.5 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <CircleDollarSign className="h-3.5 w-3.5 text-blue-500" />
              Setor Tabungan
            </div>
            <div className="text-xl font-bold font-mono mt-0.5">{stats.deposits}</div>
          </div>
          <div className="rounded-lg border bg-white dark:bg-slate-900 px-3.5 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Dilewati
            </div>
            <div className="text-xl font-bold font-mono mt-0.5">{stats.skipped}</div>
          </div>
        </div>
      </div>

      <Card className="rounded-lg border-slate-200/80 shadow-sm overflow-hidden bg-slate-50/30">
        <CardContent className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(320px,0.95fr)_minmax(360px,1.05fr)]">
          
          {/* Left Side: Scanner & Sesi */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className={cn(
              "flex flex-col gap-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-900 p-3 sm:flex-row sm:items-end shadow-sm",
              variant === "tabungan" && "hidden md:flex"
            )}>
              <div className="min-w-0 flex-1">
                <Label className="text-xs font-semibold text-slate-500">Sesi Presensi Aktif Hari Ini</Label>
                <Select
                  value={selectedSession || "auto"}
                  onValueChange={(value) => setSelectedSession(value === "auto" ? "" : value)}
                  disabled={loadingSessions}
                >
                  <SelectTrigger className="mt-1 w-full bg-slate-50/50 hover:bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Pilih sesi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Deteksi Otomatis dari Rombel Siswa</SelectItem>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        Kelas {session.className} - {session.date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto border-slate-200 hover:bg-slate-50">
                <Link href="/presensi/sesi/baru">Buat Sesi</Link>
              </Button>
            </div>

            {!loadingSessions && sessions.length === 0 && (
              <Alert className="border-amber-200 bg-amber-50/60 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <AlertTitle className="font-semibold">Sesi Presensi Belum Dibuka</AlertTitle>
                <AlertDescription className="text-xs">
                  Scan QR tetap bisa memproses setoran tabungan. Untuk mencatat kehadiran (hadir) secara otomatis, silakan buat/buka sesi presensi rombel kelas terlebih dahulu.
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 relative overflow-hidden">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  {phase === "ready" ? (
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                  ) : phase === "resolving" || phase === "saving" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  <span className="text-slate-200 font-medium">{statusCopy}</span>
                </div>
                
                {/* Mode Toggler */}
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                  <Button
                    type="button"
                    variant={scanMode === "camera" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 text-xs text-white hover:text-white"
                    onClick={() => setScanMode("camera")}
                  >
                    <Camera className="h-3.5 w-3.5 mr-1" />
                    Kamera
                  </Button>
                  <Button
                    type="button"
                    variant={scanMode === "manual" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 text-xs text-white hover:text-white"
                    onClick={() => setScanMode("manual")}
                  >
                    <Keyboard className="h-3.5 w-3.5 mr-1" />
                    Manual/Scanner
                  </Button>
                </div>
              </div>

              {scanMode === "camera" ? (
                <div className="relative overflow-hidden rounded-lg bg-black border border-white/5">
                  <QRScanner
                    active={scannerActive}
                    mirrored={false}
                    onScan={processQrCode}
                    onError={(message) => showError("Kamera bermasalah", message)}
                    className="mx-auto max-w-[500px]"
                  />
                  
                  {/* Visual guideline overlay */}
                  {scannerActive && (
                    <div className="absolute inset-0 border-[3px] border-emerald-500/20 rounded-lg pointer-events-none flex items-center justify-center">
                      <div className="w-[180px] h-[180px] border-2 border-dashed border-emerald-500/60 rounded-md relative">
                        <span className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-emerald-500" />
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-emerald-500" />
                        <span className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-emerald-500" />
                        <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-emerald-500" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="flex flex-col gap-3 rounded-lg bg-white p-4 dark:bg-zinc-900 shadow-inner">
                  <Label htmlFor="manual-qr" className="font-semibold text-slate-700">Scan Barcode / Input NISN Manual</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="manual-qr"
                      ref={manualInputRef}
                      value={manualCode}
                      onChange={(event) => setManualCode(event.target.value)}
                      placeholder="Letakkan kursor di sini & scan kartu siswa..."
                      disabled={phase === "resolving" || phase === "saving"}
                      className="border-slate-300 font-mono"
                    />
                    <Button type="submit" disabled={phase === "resolving" || phase === "saving" || !manualCode.trim()}>
                      Proses
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">
                    Tips: Barcode scanner eksternal bertindak sebagai keyboard input. Pastikan input teks di atas dalam kondisi fokus.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Right Side: Scan Results & Actions */}
          <div className={cn("flex min-w-0 flex-col gap-3", currentScan && "order-first lg:order-none")}>
            
            {/* Live Scan Result Area */}
            <Card className="rounded-lg border-slate-200/80 shadow-sm overflow-hidden bg-white">
              <CardHeader className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Users className="h-4 w-4 text-primary" />
                  Informasi Hasil Scan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                
                {/* 1. Empty State */}
                {!currentScan && phase !== "feedback" && (
                  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-center">
                    <QrCode className="mb-3 h-12 w-12 text-slate-400 animate-pulse" />
                    <p className="font-semibold text-slate-700 text-sm">Menunggu Hasil Scan Siswa</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                      Arahkan kartu QR siswa ke kamera atau input kode kartu untuk memulai pencatatan presensi & tabungan.
                    </p>
                  </div>
                )}

                {/* 2. Feedback Error state */}
                {phase === "feedback" && !currentScan && (
                  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50/30 p-6 text-center text-rose-800 dark:bg-rose-950/20 dark:text-rose-200">
                    <ShieldAlert className="mb-3 h-10 w-10 text-rose-500 animate-bounce" />
                    <p className="font-semibold text-sm">{feedback}</p>
                    <Button className="mt-4 border-rose-200 hover:bg-rose-100 text-rose-700" variant="outline" onClick={resetWorkbench}>
                      Scan Selanjutnya
                    </Button>
                  </div>
                )}

                {/* 3. Valid Scanned Student Information */}
                {currentScan && (
                  <div className="space-y-3.5">
                    <div className="rounded-lg border border-slate-150 bg-slate-50/40 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold px-1.5 py-0.5">
                              {currentScan.identity === "student" ? "Siswa Aktif" : "Penabung Eksternal"}
                            </Badge>
                            {currentScan.className && (
                              <Badge variant="outline" className="text-[10px] uppercase font-bold bg-white text-slate-700 px-1.5 py-0.5">
                                Rombel {currentScan.className}
                              </Badge>
                            )}
                          </div>
                          <h2 className="mt-2 text-xl font-bold leading-none text-slate-800">{currentScan.displayName}</h2>
                          <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">ID QR: {currentScan.qrCode}</p>
                        </div>
                        <Badge className={`font-semibold border text-xs px-2.5 py-0.5 ${attendanceBadgeClass(currentScan.attendance.status)}`}>
                          {currentScan.identity === "savings-only"
                            ? "Presensi Dilewati"
                            : currentScan.attendance.message}
                        </Badge>
                      </div>
                    </div>

                    {/* Savings Deposit Section */}
                    {currentScan.savingsAccount ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Setoran Tabungan</p>
                            <p className="text-sm font-semibold text-slate-700 font-mono mt-0.5">
                              Saldo Saat Ini: {formatRupiah(currentScan.savingsAccount.saldoTerakhir || 0)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-150">
                            <Banknote className="h-3.5 w-3.5" />
                            Transaksi Setor
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label htmlFor="nominal" className="text-xs font-semibold text-slate-600">
                              Input Nominal Setoran (Rp)
                            </Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-400 font-bold">Rp</span>
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
                                placeholder="0"
                                disabled={phase !== "awaitingSavings"}
                                className="h-11 pl-9 text-base font-bold font-mono border-slate-300 focus:ring-primary focus:border-primary"
                              />
                            </div>
                          </div>

                          {/* Quick Select Nominal Buttons with Keyboard Shortcuts */}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {QUICK_AMOUNTS.map((amount, idx) => (
                              <Button
                                key={amount}
                                type="button"
                                variant="outline"
                                className="h-9 text-xs font-semibold font-mono border-slate-200 hover:bg-slate-50 flex flex-col justify-center items-center py-1.5"
                                onClick={() => {
                                  setNominal(String(amount));
                                  playBeep("info");
                                }}
                                disabled={phase !== "awaitingSavings"}
                              >
                                <span>{formatRupiah(amount)}</span>
                                <span className="text-[9px] text-muted-foreground font-normal mt-0.5">(F{idx+1})</span>
                              </Button>
                            ))}
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="catatan" className="text-xs font-semibold text-slate-600">Catatan Tambahan</Label>
                            <Textarea
                              id="catatan"
                              value={catatan}
                              onChange={(event) => setCatatan(event.target.value)}
                              placeholder="Keterangan setoran jika diperlukan (opsional)..."
                              disabled={phase !== "awaitingSavings"}
                              className="min-h-16 text-xs border-slate-200"
                            />
                          </div>

                          {/* Actions buttons */}
                          <div className="grid gap-2 sm:grid-cols-3 border-t pt-3 dark:border-slate-800">
                            <Button
                              type="button"
                              className="sm:col-span-2 shadow-sm font-semibold h-10"
                              onClick={submitDeposit}
                              disabled={!canSubmitDeposit}
                            >
                              {phase === "saving" ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                              ) : (
                                <CircleDollarSign className="h-4 w-4 mr-1.5" />
                              )}
                              Setor Tabungan (Enter)
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold h-10 text-xs"
                              onClick={skipSavings}
                              disabled={phase !== "awaitingSavings"}
                            >
                              Lewati (Esc)
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Alert className="border-rose-100 bg-rose-50/20 text-rose-800">
                        <ShieldAlert className="h-4 w-4 text-rose-500" />
                        <AlertTitle className="font-semibold text-xs uppercase">Rekening Tabungan Belum Ada</AlertTitle>
                        <AlertDescription className="text-xs">
                          Kehadiran/presensi tetap diproses. Untuk mengaktifkan tabungan, silakan daftarkan rekening tabungan siswa ini terlebih dahulu.
                        </AlertDescription>
                        <div className="mt-3 flex gap-2">
                          <Button type="button" size="sm" onClick={skipSavings} className="bg-rose-600 hover:bg-rose-700 text-white border-0 text-xs font-semibold px-3 py-1">
                            Lanjut Scan (Esc)
                          </Button>
                          <Button asChild variant="outline" size="sm" className="bg-white border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1">
                            <Link href="/tabungan/siswa">Daftar Rekening</Link>
                          </Button>
                        </div>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scan History / Logs */}
            <Card className="rounded-lg border-slate-200/80 shadow-sm overflow-hidden bg-white">
              <CardHeader className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <RotateCcw className="h-4 w-4 text-primary" />
                  Riwayat Scan Sesi Ini (Maks. 5)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {scanLog.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-center text-muted-foreground italic">
                    Belum ada riwayat aktivitas scan pada sesi layar ini.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {scanLog.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/30 p-2.5 hover:bg-slate-50/60 transition-colors">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-700">{item.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{item.detail}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            item.tone === "success"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:text-emerald-300"
                              : item.tone === "warning"
                                ? "bg-amber-50 border-amber-200 text-amber-700 dark:text-amber-300"
                                : item.tone === "error"
                                  ? "bg-rose-50 border-rose-200 text-rose-700 dark:text-rose-300"
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                          }`}
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
        <p className="text-center text-xs text-muted-foreground border border-slate-200/50 bg-slate-50/30 p-2 rounded-lg">
          Catatan: Presensi dicatat ke rombel kelas <span className="font-semibold">{selectedSessionDetail.className}</span>. Jika siswa rombel lain di-scan, presensi tidak tercatat di sesi ini namun transaksi setoran tabungan tetap diproses bila rekeningnya aktif.
        </p>
      )}
    </div>
  );
}
