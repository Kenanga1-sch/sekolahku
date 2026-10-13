"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, RefreshCw, X } from "lucide-react";
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
  listStations,
  listBookings,
  createComputerBooking,
  cancelComputerBooking,
  listReadingReports,
  bookingStatusLabel,
  type ComputerStation,
  type ReadingReport,
  type ComputerBooking,
} from "@/lib/computer";
import { formatDateTime } from "../komputer-helpers";

export function BookingsTab() {
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
