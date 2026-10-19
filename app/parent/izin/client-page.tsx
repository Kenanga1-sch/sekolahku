"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Stethoscope, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createLeaveAction, getChildrenAction, getMyLeavesAction, cancelLeaveAction } from "@/actions/parent";

interface Child {
  studentId: string;
  fullName: string;
  className: string;
}

interface Leave {
  id: string;
  studentId: string;
  studentName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  reviewNote?: string | null;
  createdAt: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

const formatDate = (d: string) => {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
};

export default function IzinClientPage() {
  const searchParams = useSearchParams();
  const [children, setChildren] = useState<Child[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<"izin" | "sakit">("izin");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState("");

  const fetchAll = async () => {
    try {
      const [cRes, lRes] = await Promise.all([getChildrenAction(), getMyLeavesAction()]);
      if (cRes.success) {
        const cd = cRes.data as { data?: Child[] };
        const list = cd.data || (cRes.data as Child[]) || [];
        setChildren(list);
        const preselect = searchParams.get("anak");
        setStudentId(preselect || list[0]?.studentId || "");
      }
      if (lRes.success && lRes.data) {
        const d = lRes.data as { data?: Leave[]; totalPages?: number };
        setLeaves(d.data || (lRes.data as Leave[]) || []);
        setTotalPages(d.totalPages || 1);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const next = page + 1;
    const lRes = await getMyLeavesAction(next);
    if (lRes.success && lRes.data) {
      const d = lRes.data as { data?: Leave[]; totalPages?: number };
      const newLeaves = d.data || (lRes.data as Leave[]) || [];
      setLeaves((prev) => [...prev, ...newLeaves]);
      setTotalPages(d.totalPages || 1);
      setPage(next);
    }
  };

  useEffect(() => { fetchAll();   }, []);

  const canSubmit = useMemo(
    () => studentId && startDate && endDate && reason.trim().length >= 5 && !submitting,
    [studentId, startDate, endDate, reason, submitting],
  );

  const submit = async () => {
    if (!canSubmit) return;
    if (endDate < startDate) {
      toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createLeaveAction({ studentId, type, startDate, endDate, reason: reason.trim() });
      if (res.success) {
        toast.success("Pengajuan terkirim. Menunggu persetujuan sekolah.");
        setReason("");
        setStartDate(today());
        setEndDate(today());
        const lRes = await getMyLeavesAction();
        if (lRes.success && lRes.data) {
          const d = lRes.data as { data?: Leave[]; totalPages?: number };
          setLeaves(d.data || []);
          setPage(1);
          setTotalPages(d.totalPages || 1);
        }
      } else {
        toast.error(res.error || "Gagal mengirim pengajuan");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengirim pengajuan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Pengajuan Izin / Sakit</h1>
        <p className="text-sm text-muted-foreground">Ajukan ketidakhadiran anak; sekolah akan meninjau.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Buat Pengajuan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Anak</Label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            >
              {children.length === 0 && <option value="">Belum ada anak tertaut</option>}
              {children.map((c) => (
                <option key={c.studentId} value={c.studentId}>
                  {c.fullName} — {c.className || "-"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Jenis</Label>
            <div className="grid grid-cols-2 gap-2">
              {([["izin", "Izin", FileText], ["sakit", "Sakit", Stethoscope]] as const).map(([val, label, Icon]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setType(val)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    type === val ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mulai">Dari Tanggal</Label>
              <DateInput id="mulai" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="selesai">Sampai Tanggal</Label>
              <DateInput id="selesai" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alasan">Alasan</Label>
            <Textarea
              id="alasan"
              rows={3}
              placeholder="Contoh: demam sejak semalam, akan dibawa ke dokter."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </div>

          <Button className="w-full" onClick={submit} disabled={!canSubmit}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
            Kirim Pengajuan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Riwayat Pengajuan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {leaves.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Belum ada pengajuan.</p>
          ) : (
            <>
              {leaves.map((l) => (
                <div key={l.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{l.studentName} · {l.type === "sakit" ? "Sakit" : "Izin"}</p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[l.status] || STATUS_STYLE.pending)}>
                      {STATUS_LABEL[l.status] || l.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(l.startDate)}{l.endDate !== l.startDate ? ` – ${formatDate(l.endDate)}` : ""}
                  </p>
                  <p className="text-sm">{l.reason}</p>
                  {l.reviewNote && <p className="text-xs text-muted-foreground italic">Catatan sekolah: {l.reviewNote}</p>}
                  {l.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-7 text-xs text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Batalkan pengajuan ini?")) return;
                        const res = await cancelLeaveAction(l.id);
                        if (res.success) {
                          toast.success("Pengajuan dibatalkan");
                          setLeaves((prev) => prev.map((x) => x.id === l.id ? { ...x, status: "cancelled" } : x));
                        } else {
                          toast.error(res.error || "Gagal membatalkan");
                        }
                      }}
                    >
                      Batalkan
                    </Button>
                  )}
                </div>
              ))}
              {page < totalPages && (
                <button
                  onClick={loadMore}
                  className="w-full py-2.5 text-sm text-primary hover:underline"
                >
                  Muat lebih banyak
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
