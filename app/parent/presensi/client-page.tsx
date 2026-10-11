"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChartBar, CalendarCheck, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getChildAttendanceAction, getChildrenAction } from "@/actions/parent";
interface Child {
  studentId: string;
  fullName: string;
  className: string;
}

interface Summary {
  academicYear: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  totalDays: number;
}

interface Recent {
  date: string;
  status: string;
  checkInTime?: number | null;
  recordMethod: string;
}

const STATUS_STYLE: Record<string, string> = {
  hadir: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  sakit: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  izin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  alpha: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const formatDate = (d: string) => {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

const formatTime = (ms?: number | null) => {
  if (!ms) return "-";
  try {
    return (
      new Date(ms).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    );
  } catch {
    return "-";
  }
};

const METHOD_LABEL: Record<string, string> = {
  qr_scan: "Scan QR",
  manual: "Manual",
};

export default function PresensiClientPage() {
  const searchParams = useSearchParams();
  const [children, setChildren] = useState<Child[]>([]);
  const [studentId, setStudentId] = useState("");
  const [summary, setSummary] = useState<Summary[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [weekly, setWeekly] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getChildrenAction();
        if (res.success) {
          const d = res.data as { data?: Child[] };
          const list = d.data || (res.data as Child[]) || [];
          setChildren(list);
          const preselect = searchParams.get("anak");
          setStudentId(preselect || list[0]?.studentId || "");
        }
      } catch {
        toast.error("Gagal memuat data anak");
      } finally {
        setLoading(false);
      }
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    (async () => {
      try {
        const res = await getChildAttendanceAction(studentId);
        if (res.success) {
          const d = res.data as {
            data?: { summary?: Summary[]; recent?: Recent[]; weekly?: Recent[] };
          };
          const payload = d.data || (res.data as { summary?: Summary[]; recent?: Recent[]; weekly?: Recent[] }) || {};
          setSummary(payload.summary || []);
          setRecent(payload.recent || []);
          setWeekly(payload.weekly || []);
        } else {
          toast.error(res.error || "Gagal memuat presensi");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Presensi</h1>
        <p className="text-sm text-muted-foreground">
          Rekap dan riwayat kehadiran anak Anda.
        </p>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {children.map((c) => (
            <button
              key={c.studentId}
              onClick={() => setStudentId(c.studentId)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                studentId === c.studentId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {c.fullName}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : studentId ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Rekap per Tahun Ajaran
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada data presensi.
                </p>
              ) : (
                summary.map((s) => (
                  <div key={s.academicYear} className="space-y-2">
                    <p className="text-sm font-medium">
                      {s.academicYear || "Tahun ini"}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      {(
                        [
                          [
                            "Hadir",
                            s.hadir,
                            "text-green-600 dark:text-green-400",
                          ],
                          [
                            "Sakit",
                            s.sakit,
                            "text-amber-600 dark:text-amber-400",
                          ],
                          ["Izin", s.izin, "text-blue-600 dark:text-blue-400"],
                          ["Alpha", s.alpha, "text-red-600 dark:text-red-400"],
                        ] as const
                      ).map(([label, val, cls]) => (
                        <div
                          key={label}
                          className="rounded-lg bg-muted/60 py-2"
                        >
                          <p className={cn("text-lg font-bold", cls)}>{val}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ChartBar className="h-5 w-5 text-primary" /> 7 Hari Terakhir
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weekly.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada data presensi minggu ini.
                </p>
              ) : (
                <WeeklyChart records={weekly} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" /> Riwayat
                Terbaru
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada riwayat presensi.
                </p>
              ) : (
                <div className="divide-y">
                  {recent.map((r) => (
                    <div
                      key={`${r.date}-${r.status}`}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm">{formatDate(r.date)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(r.checkInTime)} ·{" "}
                          {METHOD_LABEL[r.recordMethod] || r.recordMethod}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          STATUS_STYLE[r.status] ||
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data anak yang tertaut ke akun ini.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// WeeklyChart mini bar chart 7 hari untuk riwayat kehadiran.
function WeeklyChart({ records }: { records: Recent[] }) {
  // Urutkan paling lama -> terbaru (records datang terbaru duluan).
  const ordered = [...records].reverse();

  const dayLabels = ordered.map((r) => {
    try {
      const d = new Date(`${r.date}T00:00:00`);
      return d.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
      });
    } catch {
      return r.date;
    }
  });

  return (
    <div className="flex items-end justify-between gap-1 h-40">
      {ordered.map((r) => (
        <div key={r.date} className="flex flex-col items-center gap-1 w-8">
          <span
            className={cn(
              "h-5 w-5 shrink-0 rounded-sm",
              STATUS_STYLE[r.status] || "bg-muted",
            )}
            title={r.status || "belum absen"}
          />
          <span className="text-[9px] leading-tight text-center text-muted-foreground">
            {dayLabels[ordered.indexOf(r)]}
          </span>
        </div>
      ))}
    </div>
  );
}
