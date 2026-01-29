"use client";

import { useState, useEffect, useCallback } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Camera,
  CameraOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  User,
} from "lucide-react";

interface ScanResult {
  success: boolean;
  message: string;
  student?: {
    id: string;
    fullName: string;
    className: string;
    photo?: string;
  };
  status?: string;
  error?: string;
  alreadyRecorded?: boolean;
}

interface QRScannerProps {
  sessionId?: string;
  onScanSuccess?: (result: ScanResult) => void;
  onScanError?: (error: string) => void;
}

const STATUS_COLORS = {
  hadir: "bg-green-100 text-green-700 border-green-200",
  sakit: "bg-yellow-100 text-yellow-700 border-yellow-200",
  izin: "bg-blue-100 text-blue-700 border-blue-200",
  alpha: "bg-red-100 text-red-700 border-red-200",
};

export function QRScanner({ sessionId, onScanSuccess, onScanError }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const handleScan = useCallback(
    async (result: { rawValue: string }[]) => {
      if (processing || !result || result.length === 0) return;

      const qrCode = result[0].rawValue;
      if (!qrCode) return;

      setProcessing(true);
      setError(null);
      setLastResult(null);

      try {
        const response = await fetch("/api/attendance/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qrCode,
            sessionId,
            status: "hadir",
          }),
        });

        const data = await response.json();

        if (response.ok) {
          const successResult: ScanResult = {
            success: true,
            message: "Absensi berhasil dicatat!",
            student: data.student,
            status: "hadir",
          };
          setLastResult(successResult);
          setScanCount((prev) => prev + 1);
          onScanSuccess?.(successResult);
        } else if (response.status === 409) {
          // Already recorded
          const alreadyResult: ScanResult = {
            success: false,
            message: "Siswa sudah diabsen",
            student: data.student,
            alreadyRecorded: true,
          };
          setLastResult(alreadyResult);
        } else {
          setError(data.error || "Gagal mencatat absensi");
          onScanError?.(data.error);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan";
        setError(errorMsg);
        onScanError?.(errorMsg);
      } finally {
        setProcessing(false);
        // Auto-reset after 3 seconds
        setTimeout(() => {
          setLastResult(null);
          setError(null);
        }, 3000);
      }
    },
    [processing, sessionId, onScanSuccess, onScanError]
  );

  const handleError = (error: unknown) => {
    console.error("Scanner error:", error);
    setError("Gagal mengakses kamera. Pastikan izin kamera sudah diberikan.");
  };

  return (
    <div className="space-y-4">
      {/* Scanner Area */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-5 w-5" />
            QR Scanner
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {scanCount} siswa
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsScanning(!isScanning)}
            >
              {isScanning ? (
                <CameraOff className="h-4 w-4" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative aspect-square max-h-[400px] bg-black">
            {isScanning ? (
              <Scanner
                onScan={handleScan}
                onError={handleError}
                constraints={{
                  facingMode: "environment",
                }}
                styles={{
                  container: { width: "100%", height: "100%" },
                  video: { width: "100%", height: "100%", objectFit: "cover" },
                }}
                allowMultiple={true}
                scanDelay={1000}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-white/70">
                  <CameraOff className="h-16 w-16 mx-auto mb-2" />
                  <p>Kamera dimatikan</p>
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setIsScanning(true)}
                  >
                    Aktifkan Kamera
                  </Button>
                </div>
              </div>
            )}

            {/* Processing Overlay */}
            {processing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-2" />
                  <p>Memproses...</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result Display */}
      {lastResult && (
        <Card
          className={
            lastResult.success
              ? "border-green-200 bg-green-50"
              : lastResult.alreadyRecorded
              ? "border-yellow-200 bg-yellow-50"
              : "border-red-200 bg-red-50"
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={lastResult.student?.photo} />
                <AvatarFallback className="text-xl">
                  {lastResult.student?.fullName?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {lastResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : lastResult.alreadyRecorded ? (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span
                    className={
                      lastResult.success
                        ? "text-green-700 font-medium"
                        : lastResult.alreadyRecorded
                        ? "text-yellow-700 font-medium"
                        : "text-red-700 font-medium"
                    }
                  >
                    {lastResult.message}
                  </span>
                </div>
                {lastResult.student && (
                  <div className="mt-1">
                    <p className="font-semibold">{lastResult.student.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      Kelas {lastResult.student.className}
                    </p>
                  </div>
                )}
                {lastResult.status && (
                  <Badge className={`mt-2 ${STATUS_COLORS[lastResult.status as keyof typeof STATUS_COLORS]}`}>
                    {lastResult.status.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
