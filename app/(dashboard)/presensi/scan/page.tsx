"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, QrCode, Users } from "lucide-react";
import { QRScanner } from "@/components/attendance/qr-scanner";

interface Session {
  id: string;
  date: string;
  className: string;
  status: "open" | "closed";
}

export default function ScanPresensiPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const response = await fetch(
          `/api/attendance/sessions?date=${today}&status=open`
        );
        const data = await response.json();
        setSessions(data);
        if (data.length > 0) {
          setSelectedSession(data[0].id);
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const handleScanSuccess = () => {
    setScanCount((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/presensi">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" />
            Scan QR Presensi
          </h1>
          <p className="text-muted-foreground">
            Arahkan kamera ke QR code siswa
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          <Users className="h-4 w-4 mr-1" />
          {scanCount}
        </Badge>
      </div>

      {/* Session Selector */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Sesi Aktif</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih sesi presensi" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    Kelas {session.className} - {session.date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* No Session Warning */}
      {!loading && sessions.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-6 text-center">
            <p className="text-yellow-700 mb-4">
              Tidak ada sesi presensi aktif hari ini
            </p>
            <Link href="/presensi/sesi/baru">
              <Button>Buat Sesi Baru</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* QR Scanner */}
      {selectedSession && (
        <QRScanner
          sessionId={selectedSession}
          onScanSuccess={handleScanSuccess}
        />
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Petunjuk Penggunaan</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Pilih sesi presensi yang aktif</p>
          <p>2. Arahkan kamera ke QR code siswa</p>
          <p>3. Tunggu konfirmasi presensi berhasil</p>
          <p>4. Ulangi untuk siswa berikutnya</p>
        </CardContent>
      </Card>
    </div>
  );
}
