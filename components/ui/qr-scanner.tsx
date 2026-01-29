"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CameraOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Dynamic import to prevent SSR issues
const Scanner = dynamic(
    () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
    { ssr: false }
);

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  active?: boolean;
  className?: string;
  mirrored?: boolean;
}

export function QRScanner({ 
  onScan, 
  onError, 
  active = true,
  className,
  mirrored = false
}: QRScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);

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

  if (!active) {
      return (
          <div className={cn("relative bg-zinc-900 rounded-2xl flex items-center justify-center p-8", className)}>
               <p className="text-zinc-400 text-sm">Scanner tidak aktif</p>
          </div>
      );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative w-full aspect-square max-w-[320px] mx-auto rounded-2xl overflow-hidden bg-zinc-900">
        {!cameraError ? (
            <Scanner
                onScan={handleScan}
                onError={handleError}
                constraints={{ facingMode: "environment" }}
                styles={{
                    container: { width: "100%", height: "100%" },
                    video: { 
                        width: "100%", 
                        height: "100%", 
                        objectFit: "cover",
                        transform: mirrored ? "scaleX(-1)" : "none",
                    },
                }}
                components={{
                    onOff: true,
                }}
            />
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
