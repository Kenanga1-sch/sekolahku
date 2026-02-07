"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { CameraOff, RefreshCw, FlipHorizontal, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Dynamic import to prevent SSR issues
const Scanner = dynamic(
    () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
    { ssr: false }
);

import type { BarcodeFormat } from "barcode-detector";

type FacingMode = "user" | "environment";

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  active?: boolean;
  className?: string;
  mirrored?: boolean;
  formats?: BarcodeFormat[];
}

export function QRScanner({ 
  onScan, 
  onError, 
  active = true,
  className,
  mirrored = true, // Default to true for front camera natural feel
  formats,
}: QRScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment"); // Default to back camera for mobile-first scanning
  const [isMounted, setIsMounted] = useState(false);

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

  const handleScan = (result: { rawValue: string }[]) => {
      if (result && result.length > 0) {
          onScan(result[0].rawValue);
      }
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
                constraints={{ facingMode }}
                styles={{
                    container: { width: "100%", height: "100%" },
                    video: { 
                        width: "100%", 
                        height: "100%", 
                        objectFit: "cover",
                        transform: isMirrored ? "scaleX(-1)" : "none",
                    },
                }}
                components={{
                    onOff: true,
                }}
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
          Arahkan kamera ke QR Code pada kartu siswa
       </p>
    </div>
  );
}
