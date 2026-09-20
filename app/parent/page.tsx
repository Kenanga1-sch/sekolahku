"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  GraduationCap,
  Wallet,
  ChevronRight,
  IdCard,
  ClipboardList,
  Backpack,
  Sprout,
  CalendarPlus,
  MessageCircle,
  ArrowRightLeft,
  CalendarCheck,
  FileText,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getParentDashboardAction } from "@/actions/parent";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/upload-url";

interface AttendanceRecord {
  date: string;
  status: string;
  checkInTime?: number | null;
  recordMethod: string;
}

interface DashboardChild {
  studentId: string;
  fullName: string;
  nisn: string;
  classId: string;
  className: string;
  photo?: string | null;
  relation: string;
  balance: number;
  activeLoans?: number;
  attendanceToday?: AttendanceRecord | null;
  weekly: { hadir: number; sakit: number; izin: number; alpha: number };
  tugas: { total: number; belum: number; terlambat: number };
  pendingLeaves: number;
  latestTransaction?: { tipe: string; nominal: number; catatan: string; createdAt: number } | null;
  mutasi?: { id: string; status: string; destinationSchool: string } | null;
}

const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const formatTime = (ms?: number | null) => {
  if (!ms) return "-";
  try {
    return new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
  } catch {
    return "-";
  }
};

const formatDateTime = (ms: number) => {
  try {
    return new Date(ms).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

const STATUS_DOT: Record<string, string> = {
  hadir: "bg-green-500",
  sakit: "bg-amber-500",
  izin: "bg-blue-500",
  alpha: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  hadir: "Hadir",
  sakit: "Sakit",
  izin: "Izin",
  alpha: "Alpha",
};

const MUTASI_STATUS_LABEL: Record<string, string> = {
  draft: "Menunggu diproses",
  processed: "Sedang diproses",
  completed: "Selesai",
};

const QUICK_ACTIONS = [
  { href: "/parent/presensi", label: "Presensi", icon: ClipboardList, iconCls: "text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300" },
  { href: "/parent/tugas", label: "Tugas", icon: Backpack, iconCls: "text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300" },
  { href: "/parent/tabungan", label: "Tabungan", icon: Wallet, iconCls: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { href: "/parent/perkembangan", label: "Perkembangan", icon: Sprout, iconCls: "text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-300" },
  { href: "/parent/izin", label: "Izin/Sakit", icon: CalendarPlus, iconCls: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300" },
  { href: "/parent/chat", label: "Pesan", icon: MessageCircle, iconCls: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" },
];

function getGreeting(d: Date) {
  const h = d.getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export default function ParentHomePage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<DashboardChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const now = new Date();
    setTodayLabel(
      now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    );

    (async () => {
      try {
        const res = await getParentDashboardAction();
        if (res.success) {
          const payload = res.data as { data?: DashboardChild[] };
          setChildren(payload.data || (res.data as DashboardChild[]) || []);
        } else {
          toast.error(res.error || "Gagal memuat data anak");
        }
      } catch {
        toast.error("Gagal memuat data anak");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const parentName = user?.fullName || user?.name || "Orang Tua";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">
          {getGreeting(new Date())}, {parentName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {todayLabel || "Memuat tanggal…"} · Ringkasan anak Anda hari ini.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-2.5 text-center transition-colors hover:bg-muted/60"
          >
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", a.iconCls)}>
              <a.icon className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-medium leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : children.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data anak yang tertaut ke akun ini. Hubungi sekolah untuk menautkan akun Anda.
          </CardContent>
        </Card>
      ) : (
        children.map((c) => <ChildSummaryCard key={c.studentId} child={c} />)
      )}
    </div>
  );
}

function ChildSummaryCard({ child: c }: { child: DashboardChild }) {
  const today = c.attendanceToday;
  const hasTugas = c.tugas.total > 0;
  const tx = c.latestTransaction;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {c.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveUploadUrl(c.photo) ?? undefined} alt={c.fullName} className="h-full w-full object-cover" />
            ) : (
              <GraduationCap className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{c.fullName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <IdCard className="h-3 w-3" /> {c.nisn || "-"}
              </span>
              <span>{c.className || "-"}</span>
            </p>
          </div>
          {c.mutasi && (
            <Link href="/parent/mutasi">
              <Badge variant="secondary" className="gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                {MUTASI_STATUS_LABEL[c.mutasi.status] || c.mutasi.status}
              </Badge>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarCheck className="h-3.5 w-3.5" /> Kehadiran Hari Ini
            </p>
            {today ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[today.status] || "bg-muted")} />
                <p className="font-semibold">{STATUS_LABEL[today.status] || today.status}</p>
                <span className="text-xs text-muted-foreground">· {formatTime(today.checkInTime)}</span>
              </div>
            ) : (
              <p className="font-medium mt-1 text-muted-foreground">Belum ada catatan</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">
              7 hari: {c.weekly.hadir} hadir · {c.weekly.sakit} sakit · {c.weekly.izin} izin · {c.weekly.alpha} alpha
            </p>
          </div>

          <Link
            href="/parent/tugas"
            className="rounded-lg border bg-muted/30 p-3 hover:bg-muted transition-colors flex flex-col"
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Backpack className="h-3.5 w-3.5" /> Tugas &amp; PR
            </p>
            {hasTugas ? (
              <>
                <p className="font-semibold mt-1">{c.tugas.belum} belum dikumpulkan</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {c.tugas.terlambat > 0 ? (
                    <span className="text-red-600 dark:text-red-400 font-medium">{c.tugas.terlambat} terlambat</span>
                  ) : (
                    "Tidak ada yang terlambat"
                  )}{" "}
                  · {c.tugas.total} total
                </p>
              </>
            ) : (
              <p className="font-medium mt-1 text-muted-foreground">Tidak ada tugas</p>
            )}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" /> Saldo Tabungan
            </p>
            <p className="font-semibold mt-0.5">{formatRupiah(c.balance)}</p>
            {tx ? (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {tx.tipe === "setor" ? "Setoran" : "Penarikan"} {formatRupiah(tx.nominal)} · {formatDateTime(tx.createdAt)}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">Belum ada transaksi</p>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" /> Status Pengajuan
            </p>
            {c.pendingLeaves > 0 ? (
              <Link href={`/parent/izin?anak=${c.studentId}`} className="mt-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  {c.pendingLeaves} izin menunggu
                </p>
              </Link>
            ) : (
              <p className="font-medium mt-1 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Tidak menunggu
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {c.mutasi ? `Mutasi: ${c.mutasi.destinationSchool}` : "Tidak ada permohonan mutasi"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/parent/izin?anak=${c.studentId}`}
            className="flex-1 rounded-lg border bg-muted/30 p-2.5 hover:bg-muted transition-colors flex items-center justify-between text-sm"
          >
            <span>Ajukan Izin/Sakit</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/parent/tabungan/rekening-koran"
            className="flex-1 rounded-lg border bg-muted/30 p-2.5 hover:bg-muted transition-colors flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Rekening Koran
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
