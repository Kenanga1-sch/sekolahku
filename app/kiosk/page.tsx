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
    ShoppingCart,
    Trash2,
    BookCheck,
    Camera,
    CameraOff,
    LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LibraryMember, LibraryItem, LibraryLoan } from "@/types/library";

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
    const res = await fetch("/api/kiosk/scan-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
    });
    return res.json();
}

// Legacy API (kept for book scans in borrow mode)
async function apiSmartScan(code: string) {
    const res = await fetch("/api/kiosk/scan", {
        method: "POST",
        body: JSON.stringify({ code, type: "scan" }),
    });
    return res.json();
}

async function apiBorrowBook(memberId: string, itemId: string) {
    const res = await fetch("/api/kiosk/transaction", {
        method: "POST",
        body: JSON.stringify({ type: "borrow", memberId, itemId }),
    });
    if (!res.ok) throw new Error("Failed to borrow");
    return res.json();
}

async function apiReturnBook(loanId: string) {
    const res = await fetch("/api/kiosk/transaction", {
        method: "POST",
        body: JSON.stringify({ type: "return", loanId }),
    });
    if (!res.ok) throw new Error("Failed to return");
    return res.json();
}

async function apiFindLoanByItemId(itemId: string) {
    const res = await fetch("/api/kiosk/scan", {
        method: "POST",
        body: JSON.stringify({ code: itemId, type: "find-loan" }),
    });
    return res.json();
}

// ==========================================
// Types
// ==========================================

interface CartItem {
    item: LibraryItem;
    addedAt: Date;
}

type KioskState =
    | { type: "idle" }
    | { type: "scanning" }
    | { type: "welcome"; member: LibraryMember; isFirstVisit: boolean }
    | { type: "borrow_mode"; member: LibraryMember; loans: LibraryLoan[]; cart: CartItem[] }
    | { type: "processing_borrow" }
    | { type: "success"; message: string; details?: string; subDetails?: string }
    | { type: "error"; message: string };

// ==========================================
// Constants
// ==========================================

const SESSION_TIMEOUT = 30000; // 30 seconds
const WELCOME_TIMEOUT = 3000; // 3 seconds for welcome screen
const SUCCESS_TIMEOUT = 5000; // 5 seconds for success screen
const SCAN_COOLDOWN = 3000; // 3 seconds between any scans
const SAME_CODE_BLOCK_MS = 15000; // 15 seconds block for same QR code

// ==========================================
// Main Component
// ==========================================

export default function KioskPage() {
    const [state, setState] = useState<KioskState>({ type: "idle" });
    const [countdown, setCountdown] = useState(0);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
    const [lastScanTime, setLastScanTime] = useState(0);
    const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
    const [lastCodeScanTime, setLastCodeScanTime] = useState(0);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isSecure, setIsSecure] = useState(true);
    
    const sessionTimer = useRef<NodeJS.Timeout | null>(null);
    const countdownInterval = useRef<NodeJS.Timeout | null>(null);

    // Check for Secure Context on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            setIsSecure(window.isSecureContext);
        }
    }, []);

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

    const resetSessionTimer = useCallback(() => {
        startSessionTimer();
    }, [startSessionTimer]);

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
    
    const handleScan = async (code: string) => {
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
                    setState({ type: "borrow_mode", member, loans: activeLoans, cart: [] });
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
                if (state.type === "borrow_mode") {
                    const { member, loans, cart } = state;

                    // Check if item is already in cart
                    if (cart.some(c => c.item.id === item.id)) {
                        setState({ type: "error", message: "Buku sudah ada di keranjang" });
                        playSound("error");
                        startSessionTimer();
                        return;
                    }

                    // Check if this is user's own borrowed book - return it
                    // 'loans' are LibraryLoan objects. using 'item' relation or 'itemId'.
                    // LibraryLoan objects from getMemberActiveLoans have 'itemId'.
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
                    const totalItems = loans.length + cart.length;
                    if (totalItems >= member.maxBorrowLimit) {
                        setState({
                            type: "error",
                            message: `Batas pinjam tercapai (${member.maxBorrowLimit} buku)`,
                        });
                        playSound("error");
                        startSessionTimer();
                        return;
                    }

                    // Add to cart
                    const newCart = [...cart, { item, addedAt: new Date() }];
                    setState({ ...state, cart: newCart });
                    playSound("success");
                    resetSessionTimer();
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
                        setState({
                            type: "error",
                            message: "Buku tersedia. Scan kartu anggota untuk meminjam.",
                        });
                        playSound("error");
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
    
    const finalizeBorrow = async () => {
        if (state.type !== "borrow_mode" || state.cart.length === 0) return;

        setState({ type: "processing_borrow" });
        const { member, cart } = state;

        try {
            const borrowedTitles: string[] = [];
            for (const cartItem of cart) {
                await apiBorrowBook(member.id, cartItem.item.id);
                borrowedTitles.push(cartItem.item.title);
            }

            setState({
                type: "success",
                message: `${cart.length} Buku Dipinjam!`,
                details: borrowedTitles.join(", "),
                subDetails: `Peminjam: ${member.name}`,
            });
            playSound("success");
            clearTimers();
        } catch (error) {
            console.error("Borrow error:", error);
            setState({ type: "error", message: "Gagal memproses peminjaman" });
            playSound("error");
        }
    };

    // ==========================================
    // Remove from Cart
    // ==========================================
    
    const removeFromCart = (itemId: string) => {
        if (state.type !== "borrow_mode") return;
        const newCart = state.cart.filter(c => c.item.id !== itemId);
        setState({ ...state, cart: newCart });
        resetSessionTimer();
    };

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
            <header className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">SmartLib</h1>
                        <p className="text-blue-200 text-xs">Self-Service Kiosk</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCameraFacing(prev => prev === "environment" ? "user" : "environment")}
                        className="text-blue-200"
                        title="Ganti Kamera (Depan/Belakang)"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCameraEnabled(!cameraEnabled)}
                        className="text-blue-200"
                    >
                        {cameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                    </Button>
                    <Link href="/overview">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-200 hover:text-white hover:bg-white/10"
                            title="Kembali ke Admin Panel"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="text-right">
                        <div className="text-blue-200 text-xs">
                            <Clock className="inline h-3 w-3 mr-1" />
                            {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                        </div>
                        {countdown > 0 && (
                            <div className="text-yellow-400 text-xs">Sesi: {countdown}s</div>
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
                    {/* IDLE STATE */}
                    {state.type === "idle" && (
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
                            {/* User Info */}
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

                            {/* Cart */}
                            <Card className="bg-white/10 backdrop-blur border-white/20">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ShoppingCart className="h-4 w-4 text-blue-400" />
                                        <span className="text-white font-medium text-sm">
                                            Keranjang ({state.cart.length})
                                        </span>
                                    </div>

                                    {state.cart.length === 0 ? (
                                        <div className="text-center py-6 text-blue-200 text-sm">
                                            <QrCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>Scan buku untuk menambahkan</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto">
                                            {state.cart.map((cartItem) => (
                                                <div
                                                    key={cartItem.item.id}
                                                    className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <BookOpen className="h-4 w-4 text-blue-400 flex-shrink-0" />
                                                        <p className="text-white text-xs truncate">{cartItem.item.title}</p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                                                        onClick={() => removeFromCart(cartItem.item.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-white/20 text-white text-xs"
                                            onClick={reset}
                                        >
                                            <LogOut className="h-3 w-3 mr-1" />
                                            Batal
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="flex-1 bg-green-500 hover:bg-green-600 text-xs"
                                            onClick={finalizeBorrow}
                                            disabled={state.cart.length === 0}
                                        >
                                            <BookCheck className="h-3 w-3 mr-1" />
                                            Pinjam ({state.cart.length})
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Active Loans */}
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
                </div>
            </main>

            {/* Footer */}
            <footer className="p-2 text-center text-blue-300/50 text-xs">
                SmartLib Kiosk • Powered by Sekolahku
            </footer>
        </div>
    );
}
