"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/toast";
import {
  listReadingReports,
  reviewReadingReport,
  reportStatusLabel,
  type ReadingReport,
} from "@/lib/computer";

export function ReportsTab() {
  const [reports, setReports] = useState<ReadingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [reviewing, setReviewing] = useState<ReadingReport | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await listReadingReports(filter || undefined));
    } catch {
      showError("Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (r: ReadingReport) => {
    setBusy(true);
    try {
      await reviewReadingReport(r.id, true);
      showSuccess("Laporan disetujui");
      load();
    } catch (e: any) {
      showError(e?.message || "Gagal menyetujui");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!reviewing) return;
    setBusy(true);
    try {
      await reviewReadingReport(reviewing.id, false, rejectNotes);
      showSuccess("Laporan ditolak");
      setReviewing(null);
      setRejectNotes("");
      load();
    } catch (e: any) {
      showError(e?.message || "Gagal menolak");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">Laporan Baca</CardTitle>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="pending">Menunggu</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
          <option value="">Semua</option>
        </select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Tidak ada laporan.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {r.studentName}{" "}
                      <span className="text-muted-foreground font-normal">({r.className})</span>
                    </p>
                    <p className="text-sm">
                      Buku: <span className="font-medium">{r.bookTitle}</span>
                      {r.bookAuthor ? ` — ${r.bookAuthor}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      r.status === "approved"
                        ? "default"
                        : r.status === "rejected"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {reportStatusLabel(r.status)}
                  </Badge>
                </div>
                <div className="text-sm space-y-1 bg-muted/40 rounded p-3">
                  <p>
                    <span className="font-medium">Ringkasan:</span> {r.summary}
                  </p>
                  <p>
                    <span className="font-medium">Kesimpulan:</span> {r.conclusion}
                  </p>
                  <p>
                    <span className="font-medium">Pertanyaan:</span> {r.question}
                  </p>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(r)} disabled={busy}>
                      <Check className="h-4 w-4 mr-1" /> Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReviewing(r)}
                      disabled={busy}
                    >
                      <X className="h-4 w-4 mr-1" /> Tolak
                    </Button>
                  </div>
                )}
                {r.reviewNotes && (
                  <p className="text-xs text-muted-foreground">Catatan: {r.reviewNotes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Laporan</DialogTitle>
          </DialogHeader>
          <Label htmlFor="rej-notes">Alasan / catatan untuk siswa</Label>
          <Textarea
            id="rej-notes"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="Misalnya: kesimpulan belum sesuai isi buku."
          />
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={reject} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
