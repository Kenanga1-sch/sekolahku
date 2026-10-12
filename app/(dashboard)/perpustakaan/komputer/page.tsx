"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Monitor,
  CalendarPlus,
  ClipboardCheck,
  Gauge,
  History,
  Loader2,
  Plus,
  Trash2,
  Check,
  X,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/toast";
import {
  listStations,
  createStation,
  deleteStation,
  listQuotaPolicies,
  setQuotaPolicy,
  listQuotas,
  setStudentQuota,
  listReadingReports,
  reviewReadingReport,
  listBookings,
  createComputerBooking,
  cancelComputerBooking,
  listSessions,
  bookingStatusLabel,
  reportStatusLabel,
  type ComputerStation,
  type QuotaPolicy,
  type ComputerTimeQuota,
  type ReadingReport,
  type ComputerBooking,
  type ComputerSession,
} from "@/lib/computer";

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function KomputerPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Link href="/perpustakaan" className="shrink-0">
          <Button variant="ghost" size="icon" aria-label="Kembali ke perpustakaan">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">Komputer Belajar</h1>
          <p className="text-muted-foreground text-sm">
            Kelola jadwal, kuota, dan verifikasi laporan baca siswa.
          </p>
        </div>
      </div>

      <Tabs defaultValue="stations" className="space-y-4">
        <TabsList className="w-full h-auto justify-start gap-1 overflow-x-auto scrollbar-none whitespace-nowrap sm:grid sm:grid-cols-5">
          <TabsTrigger value="stations" className="gap-1.5 shrink-0">
            <Monitor className="h-4 w-4" /> Komputer
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5 shrink-0">
            <CalendarPlus className="h-4 w-4" /> Jadwal
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 shrink-0">
            <ClipboardCheck className="h-4 w-4" /> Laporan
          </TabsTrigger>
          <TabsTrigger value="quotas" className="gap-1.5 shrink-0">
            <Gauge className="h-4 w-4" /> Kuota
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 shrink-0">
            <History className="h-4 w-4" /> Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stations">
          <StationsTab />
        </TabsContent>
        <TabsContent value="bookings">
          <BookingsTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="quotas">
          <QuotasTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ================= Komputer (stasiun) =================

function StationsTab() {
  const [stations, setStations] = useState<ComputerStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", location: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStations(await listStations());
    } catch {
      showError("Gagal memuat daftar komputer");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      showError("Kode dan nama komputer wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await createStation({ ...form, status: "active" });
      showSuccess("Komputer ditambahkan");
      setDialogOpen(false);
      setForm({ code: "", name: "", location: "" });
      load();
    } catch (e: any) {
      showError(e?.message || "Gagal menambah komputer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus komputer "${name}"?`)) return;
    try {
      await deleteStation(id);
      showSuccess("Komputer dihapus");
      load();
    } catch {
      showError("Gagal menghapus komputer");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">Daftar Komputer</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : stations.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">
            Belum ada komputer. Tambahkan unit pertama.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((s) => (
              <div key={s.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    aria-label={`Hapus ${s.name}`}
                    onClick={() => handleDelete(s.id, s.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {s.location && <p className="text-sm text-muted-foreground">{s.location}</p>}
                {s.activeSession ? (
                  <Badge className="bg-blue-600">
                    Dipakai: {s.activeSession.studentName}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    Tersedia
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Komputer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="st-code">Kode unik</Label>
              <Input
                id="st-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="PC-01"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dipakai di URL kiosk komputer ini: /kiosk-komputer?station=PC-01
              </p>
            </div>
            <div>
              <Label htmlFor="st-name">Nama tampilan</Label>
              <Input
                id="st-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Komputer 1"
              />
            </div>
            <div>
              <Label htmlFor="st-loc">Lokasi (opsional)</Label>
              <Input
                id="st-loc"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ruang Perpustakaan"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ================= Jadwal / booking =================

function BookingsTab() {
  const [bookings, setBookings] = useState<ComputerBooking[]>([]);
  const [stations, setStations] = useState<ComputerStation[]>([]);
  const [reports, setReports] = useState<ReadingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    stationId: "",
    reportId: "",
    slotStart: "",
    plannedMinutes: 30,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s, r] = await Promise.all([
        listBookings(),
        listStations(),
        listReadingReports("approved"),
      ]);
      setBookings(b);
      setStations(s);
      setReports(r);
    } catch {
      showError("Gagal memuat jadwal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedReport = reports.find((r) => r.id === form.reportId);

  const handleCreate = async () => {
    if (!form.stationId || !form.reportId || !form.slotStart) {
      showError("Komputer, laporan baca, dan waktu mulai wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await createComputerBooking({
        stationId: form.stationId,
        studentId: selectedReport!.studentId,
        reportId: form.reportId,
        slotStart: new Date(form.slotStart).toISOString(),
        plannedMinutes: Number(form.plannedMinutes) || 30,
        notes: form.notes,
      });
      showSuccess("Jadwal dibuat");
      setDialogOpen(false);
      setForm({ stationId: "", reportId: "", slotStart: "", plannedMinutes: 30, notes: "" });
      load();
    } catch (e: any) {
      showError(e?.message || "Gagal membuat jadwal");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Batalkan jadwal ini?")) return;
    try {
      await cancelComputerBooking(id);
      showSuccess("Jadwal dibatalkan");
      load();
    } catch {
      showError("Gagal membatalkan jadwal");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">Jadwal Penggunaan</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Booking
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Belum ada jadwal.</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-lg p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {b.studentName} <span className="text-muted-foreground">·</span> {b.stationName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(b.slotStart)} — {b.plannedMinutes} menit
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={b.status === "active" ? "default" : "outline"}>
                    {bookingStatusLabel(b.status)}
                  </Badge>
                  {(b.status === "booked" || b.status === "active") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      aria-label="Batalkan jadwal"
                      onClick={() => handleCancel(b.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Komputer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bk-report">Laporan baca (disetujui)</Label>
              <select
                id="bk-report"
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={form.reportId}
                onChange={(e) => setForm({ ...form, reportId: e.target.value })}
              >
                <option value="">Pilih laporan…</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.studentName} ({r.className}) — {r.bookTitle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="bk-station">Komputer</Label>
              <select
                id="bk-station"
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={form.stationId}
                onChange={(e) => setForm({ ...form, stationId: e.target.value })}
              >
                <option value="">Pilih komputer…</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="bk-start">Waktu mulai</Label>
              <Input
                id="bk-start"
                type="datetime-local"
                value={form.slotStart}
                onChange={(e) => setForm({ ...form, slotStart: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bk-min">Durasi (menit)</Label>
              <Input
                id="bk-min"
                type="number"
                min={5}
                value={form.plannedMinutes}
                onChange={(e) => setForm({ ...form, plannedMinutes: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="bk-notes">Catatan (opsional)</Label>
              <Textarea
                id="bk-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ================= Verifikasi laporan =================

function ReportsTab() {
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

// ================= Kuota =================

function QuotasTab() {
  const [policies, setPolicies] = useState<QuotaPolicy[]>([]);
  const [quotas, setQuotas] = useState<ComputerTimeQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [editStudent, setEditStudent] = useState<ComputerTimeQuota | null>(null);
  const [editMinutes, setEditMinutes] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, q] = await Promise.all([listQuotaPolicies(), listQuotas()]);
      setPolicies(p);
      setQuotas(q);
    } catch {
      showError("Gagal memuat kuota");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePolicy = async () => {
    try {
      await setQuotaPolicy(cls, minutes);
      showSuccess("Kebijakan kuota disimpan");
      setCls("");
      setMinutes(60);
      load();
    } catch {
      showError("Gagal menyimpan kebijakan");
    }
  };

  const saveStudent = async () => {
    if (!editStudent) return;
    try {
      await setStudentQuota(editStudent.studentId, editMinutes);
      showSuccess("Kuota siswa disimpan");
      setEditStudent(null);
      load();
    } catch {
      showError("Gagal menyimpan kuota siswa");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Jatah Menit per Kelas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Kosongkan nama kelas untuk jatah <span className="font-medium">default</span> semua kelas.
            Siswa baru otomatis mendapat jatah ini.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <Label htmlFor="q-cls">Kelas</Label>
              <Input
                id="q-cls"
                value={cls}
                onChange={(e) => setCls(e.target.value)}
                placeholder="(default) atau VII-A"
              />
            </div>
            <div className="w-full sm:w-32">
              <Label htmlFor="q-min">Menit</Label>
              <Input
                id="q-min"
                type="number"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </div>
            <Button onClick={savePolicy} className="w-full sm:w-auto">Simpan</Button>
          </div>
          {policies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {policies.map((p) => (
                <Badge key={p.className || "__default"} variant="secondary">
                  {p.className || "Default"}: {p.minutes} menit
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kuota per Siswa</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : quotas.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              Belum ada kuota siswa. Atur jatah kelas di atas.
            </p>
          ) : (
            <div className="space-y-2">
              {quotas.map((q) => (
                <div
                  key={q.studentId}
                  className="flex items-center justify-between gap-2 border rounded-lg p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{q.studentName || q.studentId}</p>
                    <p className="text-xs text-muted-foreground">{q.className || "-"}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm">
                      <span className="font-semibold text-green-700">{q.remainingMinutes}</span>
                      <span className="text-muted-foreground"> / {q.totalMinutes} menit</span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditStudent(q);
                        setEditMinutes(q.totalMinutes);
                      }}
                    >
                      Atur
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editStudent} onOpenChange={(o) => !o && setEditStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur Kuota {editStudent?.studentName}</DialogTitle>
          </DialogHeader>
          <Label htmlFor="es-min">Total jatah menit</Label>
          <Input
            id="es-min"
            type="number"
            min={0}
            value={editMinutes}
            onChange={(e) => setEditMinutes(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Terpakai saat ini: {editStudent?.usedMinutes} menit.
          </p>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditStudent(null)}>
              Batal
            </Button>
            <Button onClick={saveStudent}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ================= Riwayat =================

function HistoryTab() {
  const [sessions, setSessions] = useState<ComputerSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await listSessions());
    } catch {
      showError("Gagal memuat riwayat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalMinutes = sessions.reduce((acc, s) => acc + s.minutesUsed, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">Riwayat Pemakaian</CardTitle>
        <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Belum ada pemakaian.</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 text-center">
              <div className="border rounded-lg p-3">
                <div className="text-2xl font-bold">{sessions.length}</div>
                <div className="text-xs text-muted-foreground">Total Sesi</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-2xl font-bold">{totalMinutes}</div>
                <div className="text-xs text-muted-foreground">Total Menit</div>
              </div>
            </div>
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 border rounded-lg p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {s.studentName} <span className="text-muted-foreground">·</span> {s.stationName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(s.startedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" /> {s.minutesUsed} mnt
                    </Badge>
                    {s.endReason === "time_up" && (
                      <Badge variant="destructive">Waktu habis</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
