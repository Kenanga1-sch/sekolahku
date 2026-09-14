"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wallet, ClipboardList, Calendar, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StudentData {
  fullName: string;
  nisn: string;
  className: string;
  balance: number;
}

interface AttendanceSummary {
  status: string;
  count: number;
}

const STATUS_LABELS: Record<string, string> = {
  hadir: "Hadir",
  sakit: "Sakit",
  izin: "Izin",
  alpha: "Alpha",
};

const STATUS_COLORS: Record<string, string> = {
  hadir: "bg-green-100 text-green-800",
  sakit: "bg-yellow-100 text-yellow-800",
  izin: "bg-blue-100 text-blue-800",
  alpha: "bg-red-100 text-red-800",
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function SiswaOverview() {
  const [student, setStudent] = useState<StudentData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meRes, attRes] = await Promise.all([
          fetch("/api/student/me"),
          fetch("/api/student/me/attendance"),
        ]);
        const meJson = await meRes.json();
        const attJson = await attRes.json();
        if (meJson.success) setStudent(meJson.data);
        if (attJson.success) setAttendance(attJson.data || []);
      } catch (err) {
        console.error("Gagal memuat data siswa:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Data siswa tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header greeting */}
      <div>
        <h1 className="text-2xl font-bold">Halo, {student.fullName} 👋</h1>
        <p className="text-muted-foreground">
          {student.className} &middot; NISN {student.nisn}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Tabungan</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatRupiah(student.balance)}</div>
          </CardContent>
        </Card>

        {attendance.map((att) => (
          <Card key={att.status}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {STATUS_LABELS[att.status] || att.status}
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{att.count}</div>
              <Badge variant="secondary" className={STATUS_COLORS[att.status] || ""}>
                {att.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <a href="/presensi/saya" className="block">
          <Card className="transition-colors hover:bg-accent">
            <CardContent className="flex items-center gap-3 p-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Presensi Saya</div>
                <div className="text-xs text-muted-foreground">Lihat riwayat kehadiran</div>
              </div>
            </CardContent>
          </Card>
        </a>
        <a href="/tabungan/saya" className="block">
          <Card className="transition-colors hover:bg-accent">
            <CardContent className="flex items-center gap-3 p-4">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Tabungan Saya</div>
                <div className="text-xs text-muted-foreground">Riwayat setoran & penarikan</div>
              </div>
            </CardContent>
          </Card>
        </a>
        <a href="/profile" className="block">
          <Card className="transition-colors hover:bg-accent">
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Profil Saya</div>
                <div className="text-xs text-muted-foreground">Kelola akun</div>
              </div>
            </CardContent>
          </Card>
        </a>
      </div>
    </div>
  );
}
