"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
    QrCode,
    BookOpen,
    User,
    ArrowRight,
    CheckCircle,
    XCircle,
    RefreshCw,
    LogOut,
    Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    smartScan,
    getMemberActiveLoans,
    borrowBook,
    returnBook,
    recordVisit,
} from "@/lib/library";
import type { LibraryMember, LibraryItem, LibraryLoan } from "@/types/library";

type KioskState =
    | { type: "idle" }
    | { type: "scanning" }
    | { type: "member_identified"; member: LibraryMember; loans: LibraryLoan[] }
    | { type: "borrow_mode"; member: LibraryMember; loans: LibraryLoan[] }
    | { type: "success"; message: string; details?: string }
    | { type: "error"; message: string };

const AUTO_RESET_DELAY = 20000; // 20 seconds

export default function KioskPage() {
    const [state, setState] = useState<KioskState>({ type: "idle" });
    const [qrInput, setQrInput] = useState("");
    const autoResetTimer = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on mount and reset
    useEffect(() => {
        if (state.type === "idle" || state.type === "scanning" ||
            state.type === "member_identified" || state.type === "borrow_mode") {
            inputRef.current?.focus();
        }
    }, [state.type]);

    // Auto-reset timer
    const resetAutoTimer = useCallback(() => {
        if (autoResetTimer.current) {
            clearTimeout(autoResetTimer.current);
        }
        autoResetTimer.current = setTimeout(() => {
            setState({ type: "idle" });
            setQrInput("");
        }, AUTO_RESET_DELAY);
    }, []);

    // Clear timer on unmount
    useEffect(() => {
        return () => {
            if (autoResetTimer.current) {
                clearTimeout(autoResetTimer.current);
            }
        };
    }, []);

    const handleScan = async (code: string) => {
        if (!code.trim()) return;

        setState({ type: "scanning" });
        setQrInput("");
        resetAutoTimer();

        try {
            const result = await smartScan(code);

            if (result.type === "error") {
                setState({ type: "error", message: result.message });
                playSound("error");
                return;
            }

            if (result.type === "member") {
                const member = result.data;
                const loans = await getMemberActiveLoans(member.id);

                // Record visit
                await recordVisit(member.id);

                // Check if already in borrow mode
                if (state.type === "member_identified" &&
                    (state as { member: LibraryMember }).member.id === member.id) {
                    // Second scan - activate borrow mode
                    setState({ type: "borrow_mode", member, loans });
                    playSound("success");
                } else {
                    // First scan - identify member
                    setState({ type: "member_identified", member, loans });
                    playSound("success");
                }
            }

            if (result.type === "item") {
                const item = result.data;

                // Check if member is in borrow mode
                if (state.type === "borrow_mode") {
                    const member = (state as { member: LibraryMember }).member;
                    const loans = (state as { loans: LibraryLoan[] }).loans;

                    // Check if item is already borrowed by this member
                    const existingLoan = loans.find(
                        (l) => l.item === item.id && !l.is_returned
                    );

                    if (existingLoan) {
                        // Return the book
                        await returnBook(existingLoan.id);
                        setState({
                            type: "success",
                            message: "Buku Dikembalikan!",
                            details: item.title,
                        });
                        playSound("success");
                    } else if (item.status === "BORROWED") {
                        setState({
                            type: "error",
                            message: "Buku sedang dipinjam orang lain",
                        });
                        playSound("error");
                    } else {
                        // Check borrow limit
                        if (loans.length >= member.max_borrow_limit) {
                            setState({
                                type: "error",
                                message: `Batas pinjam tercapai (${member.max_borrow_limit} buku)`,
                            });
                            playSound("error");
                        } else {
                            // Borrow the book
                            await borrowBook(member.id, item.id);
                            setState({
                                type: "success",
                                message: "Buku Dipinjam!",
                                details: item.title,
                            });
                            playSound("success");
                        }
                    }
                } else {
                    setState({
                        type: "error",
                        message: "Scan kartu anggota terlebih dahulu",
                    });
                    playSound("error");
                }
            }
        } catch (error) {
            console.error("Scan error:", error);
            setState({ type: "error", message: "Terjadi kesalahan sistem" });
            playSound("error");
        }
    };

    const playSound = (type: "success" | "error") => {
        // Simple beep using Web Audio API
        try {
            const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = type === "success" ? 800 : 300;
            oscillator.type = "sine";
            gainNode.gain.value = 0.3;

            oscillator.start();
            oscillator.stop(audioContext.currentTime + (type === "success" ? 0.15 : 0.3));
        } catch {
            // Audio not supported
        }
    };

    const reset = () => {
        setState({ type: "idle" });
        setQrInput("");
        if (autoResetTimer.current) {
            clearTimeout(autoResetTimer.current);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleScan(qrInput);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
            {/* Header */}
            <header className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center">
                        <BookOpen className="h-7 w-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Perpustakaan</h1>
                        <p className="text-blue-200 text-sm">Self-Service Kiosk</p>
                    </div>
                </div>
                <div className="text-right text-blue-200 text-sm">
                    <Clock className="inline h-4 w-4 mr-1" />
                    {new Date().toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                    })}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-6">
                {/* Idle State */}
                {state.type === "idle" && (
                    <Card className="w-full max-w-lg bg-white/10 backdrop-blur border-white/20">
                        <CardContent className="p-8 text-center">
                            <div className="h-32 w-32 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                                <QrCode className="h-16 w-16 text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                Scan Kartu Anggota
                            </h2>
                            <p className="text-blue-200">
                                Arahkan kartu anggota ke scanner untuk memulai
                            </p>
                            <input
                                ref={inputRef}
                                type="text"
                                value={qrInput}
                                onChange={(e) => setQrInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="sr-only"
                                autoFocus
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Member Identified */}
                {state.type === "member_identified" && (
                    <Card className="w-full max-w-lg bg-white/10 backdrop-blur border-yellow-400/50">
                        <CardContent className="p-8 text-center">
                            <div className="h-24 w-24 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                <User className="h-12 w-12 text-yellow-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-1">
                                Selamat Datang!
                            </h2>
                            <p className="text-2xl font-bold text-yellow-400 mb-2">
                                {state.member.name}
                            </p>
                            {state.member.class_name && (
                                <Badge className="bg-yellow-500/20 text-yellow-300 mb-4">
                                    Kelas {state.member.class_name}
                                </Badge>
                            )}
                            <div className="mt-4 p-4 bg-white/5 rounded-lg">
                                <p className="text-blue-200 text-sm">
                                    Pinjaman aktif: <span className="font-bold text-white">{state.loans.length}</span> / {state.member.max_borrow_limit}
                                </p>
                            </div>
                            <div className="mt-6 text-blue-200">
                                <p className="flex items-center justify-center gap-2 animate-pulse">
                                    <QrCode className="h-5 w-5" />
                                    Scan lagi untuk mode pinjam
                                    <ArrowRight className="h-5 w-5" />
                                </p>
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={qrInput}
                                onChange={(e) => setQrInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="sr-only"
                                autoFocus
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Borrow Mode */}
                {state.type === "borrow_mode" && (
                    <Card className="w-full max-w-lg bg-white/10 backdrop-blur border-green-400/50">
                        <CardContent className="p-8 text-center">
                            <div className="h-24 w-24 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                <BookOpen className="h-12 w-12 text-green-400" />
                            </div>
                            <Badge className="bg-green-500 text-white mb-2">Mode Pinjam Aktif</Badge>
                            <h2 className="text-xl font-bold text-white mb-1">
                                {state.member.name}
                            </h2>
                            <div className="mt-4 p-4 bg-white/5 rounded-lg">
                                <p className="text-blue-200 text-sm mb-2">
                                    Pinjaman: {state.loans.length} / {state.member.max_borrow_limit}
                                </p>
                                {state.loans.length > 0 && (
                                    <div className="text-left text-sm">
                                        {state.loans.slice(0, 3).map((loan, i) => (
                                            <p key={i} className="text-blue-300 truncate">
                                                • {loan.expand?.item?.title || "Buku"}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 text-green-300">
                                <p className="flex items-center justify-center gap-2 animate-pulse">
                                    <QrCode className="h-5 w-5" />
                                    Scan buku untuk pinjam/kembalikan
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                className="mt-4 text-blue-300 hover:text-white"
                                onClick={reset}
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Selesai
                            </Button>
                            <input
                                ref={inputRef}
                                type="text"
                                value={qrInput}
                                onChange={(e) => setQrInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="sr-only"
                                autoFocus
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Success */}
                {state.type === "success" && (
                    <Card className="w-full max-w-lg bg-green-500/20 backdrop-blur border-green-400">
                        <CardContent className="p-8 text-center">
                            <div className="h-24 w-24 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
                                <CheckCircle className="h-12 w-12 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-green-400 mb-2">
                                {state.message}
                            </h2>
                            {state.details && (
                                <p className="text-white text-lg">{state.details}</p>
                            )}
                            <Button
                                className="mt-6 bg-green-500 hover:bg-green-600"
                                onClick={reset}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Transaksi Baru
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Error */}
                {state.type === "error" && (
                    <Card className="w-full max-w-lg bg-red-500/20 backdrop-blur border-red-400">
                        <CardContent className="p-8 text-center">
                            <div className="h-24 w-24 mx-auto mb-4 rounded-full bg-red-500 flex items-center justify-center">
                                <XCircle className="h-12 w-12 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-red-400 mb-2">
                                {state.message}
                            </h2>
                            <Button
                                className="mt-6 bg-red-500 hover:bg-red-600"
                                onClick={reset}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Coba Lagi
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Scanning */}
                {state.type === "scanning" && (
                    <Card className="w-full max-w-lg bg-white/10 backdrop-blur border-white/20">
                        <CardContent className="p-8 text-center">
                            <div className="h-24 w-24 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center animate-spin">
                                <RefreshCw className="h-12 w-12 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">
                                Memproses...
                            </h2>
                        </CardContent>
                    </Card>
                )}
            </main>

            {/* Footer */}
            <footer className="p-4 text-center text-blue-300/50 text-sm">
                Powered by Sekolahku
            </footer>
        </div>
    );
}
