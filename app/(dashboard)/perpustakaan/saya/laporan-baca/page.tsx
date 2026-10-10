"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Monitor,
  Loader2,
  Plus,
  XCircle,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  createMyReadingReport,
  listMyReadingReports,
  listMyBookings,
  getMyQuota,
  reportStatusLabel,
  bookingStatusLabel,
  type ReadingReport,
  type ComputerBooking,
  type ComputerTimeQuota,
} from "@/lib/computer";

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

const EMPTY_FORM = {
  bookTitle: "",
  bookAuthor: "",
  summary: "",
  conclusion: "",
  question: "",
};

export default function LaporanBacaPage() {
  const [reports, setReports] = useState<ReadingReport[]>([]);
  const [bookings, setBookings] = useState<ComputerBooking[]>([]);
  const [quota, setQuota] = useState<ComputerTimeQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, b, q] = await Promise.all([
        listMyReadingReports(),
        listMyBookings(),
        getMyQuota(),
      ]);
      setReports(r);
      setBookings(b);
      setQuota(q);
    } catch {
      showError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canSubmit =
    form.bookTitle.trim() &&
    form.summary.trim() &&
    form.conclusion.trim() &&
    form.question.trim();

  const handleSubmit = async () => {
    if (!canSubmit) {
      showError("Judul, ringkasan, kesimpulan, dan pertanyaan wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await createMyReadingReport(form);
      showSuccess("Laporan terkirim. Menunggu verifikasi guru.");
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (e: any) {
      showError(e?.message || "Gagal mengirim laporan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Link href="/perpustakaan">
          <Button variant="ghost" size="icon" aria-label="Kembali">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Komputer Belajar</h1>
          <p className="text-muted-foreground text-sm">
            Tulis laporan baca untuk mendapat jatah waktu memakai komputer.
          </p>
        </div>
      </div>

      {/* Kuota */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Gauge className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Sisa kuota waktu</p>
              <p className="text-2xl font-bold">
                {quota?.remainingMinutes ?? 0}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / {quota?.totalMinutes ?? 0} menit
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jadwal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="h-5 w-5" /> Jadwal Komputer Saya
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Belum ada jadwal. Setelah laporanmu disetujui, guru akan menjadwalkanmu.
            </p>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 border rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium">{b.stationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(b.slotStart)} · {b.plannedMinutes} menit
                    </p>
                  </div>
                  <Badge variant={b.status === "active" ? "default" : "outline"}>
                    {bookingStatusLabel(b.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Laporan */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Laporan Baca
          </CardTitle>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Tulis
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Belum ada laporan. Tekan &quot;Tulis&quot; setelah selesai membaca buku.
            </p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium truncate">{r.bookTitle}</p>
                    <Badge
                      variant={
                        r.status === "approved"
                          ? "default"
                          : r.status === "rejected"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {r.status === "approved" ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : r.status === "rejected" ? (
                        <XCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {reportStatusLabel(r.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {r.summary}
                  </p>
                  {r.reviewNotes && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                      Catatan guru: {r.reviewNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tulis Laporan Baca</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="lr-title">Judul buku *</Label>
              <Input
                id="lr-title"
                value={form.bookTitle}
                onChange={(e) => setForm({ ...form, bookTitle: e.target.value })}
                aria-invalid={!form.bookTitle.trim()}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="lr-author">Penulis (opsional)</Label>
              <Input
                id="lr-author"
                value={form.bookAuthor}
                onChange={(e) => setForm({ ...form, bookAuthor: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lr-summary">Ceritakan kembali isi buku *</Label>
              <Textarea
                id="lr-summary"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="Ringkas isi/cara cerita buku dengan bahasamu sendiri…"
                aria-invalid={!form.summary.trim()}
              />
            </div>
            <div>
              <Label htmlFor="lr-conclusion">Kesimpulan *</Label>
              <Textarea
                id="lr-conclusion"
                value={form.conclusion}
                onChange={(e) => setForm({ ...form, conclusion: e.target.value })}
                placeholder="Apa kesimpulan/pelajaran yang kamu dapat?"
                aria-invalid={!form.conclusion.trim()}
              />
            </div>
            <div>
              <Label htmlFor="lr-question">Pertanyaan tentang bacaan *</Label>
              <Textarea
                id="lr-question"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="Tulis pertanyaan yang masih ingin kamu tanyakan…"
                aria-invalid={!form.question.trim()}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
