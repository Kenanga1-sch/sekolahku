"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  QrCode,
  Lock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Student {
  id: string;
  fullName: string;
  nisn: string | null;
  nis: string | null;
  className: string;
  photo: string | null;
}

interface Record {
  id: string;
  status: "hadir" | "sakit" | "izin" | "alpha";
  checkInTime: string;
  recordMethod: "qr_scan" | "manual";
  notes: string | null;
  student: Student;
}

interface SessionDetail {
  id: string;
  date: string;
  className: string;
  teacherName: string | null;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  records: Record[];
  allStudents: Student[];
  stats: {
    total: number;
    hadir: number;
    sakit: number;
    izin: number;
    alpha: number;
    belumAbsen: number;
  };
}

const STATUS_CONFIG = {
  hadir: { label: "Hadir", color: "bg-green-100 text-green-700", icon: CheckCircle },
  sakit: { label: "Sakit", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  izin: { label: "Izin", color: "bg-blue-100 text-blue-700", icon: Clock },
  alpha: { label: "Alpha", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function SesiDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/attendance/sessions/${params.id}`);
      if (!response.ok) throw new Error("Session not found");
      const data = await response.json();
      setSession(data);
    } catch (err) {
      setError("Gagal memuat data sesi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchSession();
    }
  }, [params.id]);

  const handleCloseSession = async () => {
    if (!confirm("Tutup sesi presensi ini? Siswa yang belum diabsen akan ditandai Alpha.")) return;

    setClosing(true);
    try {
      // Mark remaining students as Alpha
      if (session) {
        const recordedIds = session.records.map((r) => r.student.id);
        const notRecorded = session.allStudents.filter(
          (s) => !recordedIds.includes(s.id)
        );

        for (const student of notRecorded) {
          await fetch("/api/attendance/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              qrCode: student.id, // Use student ID as fallback
              sessionId: session.id,
              status: "alpha",
            }),
          });
        }
      }

      // Close session
      await fetch(`/api/attendance/sessions/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      fetchSession();
    } catch (err) {
      setError("Gagal menutup sesi");
    } finally {
      setClosing(false);
    }
  };

  const handleManualStatus = async (studentId: string, status: string) => {
    try {
      const response = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
          studentId,
          status,
        }),
      });

      if (response.ok) {
        fetchSession();
      }
    } catch (err) {
      console.error("Error recording attendance:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Sesi tidak ditemukan</p>
        <Link href="/presensi">
          <Button className="mt-4">Kembali</Button>
        </Link>
      </div>
    );
  }

  const recordedIds = session.records.map((r) => r.student.id);
  const notRecorded = session.allStudents.filter(
    (s) => !recordedIds.includes(s.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/presensi">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Kelas {session.className}
            </h1>
            <p className="text-muted-foreground">
              {format(new Date(session.date), "EEEE, d MMMM yyyy", { locale: localeId })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              session.status === "open"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-700"
            }
          >
            {session.status === "open" ? "Aktif" : "Tutup"}
          </Badge>
          {session.status === "open" && (
            <>
              <Link href="/presensi/scan">
                <Button variant="outline" size="sm">
                  <QrCode className="h-4 w-4 mr-1" />
                  Scan
                </Button>
              </Link>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCloseSession}
                disabled={closing}
              >
                {closing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4 mr-1" />
                )}
                Tutup Sesi
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gray-50">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{session.stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-green-700">{session.stats.hadir}</p>
            <p className="text-xs text-green-600">Hadir</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{session.stats.sakit}</p>
            <p className="text-xs text-yellow-600">Sakit</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{session.stats.izin}</p>
            <p className="text-xs text-blue-600">Izin</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-red-700">
              {session.stats.alpha + session.stats.belumAbsen}
            </p>
            <p className="text-xs text-red-600">Alpha/Belum</p>
          </CardContent>
        </Card>
      </div>

      {/* Recorded Students */}
      <Card>
        <CardHeader>
          <CardTitle>Siswa Sudah Diabsen ({session.records.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {session.records.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              Belum ada siswa yang diabsen
            </p>
          ) : (
            <div className="space-y-2">
              {session.records.map((record) => {
                const config = STATUS_CONFIG[record.status];
                const StatusIcon = config.icon;
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={record.student?.photo || undefined} />
                        <AvatarFallback>
                          {record.student?.fullName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{record.student?.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.student?.nis || record.student?.nisn || "-"}
                        </p>
                      </div>
                    </div>
                    <Badge className={config.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Not Recorded Students */}
      {session.status === "open" && notRecorded.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-700">
              Belum Diabsen ({notRecorded.length})
            </CardTitle>
            <CardDescription>
              Klik status untuk mencatat absensi manual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notRecorded.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={student.photo || undefined} />
                      <AvatarFallback>
                        {student.fullName?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{student.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.nis || student.nisn || "-"}
                      </p>
                    </div>
                  </div>
                  <Select
                    onValueChange={(value) => handleManualStatus(student.id, value)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hadir">Hadir</SelectItem>
                      <SelectItem value="sakit">Sakit</SelectItem>
                      <SelectItem value="izin">Izin</SelectItem>
                      <SelectItem value="alpha">Alpha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
