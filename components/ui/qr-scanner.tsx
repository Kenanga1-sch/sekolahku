"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { CameraOff, RefreshCw, FlipHorizontal, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePageVisible } from "@/lib/hooks/use-page-visible";

// Dynamic import to prevent SSR issues
const Scanner = dynamic(
    () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
    { ssr: false }
);

import type { BarcodeFormat } from "barcode-detector";
import type { TrackFunction } from "@yudiel/react-qr-scanner";

type FacingMode = "user" | "environment";

/**
 * Lama idle (tanpa deteksi) sebelum tracker dilepas dan decode diperlambat
 * dari ~100x/detik ke 2x/detik. Barcode tetap terdeteksi saat idle, hanya
 * lebih jarang — cukup untuk memicu kembali mode cepat begitu ada kode.
 */
const IDLE_AFTER_MS = 5000;

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  active?: boolean;
  className?: string;
  mirrored?: boolean;
  formats?: BarcodeFormat[];
  /**
   * Mode barcode (opt-in): aktifkan retry scan tiap 10ms (bukan 500ms),
   * resolusi kamera lebih tinggi, kontrol zoom/torch, dan highlight deteksi
   * di canvas. QR code memakai default (false) agar perilaku scanner QR
   * tidak berubah sama sekali.
   */
  barcodeMode?: boolean;
  /** Teks petunjuk di bawah preview. Default: teks untuk QR code. */
  caption?: string;
  /**
   * Beep saat barcode terdeteksi (barcodeMode saja). QR mode tidak pernah
   * dikontrol prop ini agar perilaku QR tetap apa adanya.
   */
  sound?: boolean;
  /** Getar singkat saat barcode terdeteksi (barcodeMode saja). Default: true. */
  vibrate?: boolean;
}

export function QRScanner({ 
  onScan, 
  onError, 
  active = true,
  className,
  mirrored = true, // Default to true for front camera natural feel
  formats,
  barcodeMode = false,
  caption,
  sound,
  vibrate = true,
}: QRScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment"); // Default to back camera for mobile-first scanning
  const [isMounted, setIsMounted] = useState(false);
  // Pause otomatis saat tab tidak terlihat: kamera + loop decode rAF
  // dihentikan sepenuhnya (bukan sekadar overlay) supaya HP tidak panas
  // dan baterai tidak terkuras saat pengguna pindah aplikasi/layar mati.
  const pageVisible = usePageVisible();

  useEffect(() => {
      // Load preference from localStorage
      const savedMode = localStorage.getItem("scanner-camera-preference") as FacingMode | null;
      if (savedMode && (savedMode === "user" || savedMode === "environment")) {
          setFacingMode(savedMode);
      }
      setIsMounted(true);
  }, []);

  useEffect(() => {
      if (isMounted) {
          localStorage.setItem("scanner-camera-preference", facingMode);
      }
  }, [facingMode, isMounted]);

  // Auto-mirror logic: only mirror if it's front camera AND mirrored prop is true
  const isMirrored = facingMode === "user" && mirrored;

  // Idle throttle: kehadiran `tracker` menurunkan retryDelay library dari
  // 500ms ke 10ms (decode ~100x/detik di main thread → HP panas). Setelah
  // beberapa detik tanpa deteksi, tracker dilepas (decode turun ke 2x/detik)
  // dan dipasang kembali begitu ada barcode — sehingga scan tetap responsif
  // saat benar-benar mengarahkan barcode, tanpa membakar CPU terus-menerus.
  const [trackerEnabled, setTrackerEnabled] = useState(barcodeMode);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markActivity = useCallback(() => {
    setTrackerEnabled(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setTrackerEnabled(false), IDLE_AFTER_MS);
  }, []);

  // Mulai siklus idle saat mode barcode aktif; bersihkan timer saat unmount.
  // Nilai awal trackerEnabled sudah true (barcodeMode), jadi effect cukup
  // memasang timer — tidak ada setState di badan effect.
  useEffect(() => {
    if (!barcodeMode) return;
    idleTimerRef.current = setTimeout(() => setTrackerEnabled(false), IDLE_AFTER_MS);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [barcodeMode]);

  /**
   * Tracker hanya dipakai di mode barcode. Dua manfaat:
   * 1. Kehadirannya menurunkan retryDelay library dari 500ms ke 10ms —
   *    decoder mencoba ~100x/detik sehingga barcode cepat terbaca.
   * 2. Menggambar kotak highlight hijau + nilai terdeteksi di canvas overlay.
   * Selama idle (tidak ada deteksi) tracker dilepas agar decode melambat.
   */
  const trackBarcode = useCallback<TrackFunction>((detectedCodes, ctx) => {
    if (detectedCodes.length) markActivity();
    if (!detectedCodes.length) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const code of detectedCodes) {
      const { x, y, width, height } = code.boundingBox;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#22c55e";
      ctx.strokeRect(x, y, width, height);
      if (code.rawValue) {
        ctx.font = "bold 14px ui-monospace, monospace";
        const textWidth = ctx.measureText(code.rawValue).width;
        const labelX = Math.min(Math.max(x, 2), ctx.canvas.width - textWidth - 10);
        const labelY = Math.max(y - 6, 18);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(labelX - 4, labelY - 14, textWidth + 8, 18);
        ctx.fillStyle = "#052e16";
        ctx.fillText(code.rawValue, labelX, labelY);
      }
    }
  }, [markActivity]);

  const scannerConstraints = barcodeMode
    ? {
        facingMode,
        // Resolusi ideal diturunkan dari 2560×1440 → 1280×720: decode
        // barcode berjalan di main thread, dan area 4× lebih kecil membuat
        // CPU jauh lebih ringan (HP tidak panas) tanpa kehilangan akurasi
        // untuk barcode yang didekatkan manual. min tetap rendah agar
        // kamera HP lama tidak menolak constraint.
        width: { min: 320, ideal: 1280, max: 1920 },
        height: { min: 320, ideal: 720, max: 1080 },
      }
    : { facingMode };

  // Tombol torch hanya dirender library bila capabilities kamera memilikinya,
  // jadi aman diaktifkan untuk semua HP di barcodeMode.
  const scannerComponents = barcodeMode
    ? { onOff: true, tracker: trackerEnabled ? trackBarcode : undefined, zoom: true, torch: true }
    : { onOff: true };

  const lastScanRef = useRef<string>("");
  const lastScanAtRef = useRef(0);

  const handleScan = (result: { rawValue: string }[]) => {
      if (!result || result.length === 0) return;
      // Jalur QR: persis seperti sebelumnya, tanpa debounce/getar apa pun.
      if (!barcodeMode) {
          onScan(result[0].rawValue);
          return;
      }
      // Barcode terdeteksi → pasang kembali tracker (mode decode cepat) bila
      // sebelumnya dilepas saat idle. Deteksi saat idle tetap terjadi karena
      // retryDelay 500ms, jadi siklus cepat bisa dipulihkan dari sini.
      markActivity();
      // Barcode: library sudah menahan duplikat selama kode yang sama masih
      // terlihat, tapi saat kamera goyang kode lama bisa muncul-hilang sehingga
      // onScan terpicu berulang dan membanjiri handler (mis. trigger lookup
      // ISBN). Debounce nilai identik dalam 1.2 detik untuk meredam itu.
      const value = result[0].rawValue;
      const now = Date.now();
      if (value === lastScanRef.current && now - lastScanAtRef.current < 1200) return;
      lastScanRef.current = value;
      lastScanAtRef.current = now;
      if (vibrate && typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(80);
      }
      onScan(value);
  };

  const handleError = (error: unknown) => {
      console.error("Scanner error:", error);
      let message = "Gagal mengakses kamera";
      
      if (error instanceof Error) {
          if (error.name === "NotAllowedError" || error.message.includes("permission")) {
              message = "Izin kamera ditolak";
          } else {
              message = error.message;
          }
      }
      
      setCameraError(message);
      onError?.(message);
  };

  const resetError = () => {
      setCameraError(null);
  };

  if (!active || !isMounted) {
      return (
          <div className={cn("relative bg-zinc-900 rounded-2xl flex items-center justify-center p-8", className)}>
               <p className="text-zinc-400 text-sm">
                   {!active ? "Scanner tidak aktif" : "Menghubungkan..."}
               </p>
          </div>
      );
  }

  const toggleCamera = () => {
      setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative w-full aspect-square max-w-[500px] mx-auto rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl border-4 border-zinc-800/50">
        {!cameraError ? (
            <>
            <Scanner
                onScan={handleScan}
                onError={handleError}
                formats={formats}
                constraints={scannerConstraints}
                // Tab tidak terlihat (pindah aplikasi / layar mati) → hentikan
                // kamera + loop decode sepenuhnya agar HP tidak panas.
                paused={!pageVisible}
                sound={barcodeMode ? (sound ?? true) : undefined}
                styles={{
                    container: { width: "100%", height: "100%" },
                    video: { 
                        width: "100%", 
                        height: "100%", 
                        objectFit: "cover",
                        transform: isMirrored ? "scaleX(-1)" : "none",
                    },
                }}
                components={scannerComponents}
            />
            {/* Camera Switch Floating Button */}
            <div className="absolute top-4 right-4 z-20">
                <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full bg-black/50 backdrop-blur-md border-white/10 hover:bg-black/70 h-10 w-10"
                    onClick={toggleCamera}
                    title="Ganti Kamera"
                >
                    <SwitchCamera className="h-5 w-5 text-white" />
                </Button>
            </div>
            
            {/* Mirror Indicator */}
            {isMirrored && (
                <div className="absolute bottom-4 left-4 z-20">
                    <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
                        <FlipHorizontal className="h-3 w-3 text-white/70" />
                        <span className="text-[10px] text-white/70 font-medium uppercase tracking-wider">Mirrored</span>
                    </div>
                </div>
            )}
            </>
        ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white z-10 p-4 text-center">
                <CameraOff className="h-12 w-12 mb-3 text-red-400" />
                <p className="text-sm font-medium mb-2">{cameraError}</p>
                <p className="text-xs text-zinc-400 mb-4">
                  Pastikan kamera terhubung dan izin diberikan
                </p>
                <Button size="sm" variant="secondary" onClick={resetError}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Coba Lagi
                </Button>
            </div>
        )}
      </div>
       <p className="text-center text-sm text-muted-foreground mt-3">
          {caption ?? "Arahkan kamera ke QR Code pada kartu siswa"}
       </p>
    </div>
  );
}
