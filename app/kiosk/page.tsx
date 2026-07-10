"use client";
// Updated camera permissions logic and toggle - Force Rebuild


import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
    QrCode,
    BookOpen,
    User,
    CheckCircle,
    XCircle,
    RefreshCw,
    LogOut,
    Clock,
    Camera,
    CameraOff,
    LayoutDashboard,
    ClipboardCheck,
    Wallet,
    Banknote,
    ArrowUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { goPost } from "@/lib/api-client";
import { getDDCLabel } from "@/lib/library/ddc-mapping";
import type { LibraryMember, LibraryLoan } from "@/types/library";

// Dynamic import QR Scanner to prevent SSR issues
const Scanner = dynamic(
    () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
    { ssr: false }
);

// ==========================================
// API Helpers
// ==========================================

/**
 * Optimized scan endpoint - combines:
 * - smartScan (identify QR)
 * - hasVisitedToday + recordVisit (check/record visit)
 * - getMemberActiveLoans (get loans)
 * Performance: 4 API calls → 1 API call (60-70% faster)
 */
async function apiSmartScanComplete(code: string) {
    return goPost("/api/kiosk/scan-complete", { code }, { skipRetry: true });
}

async function apiBorrowBook(memberId: string, itemId: string) {
    return goPost("/api/kiosk/transaction", { type: "borrow", memberId, itemId }, { skipRetry: true });
}

async function apiReturnBook(loanId: string) {
    return goPost("/api/kiosk/transaction", { type: "return", loanId }, { skipRetry: true });
}

async function apiFindLoanByItemId(itemId: string) {
    return goPost("/api/kiosk/scan", { code: itemId, type: "find-loan" }, { skipRetry: true });
}

// ==========================================
// Attendance & Savings API Helpers
// ==========================================

async function apiAttendanceScan(qrCode: string) {
    return goPost("/api/public/kiosk/attendance", { qrCode }, { skipRetry: true });
}

async function apiSavingsLookup(qrCode: string) {
    const { goGet } = await import("@/lib/api-client");
    return goGet(`/api/public/kiosk/savings-lookup?qrCode=${encodeURIComponent(qrCode)}`, { skipRetry: true });
}

async function apiSavingsDeposit(qrCode: string, nominal: number) {
    return goPost("/api/public/kiosk/savings-deposit", { qrCode, nominal }, { skipRetry: true });
}

// ==========================================
// Types
// ==========================================



type KioskState =
    | { type: "idle" }
    | { type: "scanning" }
    | { type: "welcome"; member: LibraryMember; isFirstVisit: boolean }
    | { type: "borrow_mode"; member: LibraryMember; loans: LibraryLoan[] }
    | { type: "processing_borrow" }
    | { type: "success"; message: string; details?: string; subDetails?: string }
    | { type: "error"; message: string };

// ==========================================
// Constants
// ==========================================

const SESSION_TIMEOUT = 10000; // 10 seconds
const WELCOME_TIMEOUT = 3000; // 3 seconds for welcome screen
const SUCCESS_TIMEOUT = 5000; // 5 seconds for success screen
const SCAN_COOLDOWN = 3000; // 3 seconds between any scans
const SAME_CODE_BLOCK_MS = 3000; // 3 seconds block for same QR code

// ==========================================
// Main Component
// ==========================================

type KioskMode = "library" | "attendance";

type AttendanceState =
    | { type: "idle" }
    | { type: "scanning" }
    | { type: "recorded"; student: any; balance: number; hasSavings: boolean }
    | { type: "processing_deposit" }
    | { type: "success"; message: string }
    | { type: "error"; message: string };

export default function KioskPage() {
    const [mode, setMode] = useState<KioskMode>("library");
    const [state, setState] = useState<KioskState>({ type: "idle" });
    const [attState, setAttState] = useState<AttendanceState>({ type: "idle" });
    const [attNominal, setAttNominal] = useState(0);
    const [attCountdown, setAttCountdown] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
    const [lastScanTime, setLastScanTime] = useState(0);
    const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
    const [lastCodeScanTime, setLastCodeScanTime] = useState(0);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isSecure] = useState(() => (typeof window === "undefined" ? true : window.isSecureContext));
    
    const sessionTimer = useRef<NodeJS.Timeout | null>(null);
    const countdownInterval = useRef<NodeJS.Timeout | null>(null);

    // ==========================================
    // Timer Management
    // ==========================================
    
    const clearTimers = useCallback(() => {
        if (sessionTimer.current) clearTimeout(sessionTimer.current);
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        setCountdown(0);
    }, []);

    const startSessionTimer = useCallback((duration = SESSION_TIMEOUT) => {
        clearTimers();
        setCountdown(Math.floor(duration / 1000));
        
        countdownInterval.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearTimers();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        sessionTimer.current = setTimeout(() => {
            clearTimers();
            setState({ type: "idle" });
        }, duration);
    }, [clearTimers]);

    useEffect(() => {
        return () => clearTimers();
    }, [clearTimers]);

    // ==========================================
    // Welcome Screen Auto-Return
    // ==========================================
    
    useEffect(() => {
        if (state.type === "welcome" && state.isFirstVisit) {
            const timer = setTimeout(() => {
                setState({ type: "idle" });
            }, WELCOME_TIMEOUT);
            return () => clearTimeout(timer);
        }
    }, [state]);

    // ==========================================
    // Success Screen Auto-Return
    // ==========================================
    
    useEffect(() => {
        if (state.type === "success") {
            const timer = setTimeout(() => {
                setState({ type: "idle" });
            }, SUCCESS_TIMEOUT);
            return () => clearTimeout(timer);
        }
    }, [state]);

    // ==========================================
    // Audio Feedback
    // ==========================================
    
    const playSound = (type: "success" | "error" | "beep") => {
        try {
            const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = type === "success" ? 800 : type === "error" ? 300 : 600;
            oscillator.type = "sine";
            gainNode.gain.value = 0.2;

            oscillator.start();
            oscillator.stop(audioContext.currentTime + (type === "success" ? 0.15 : type === "error" ? 0.3 : 0.1));
        } catch {
            // Audio not supported
        }
    };

    // ==========================================
    // Camera Error Handler
    // ==========================================

    const handleScanError = useCallback((error: unknown) => {
        console.error("Scanner error:", error);
        if (error instanceof Error) {
            // Permission denied (Actionable)
            if (error.name === "NotAllowedError" || error.message.includes("permission")) {
                 setCameraError("AKSES KAMERA DIBLOKIR. Klik icon gembok 🔒 di address bar. Jika testing di Laptop, coba ganti ke kamera depan (icon putar).");
            } 
            // Device not found (Actionable) - Often happens when requesting 'environment' on laptop
            else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError" || error.name === "OverconstrainedError") {
                 setCameraError("Kamera belakang tidak ditemukan. Coba ganti ke kamera depan (icon putar) ->");
            }
            // Other known errors
            else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
                 setCameraError("Kamera sedang digunakan oleh aplikasi lain atau OS memblokir akses.");
            }
            // Generic fallback
            else {
                 setCameraError(`Gagal mengakses kamera: ${error.message}`);
            }
        } else {
             setCameraError("Gagal mengakses kamera (Unknown Error).");
        }
    }, []);

    // ==========================================
    // Main Scan Handler
    // ==========================================
    
    const handleAttendanceScan = async (code: string) => {
        if (attState.type === "scanning" || attState.type === "processing_deposit") return;

        const now = Date.now();
        if (now - lastScanTime < SCAN_COOLDOWN) return;
        setLastScanTime(now);
        setLastScannedCode(code);
        setLastCodeScanTime(now);

        setAttState({ type: "scanning" });
        playSound("beep");

        try {
            const attResult = await apiAttendanceScan(code);

            // Try to lookup savings account (non-critical, may fail)
            let balance = 0;
            let hasSavings = false;
            try {
                const savResult = await apiSavingsLookup(code);
                if (savResult?.success && savResult?.data?.length > 0) {
                    balance = savResult.data[0].saldo_terakhir || 0;
                    hasSavings = true;
                }
            } catch { /* savings not found - OK */ }

            if (attResult.success) {
                setAttState({ type: "recorded", student: attResult.student, balance, hasSavings });
                setAttNominal(0);
                playSound("success");
            } else {
                setAttState({ type: "error", message: attResult.error || "Gagal merekam presensi" });
                playSound("error");
                setTimeout(() => setAttState({ type: "idle" }), 3000);
            }
        } catch {
            setAttState({ type: "error", message: "Koneksi gagal" });
            playSound("error");
            setTimeout(() => setAttState({ type: "idle" }), 3000);
        }
    };

    const handleDeposit = async () => {
        if (attState.type !== "recorded" || attNominal < 1000) return;
        const code = lastScannedCode;
        if (!code) return;

        setAttState(prev => ({ ...prev, type: "processing_deposit" }));
        try {
            await apiSavingsDeposit(code, attNominal);
            setAttState({ type: "success", message: `Setoran Rp${attNominal.toLocaleString("id-ID")} berhasil!` });
            playSound("success");
            setTimeout(() => setAttState({ type: "idle" }), 4000);
        } catch {
            setAttState({ type: "error", message: "Gagal mencatat setoran" });
            playSound("error");
            setTimeout(() => setAttState({ type: "idle" }), 3000);
        }
    };

    const handleScan = async (code: string) => {
        if (mode === "attendance") {
            handleAttendanceScan(code);
            return;
        }

        // Block scanning during certain states
        if (state.type === "scanning" || state.type === "welcome" || state.type === "processing_borrow" || state.type === "success") {
            return;
        }

        // General cooldown check (between any scans)
        const now = Date.now();
        if (now - lastScanTime < SCAN_COOLDOWN) return;

        // Same QR code blocking - if same code scanned within SAME_CODE_BLOCK_MS, ignore
        if (lastScannedCode === code && (now - lastCodeScanTime) < SAME_CODE_BLOCK_MS) {
            return;
        }

        // Update timestamps
        setLastScanTime(now);
        setLastScannedCode(code);
        setLastCodeScanTime(now);

        if (!code.trim()) return;

        setState({ type: "scanning" });
        playSound("beep");

        try {
            // Use optimized single API call (replaces 4 sequential calls)
            const result = await apiSmartScanComplete(code);

            if (result.type === "error") {
                setState({ type: "error", message: result.message });
                playSound("error");
                startSessionTimer(5000);
                return;
            }

            // ==========================================
            // MEMBER/STUDENT SCAN LOGIC
            // ==========================================
            if (result.type === "member" || result.type === "student") {
                const member = result.data;
                const { visitStatus, activeLoans } = result;

                // Check if another user is logged in - force logout
                if (state.type === "borrow_mode" && state.member.id !== member.id) {
                    clearTimers();
                }

                // Visit and loans data are already included from optimized API
                if (visitStatus.isFirstVisit) {
                    // FIRST VISIT TODAY - Check-in only, stay standby
                    setState({ type: "welcome", member, isFirstVisit: true });
                    playSound("success");
                } else {
                    // ALREADY VISITED - Open borrow mode
                    setState({ type: "borrow_mode", member, loans: activeLoans });
                    playSound("success");
                    startSessionTimer();
                }
                return;
            }

            // ==========================================
            // BOOK SCAN LOGIC
            // ==========================================
            if (result.type === "item") {
                const item = result.data;

                // -----------------------------------
                // SCENARIO 1: BORROW MODE (User Logged In)
                // -----------------------------------
                // -----------------------------------
                // SCENARIO 1: BORROW MODE (User Logged In)
                // -----------------------------------
                if (state.type === "borrow_mode") {
                    const { member, loans } = state;

                    // Check if this is user's own borrowed book - return it
                    const ownLoan = loans.find(l => l.itemId === item.id && !l.isReturned);
                    if (ownLoan) {
                        await apiReturnBook(ownLoan.id);
                        setState({
                            type: "success",
                            message: "Buku Dikembalikan!",
                            details: item.title,
                        });
                        playSound("success");
                        return;
                    }

                    // Check if book is borrowed by someone else
                    if (item.status === "BORROWED") {
                        setState({ type: "error", message: "Buku sedang dipinjam orang lain" });
                        playSound("error");
                        startSessionTimer();
                        return;
                    }

                    // Check borrow limit
                    const totalItems = loans.length;
                    if (totalItems >= member.maxBorrowLimit) {
                        setState({
                            type: "error",
                            message: `Batas pinjam tercapai (${member.maxBorrowLimit} buku)`,
                        });
                        playSound("error");
                        startSessionTimer();
                        return;
                    }

                    // INSTANT BORROW LOGIC
                    setState({ type: "processing_borrow" });
                    try {
                        await apiBorrowBook(member.id, item.id);
                        setState({
                            type: "success",
                            message: "Peminjaman Berhasil!",
                            details: item.title,
                            subDetails: `Peminjam: ${member.name}`,
                        });
                        playSound("success");
                        // Auto-reset handled by success state useEffect
                    } catch (error) {
                         console.error("Borrow error:", error);
                         setState({ type: "error", message: "Gagal memproses peminjaman" });
                         playSound("error");
                    }
                    return;
                }

                // -----------------------------------
                // SCENARIO 2: STANDBY MODE (No User) - RETURN
                // -----------------------------------
                if (state.type === "idle" || state.type === "error") {
                    if (item.status === "BORROWED") {
                        const loan = await apiFindLoanByItemId(item.id);
                        if (loan) {
                            await apiReturnBook(loan.id);
                            const memberName = loan.member?.name || "Anggota";
                            setState({
                                type: "success",
                                message: "Buku Dikembalikan!",
                                details: item.title,
                                subDetails: `Peminjam: ${memberName}`,
                            });
                            playSound("success");
                        } else {
                            setState({ type: "error", message: "Data peminjaman tidak ditemukan" });
                            playSound("error");
                        }
                    } else {
                        // SHELF GUIDE LOGIC: Show where the book should be placed
                        const categoryLabel = getDDCLabel(item.category || "UNSORTED");
                        setState({
                            type: "success",
                            message: "Informasi Rak Buku",
                            details: item.title,
                            subDetails: `Kategori: ${categoryLabel} | Lokasi: ${item.location || "-"}`,
                        });
                        playSound("success");
                    }
                    startSessionTimer(5000);
                    return;
                }
            }
        } catch (error) {
            console.error("Scan error:", error);
            setState({ type: "error", message: "Terjadi kesalahan sistem" });
            playSound("error");
            startSessionTimer(5000);
        }
    };

    // ==========================================
    // Finalize Borrow (Process Cart)
    // ==========================================
    
    // Finalize and Remove Cart functions removed for Instant Borrow mode

    // ==========================================
    // Reset to Idle
    // ==========================================
    
    const reset = () => {
        clearTimers();
        setState({ type: "idle" });
    };

    // ==========================================
    // QR Scanner Handler
    // ==========================================

    const onScanResult = (result: { rawValue: string }[]) => {
        if (result && result.length > 0) {
            handleScan(result[0].rawValue);
        }
    };

    // ==========================================
    // Render
    // ==========================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
            {/* Header */}
            <header className="p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white leading-none">SmartLib</h1>
                        <p className="text-blue-200 text-[10px] sm:text-xs mt-1">Self-Service Kiosk</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCameraFacing(prev => prev === "environment" ? "user" : "environment")}
                        className="text-blue-200 hover:bg-white/5 h-8 px-2 sm:h-9 sm:px-3 text-xs"
                        title="Ganti Kamera (Depan/Belakang)"
                    >
                        <RefreshCw className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Ganti Kamera</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCameraEnabled(!cameraEnabled)}
                        className="text-blue-200 hover:bg-white/5 h-8 px-2 sm:h-9 sm:px-3 text-xs"
                    >
                        {cameraEnabled ? <Camera className="h-4 w-4 sm:mr-1" /> : <CameraOff className="h-4 w-4 sm:mr-1" />}
                        <span className="hidden sm:inline">{cameraEnabled ? "Matikan Kamera" : "Aktifkan Kamera"}</span>
                    </Button>
                    <Link href="/overview">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-200 hover:text-white hover:bg-white/10 h-8 px-2 sm:h-9 sm:px-3 text-xs"
                            title="Kembali ke Admin Panel"
                        >
                            <LayoutDashboard className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Admin</span>
                        </Button>
                    </Link>
                    <div className="text-center sm:text-right pl-2 border-l border-white/10">
                        <div className="text-blue-200 text-[10px] sm:text-xs">
                            <Clock className="inline h-3 w-3 mr-1" />
                            {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                        </div>
                        {countdown > 0 && (
                            <div className="text-yellow-400 text-[10px] sm:text-xs font-bold">Sesi: {countdown}s</div>
                        )}
                    </div>
                </div>
            </header>


            {/* Main Content */}
            <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
                {/* Camera Scanner */}
                <div className="lg:w-1/2">
                    <Card className="bg-white/10 backdrop-blur border-white/20 h-full">
                        <CardContent className="p-4 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-2">
                                <QrCode className="h-4 w-4 text-blue-400" />
                                <span className="text-white text-sm font-medium">Scanner</span>
                            </div>
                            <div className="flex-1 relative rounded-lg overflow-hidden bg-black/50 min-h-[300px]">
                                {!isSecure ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-blue-300 bg-slate-900/90 z-20">
                                        <div className="text-center p-6 max-w-sm">
                                            <div className="h-12 w-12 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                                                <XCircle className="h-6 w-6 text-red-500" />
                                            </div>
                                            <p className="font-bold text-white mb-2">Koneksi Tidak Aman</p>
                                            <p className="text-sm mb-4 text-blue-200">
                                                Kamera tidak dapat diakses melalui koneksi HTTP biasa.
                                            </p>
                                            <p className="text-xs text-blue-300/70 bg-black/30 p-2 rounded">
                                                Gunakan <strong>HTTPS</strong> atau <strong>localhost</strong>
                                            </p>
                                        </div>
                                    </div>
                                ) : cameraEnabled && !cameraError ? (
                                    <Scanner
                                        onScan={onScanResult}
                                        onError={handleScanError}
                                        constraints={{ facingMode: cameraFacing }}
                                        styles={{
                                            container: { width: "100%", height: "100%" },
                                            video: { 
                                                width: "100%", 
                                                height: "100%", 
                                                objectFit: "cover",
                                                transform: "scaleX(-1)"
                                            },
                                        }}
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-blue-300 bg-slate-900/80">
                                        <div className="text-center p-6 max-w-sm">
                                            <CameraOff className="h-12 w-12 mx-auto mb-4 opacity-50 text-red-400" />
                                            <p className="font-medium text-white mb-2">Kamera Tidak Aktif</p>
                                            <p className="text-sm mb-6 text-blue-200">
                                                {cameraError || "Kamera dimatikan secara manual."}
                                            </p>
                                            <Button 
                                                variant="outline"
                                                className="border-blue-400/50 text-blue-300 hover:bg-blue-900/50 hover:text-white"
                                                onClick={() => {
                                                    setCameraError(null);
                                                    setCameraEnabled(false);
                                                    setTimeout(() => setCameraEnabled(true), 500);
                                                }}
                                            >
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                                Coba Lagi
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <p className="text-blue-200 text-xs text-center mt-2">
                                Arahkan QR code ke kamera
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Status Panel */}
                <div className="lg:w-1/2">
                    {/* ===== ATTENDANCE MODE STATES ===== */}
                    {mode === "attendance" && (
                        <>
                            {attState.type === "idle" && (
                                <Card className="bg-white/10 backdrop-blur border-white/20 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 animate-pulse">
                                            <ClipboardCheck className="h-10 w-10 text-emerald-400" />
                                        </div>
                                        <h2 className="text-xl font-bold text-white mb-1">Siap Scan</h2>
                                        <p className="text-emerald-200 text-sm text-center">
                                            Scan QR siswa untuk presensi dan tabungan
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {attState.type === "scanning" && (
                                <Card className="bg-white/10 backdrop-blur border-white/20 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <RefreshCw className="h-12 w-12 text-emerald-400 animate-spin mb-4" />
                                        <h2 className="text-lg font-bold text-white">Memproses...</h2>
                                    </CardContent>
                                </Card>
                            )}

                            {attState.type === "recorded" && (
                                <div className="space-y-4">
                                    <Card className="bg-emerald-500/20 backdrop-blur border-emerald-400/50">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                                    <User className="h-5 w-5 text-emerald-400" />
                                                </div>
                                                <div>
                                                    <Badge className="bg-emerald-500 text-white mb-1">Presensi Tercatat</Badge>
                                                    <p className="text-white font-bold text-sm">{attState.student?.full_name || attState.student?.name || "Siswa"}</p>
                                                    <p className="text-emerald-200 text-xs">{attState.student?.class_name || attState.student?.className || ""}</p>
                                                </div>
                                            </div>
                                            {attState.hasSavings && (
                                                <div className="bg-white/5 rounded-lg p-3">
                                                    <p className="text-emerald-200 text-xs mb-1">Saldo Tabungan</p>
                                                    <p className="text-white font-bold text-lg">Rp {attState.balance.toLocaleString("id-ID")}</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {attState.hasSavings && (
                                        <Card className="bg-white/10 backdrop-blur border-white/20">
                                            <CardContent className="p-4">
                                                <h3 className="text-white font-medium text-sm mb-3">Setor Tabungan</h3>
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    {[2000, 5000, 10000, 20000].map((amount) => (
                                                        <button
                                                            key={amount}
                                                            onClick={() => setAttNominal(amount)}
                                                            className={`py-2 rounded-lg text-sm font-medium transition-colors ${attNominal === amount ? "bg-emerald-500 text-white" : "bg-white/10 text-emerald-200 hover:bg-white/20"}`}
                                                        >
                                                            Rp{amount.toLocaleString("id-ID")}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2 mb-3">
                                                    <input
                                                        type="number"
                                                        value={attNominal || ""}
                                                        onChange={(e) => setAttNominal(parseInt(e.target.value) || 0)}
                                                        placeholder="Nominal lain..."
                                                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-blue-300/50"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={handleDeposit}
                                                        disabled={attNominal < 1000}
                                                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                                                    >
                                                        <Banknote className="h-4 w-4 mr-2" />
                                                        Setor Rp{attNominal.toLocaleString("id-ID")}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setAttState({ type: "idle" })}
                                                        className="border-white/20 text-white"
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {!attState.hasSavings && (
                                        <Card className="bg-white/10 backdrop-blur border-white/20">
                                            <CardContent className="p-4 text-center">
                                                <p className="text-blue-200 text-sm mb-2">Tidak memiliki rekening tabungan</p>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setAttState({ type: "idle" })}
                                                    className="border-white/20 text-white text-xs"
                                                >
                                                    <RefreshCw className="h-3 w-3 mr-1" />
                                                    Scan Lagi
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}

                            {attState.type === "processing_deposit" && (
                                <Card className="bg-white/10 backdrop-blur border-white/20 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <RefreshCw className="h-12 w-12 text-emerald-400 animate-spin mb-4" />
                                        <h2 className="text-lg font-bold text-white">Menyimpan Setoran...</h2>
                                    </CardContent>
                                </Card>
                            )}

                            {attState.type === "success" && (
                                <Card className="bg-emerald-500/20 backdrop-blur border-emerald-400 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center mb-4">
                                            <CheckCircle className="h-8 w-8 text-white" />
                                        </div>
                                        <h2 className="text-xl font-bold text-emerald-400 mb-1">{attState.message}</h2>
                                        <Button className="mt-4 bg-emerald-500 hover:bg-emerald-600" size="sm" onClick={() => setAttState({ type: "idle" })}>
                                            <RefreshCw className="h-3 w-3 mr-1" /> Scan Lagi
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {attState.type === "error" && (
                                <Card className="bg-red-500/20 backdrop-blur border-red-400 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <div className="h-16 w-16 rounded-full bg-red-500 flex items-center justify-center mb-4">
                                            <XCircle className="h-8 w-8 text-white" />
                                        </div>
                                        <h2 className="text-lg font-bold text-red-400 mb-1">{attState.message}</h2>
                                        <Button className="mt-4 bg-red-500 hover:bg-red-600" size="sm" onClick={() => setAttState({ type: "idle" })}>
                                            <RefreshCw className="h-3 w-3 mr-1" /> Coba Lagi
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}

                    {/* ===== LIBRARY MODE STATES ===== */}
                    {mode === "library" && state.type === "idle" && (
                        <Card className="bg-white/10 backdrop-blur border-white/20 h-full">
                            <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                <div className="h-20 w-20 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 animate-pulse">
                                    <QrCode className="h-10 w-10 text-blue-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-1">Siap Scan</h2>
                                <p className="text-blue-200 text-sm text-center">
                                    Scan kartu anggota untuk pinjam, atau scan buku untuk kembalikan
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {mode === "library" && (
                        <>
                            {/* SCANNING STATE */}
                            {state.type === "scanning" && (
                                <Card className="bg-white/10 backdrop-blur border-white/20 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <RefreshCw className="h-12 w-12 text-blue-400 animate-spin mb-4" />
                                        <h2 className="text-lg font-bold text-white">Memproses...</h2>
                                    </CardContent>
                                </Card>
                            )}

                            {/* WELCOME STATE (First Visit Today) */}
                            {state.type === "welcome" && (
                                <Card className="bg-white/10 backdrop-blur border-green-400/50 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                            <User className="h-8 w-8 text-green-400" />
                                        </div>
                                        <Badge className="bg-green-500 text-white mb-2">Kunjungan Tercatat</Badge>
                                        <h2 className="text-lg font-bold text-white">Selamat Datang!</h2>
                                        <p className="text-xl font-bold text-green-400">{state.member.name}</p>
                                        {state.member.className && (
                                            <Badge className="bg-green-500/20 text-green-300 mt-2">
                                                Kelas {state.member.className}
                                            </Badge>
                                        )}
                                        <p className="text-blue-200 mt-4 text-xs">Scan kartu lagi untuk meminjam buku</p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* BORROW MODE */}
                            {state.type === "borrow_mode" && (
                                <div className="space-y-4">
                                    <Card className="bg-white/10 backdrop-blur border-blue-400/50">
                                        <CardContent className="p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                    <User className="h-5 w-5 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold text-sm">{state.member.name}</p>
                                                    <p className="text-blue-200 text-xs">
                                                        Pinjaman: {state.loans.length} / {state.member.maxBorrowLimit}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge className="bg-blue-500 text-white text-xs">Mode Pinjam</Badge>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-white/10 backdrop-blur border-white/20">
                                        <CardContent className="p-6 text-center">
                                            <div className="h-16 w-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                                                <BookOpen className="h-8 w-8 text-blue-400" />
                                            </div>
                                            <h3 className="text-lg font-bold text-white mb-2">Siap Meminjam</h3>
                                            <p className="text-blue-200 text-sm mb-6">
                                                Scan kode QR buku untuk langsung meminjam.
                                            </p>
                                            <Button variant="outline" size="sm" className="border-white/20 text-white text-xs hover:bg-white/10" onClick={reset}>
                                                <LogOut className="h-4 w-4 mr-2" />
                                                Selesai / Ganti Orang
                                            </Button>
                                        </CardContent>
                                    </Card>

                                    {state.loans.length > 0 && (
                                        <Card className="bg-white/5 backdrop-blur border-white/10">
                                            <CardContent className="p-3">
                                                <p className="text-blue-200 text-xs mb-2">Pinjaman aktif (scan untuk kembalikan):</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {state.loans.slice(0, 4).map((loan) => (
                                                        <Badge key={loan.id} variant="outline" className="text-blue-300 border-blue-400/30 text-xs">
                                                            {loan.item?.title || "Buku"}
                                                        </Badge>
                                                    ))}
                                                    {state.loans.length > 4 && (
                                                        <Badge variant="outline" className="text-blue-300 text-xs">+{state.loans.length - 4}</Badge>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}

                            {/* PROCESSING BORROW */}
                            {state.type === "processing_borrow" && (
                                <Card className="bg-white/10 backdrop-blur border-white/20 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <RefreshCw className="h-12 w-12 text-blue-400 animate-spin mb-4" />
                                        <h2 className="text-lg font-bold text-white">Memproses Peminjaman...</h2>
                                    </CardContent>
                                </Card>
                            )}

                            {/* SUCCESS STATE */}
                            {state.type === "success" && (
                                <Card className="bg-green-500/20 backdrop-blur border-green-400 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center mb-4">
                                            <CheckCircle className="h-8 w-8 text-white" />
                                        </div>
                                        <h2 className="text-xl font-bold text-green-400 mb-1">{state.message}</h2>
                                        {state.details && <p className="text-white text-center text-sm">{state.details}</p>}
                                        {state.subDetails && <p className="text-green-200 text-xs">{state.subDetails}</p>}
                                        <Button className="mt-4 bg-green-500 hover:bg-green-600" size="sm" onClick={reset}>
                                            <RefreshCw className="h-3 w-3 mr-1" /> Transaksi Baru
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {/* ERROR STATE */}
                            {state.type === "error" && (
                                <Card className="bg-red-500/20 backdrop-blur border-red-400 h-full">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                                        <div className="h-16 w-16 rounded-full bg-red-500 flex items-center justify-center mb-4">
                                            <XCircle className="h-8 w-8 text-white" />
                                        </div>
                                        <h2 className="text-lg font-bold text-red-400 mb-1">{state.message}</h2>
                                        <Button className="mt-4 bg-red-500 hover:bg-red-600" size="sm" onClick={reset}>
                                            <RefreshCw className="h-3 w-3 mr-1" /> Coba Lagi
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="p-2 text-center text-blue-300/50 text-xs">
                {mode === "library" ? "SmartLib Kiosk" : "Presensi & Tabungan Kiosk"} • Powered by Sekolahku
            </footer>
        </div>
    );
}

