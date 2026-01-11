"use client";

import Link from "next/link";
import { WifiOff, Home, RefreshCw } from "lucide-react";

export default function OfflinePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            <div className="text-center px-6 py-12 max-w-md">
                {/* Offline Icon */}
                <div className="mb-8 relative">
                    <div className="w-24 h-24 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center">
                        <WifiOff className="w-12 h-12 text-blue-400" />
                    </div>
                    <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full bg-blue-500/10 animate-ping" />
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-white mb-4">
                    Anda Sedang Offline
                </h1>

                {/* Description */}
                <p className="text-slate-300 mb-8 leading-relaxed">
                    Sepertinya koneksi internet Anda terputus. Beberapa fitur mungkin tidak tersedia.
                    Silakan periksa koneksi Anda dan coba lagi.
                </p>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Coba Lagi
                    </button>

                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/20"
                    >
                        <Home className="w-5 h-5" />
                        Beranda
                    </Link>
                </div>

                {/* Tips */}
                <div className="mt-12 p-4 rounded-lg bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-blue-400 mb-2">Tips:</h3>
                    <ul className="text-sm text-slate-400 text-left space-y-1">
                        <li>• Periksa koneksi WiFi atau data seluler Anda</li>
                        <li>• Coba aktifkan mode pesawat lalu matikan kembali</li>
                        <li>• Halaman yang sudah dikunjungi mungkin masih bisa diakses</li>
                    </ul>
                </div>

                {/* Branding */}
                <p className="mt-8 text-sm text-slate-500">
                    Website Sekolah Terpadu
                </p>
            </div>
        </div>
    );
}
