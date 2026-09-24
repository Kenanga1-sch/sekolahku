"use client";

/**
 * PengajuanIzinTab — konten "Pengajuan Izin / Sakit".
 *
 * Dipakai dua tempat: sebagai tab di halaman Presensi, dan sebagai halaman
 * mandiri di /presensi/pengajuan (agar tautan notifikasi push lama tetap
 * berfungsi). Karena itu header judul bisa disembunyikan via `hideHeader`
 * ketika ditampilkan sebagai tab (judul sudah ada di induk).
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { listLeavesAction, reviewLeaveAction } from "@/actions/parent";

interface Leave {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  parentName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  reviewNote?: string | null;
}

const FILTERS = [
  { id: "pending", label: "Menunggu" },
  { id: "approved", label: "Disetujui" },
  { id: "rejected", label: "Ditolak" },
  { id: "", label: "Semua" },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const formatDate = (d: string) => {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
};

export function PengajuanIzinTab({ hideHeader = false }: { hideHeader?: boolean }) {
  const [filter, setFilter] = useState("pending");
  const [items, setItems] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await listLeavesAction(status || undefined);
      if (res.success && res.data) {
        // handleAction membungkus response backend {success, data}; payload
        // array asli berada di res.data.data.
        const d = res.data as { data?: Leave[] };
        setItems(d.data || (res.data as Leave[]) || []);
      } else if (!res.success) {
        toast.error(res.error || "Gagal memuat pengajuan");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const review = async (id: string, status: "approved" | "rejected", note?: string) => {
    setBusyId(id);
    try {
      const res = await reviewLeaveAction(id, status, note);
      if (res.success) {
        toast.success(status === "approved" ? "Pengajuan disetujui — presensi ditandai otomatis" : "Pengajuan ditolak");
        setRejectId(null);
        setRejectNote("");
        await load(filter);
      } else {
        toast.error(res.error || "Gagal memproses");
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hideHeader && (
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pengajuan Izin / Sakit</h1>
            <p className="text-sm text-muted-foreground">Tinjau pengajuan orang tua. Persetujuan menandai presensi otomatis.</p>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => load(filter)} disabled={loading} className="ml-auto">
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id || "semua"}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              filter === f.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Tidak ada pengajuan.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{l.studentName} <span className="text-muted-foreground font-normal text-sm">· {l.className || "-"}</span></p>
                    <p className="text-xs text-muted-foreground">
                      {l.type === "sakit" ? "Sakit" : "Izin"} · {formatDate(l.startDate)}{l.endDate !== l.startDate ? ` – ${formatDate(l.endDate)}` : ""} · dari {l.parentName || "Orang tua"}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", STATUS_STYLE[l.status] || STATUS_STYLE.pending)}>
                    {l.status}
                  </span>
                </div>
                <p className="text-sm">{l.reason}</p>
                {l.reviewNote && <p className="text-xs text-muted-foreground italic">Catatan: {l.reviewNote}</p>}

                {l.status === "pending" && (
                  rejectId === l.id ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Alasan penolakan (opsional)"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setRejectId(null); setRejectNote(""); }} disabled={busyId === l.id}>Batal</Button>
                        <Button variant="destructive" size="sm" onClick={() => review(l.id, "rejected", rejectNote)} disabled={busyId === l.id}>
                          {busyId === l.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                          Tolak
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => review(l.id, "approved")} disabled={busyId === l.id}>
                        {busyId === l.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Setujui
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRejectId(l.id)} disabled={busyId === l.id}>
                        <X className="mr-2 h-4 w-4" /> Tolak
                      </Button>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
