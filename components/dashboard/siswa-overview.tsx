"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  UserRound,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

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

const STATUS_TONES: Record<string, string> = {
  hadir: "bg-success/10 text-success",
  sakit: "bg-warning/10 text-warning",
  izin: "bg-info/10 text-info",
  alpha: "bg-destructive/10 text-destructive",
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

const quickLinks = [
  {
    href: "/presensi/saya",
    title: "Presensi Saya",
    description: "Lihat riwayat kehadiran",
    icon: CalendarDays,
  },
  {
    href: "/tabungan/saya",
    title: "Tabungan Saya",
    description: "Riwayat setoran dan penarikan",
    icon: Wallet,
  },
  {
    href: "/profile",
    title: "Profil Saya",
    description: "Kelola informasi akun",
    icon: UserRound,
  },
];

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
      <div className="space-y-6" aria-busy="true" aria-label="Memuat beranda siswa">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-48 rounded-2xl lg:col-span-7" />
          <Skeleton className="h-48 rounded-2xl lg:col-span-5" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <UserRound className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Data siswa tidak ditemukan</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hubungi administrator sekolah untuk memeriksa akun Anda.
            </p>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline">
            Muat ulang
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${student.className} · NISN ${student.nisn}`}
        title={`Halo, ${student.fullName}`}
        description="Ringkasan tabungan, presensi, dan akses cepatmu hari ini."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="border-primary/20 bg-primary text-primary-foreground lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5" aria-hidden="true" />
              Saldo tabungan
            </CardTitle>
            <CardDescription className="text-primary-foreground-soft">
              Saldo terkini rekening tabunganmu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
              {formatRupiah(student.balance)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/tabungan/saya">
                  Lihat riwayat <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="border-b border-line/60 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
              Ringkasan presensi
            </CardTitle>
            <CardDescription>Rekap kehadiran yang tercatat.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {attendance.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada data presensi.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {attendance.map((att) => (
                  <li
                    key={att.status}
                    className="rounded-xl border border-line/60 bg-surface-muted/40 p-3"
                  >
                    <span
                      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        STATUS_TONES[att.status] || "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABELS[att.status] || att.status}
                    </span>
                    <p className="mt-2 text-2xl font-bold tabular-nums">{att.count}</p>
                    <p className="text-xs text-muted-foreground">hari</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <SectionHeader
        title="Akses cepat"
        description="Pintasan ke halaman yang paling sering kamu buka."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {quickLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-start gap-3.5 rounded-2xl border border-line/70 bg-card p-4 shadow-[0_1px_2px_rgba(4,34,43,0.04)] transition-colors hover:border-primary/30 hover:bg-surface-muted/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                {item.title}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        Butuh bantuan? Hubungi wali kelas atau administrator sekolah.
      </div>
    </div>
  );
}
