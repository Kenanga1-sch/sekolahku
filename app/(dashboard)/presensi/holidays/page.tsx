"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Pencil, Plus, Trash2, X, CalendarDays } from "lucide-react";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type Holiday = {
  id: string;
  date: string;
  title: string;
  description?: string;
  created_at: number;
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export default function HolidayManagementPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [nationalHolidays, setNationalHolidays] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Kalender multi-select
  const [selected, setSelected] = useState<Date[] | undefined>([]);
  const [month, setMonth] = useState<Date>(new Date());

  // Dialog simpan batch
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTitle, setBatchTitle] = useState("");
  const [batchDesc, setBatchDesc] = useState("");

  // Dialog edit libur tersimpan
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const savedDates = useMemo(
    () => new Map(holidays.map((h) => [h.date, h])),
    [holidays]
  );

  const fetchHolidays = useCallback(async () => {
    try {
      const [res, nat] = await Promise.all([
        goGet("/api/school-holidays"),
        goGet("/api/school-holidays/national"),
      ]);
      setHolidays(res?.data ?? res ?? []);
      setNationalHolidays(nat?.data ?? {});
    } catch {
      showError("Gagal memuat data hari libur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const selectedDates = useMemo(() => selected ?? [], [selected]);

  const isSunday = (d: Date) => d.getDay() === 0;

  const modifiers = useMemo(
    () => ({
      holiday: (d: Date) => savedDates.has(iso(d)),
      national: (d: Date) => !!nationalHolidays[iso(d)],
      sunday: (d: Date) => isSunday(d),
    }),
    [savedDates, nationalHolidays]
  );

  const modifiersClassNames = {
    holiday: "rdp-day_holiday",
    national: "rdp-day_national",
    sunday: "rdp-day_sunday",
  };

  const handleDayClick = (d: Date, modifiers: Record<string, boolean>) => {
    if (modifiers.holiday) {
      // Klik tanggal tersimpan -> buka dialog edit (bukan toggle seleksi)
      const h = savedDates.get(iso(d));
      if (h) {
        setEditing(h);
        setEditTitle(h.title);
        setEditDesc(h.description ?? "");
      }
    }
    // Tanggal lain: toggle ditangani onSelect mode="multiple"
  };

  const openBatchDialog = () => {
    if (selectedDates.length === 0) {
      showError("Pilih minimal satu tanggal di kalender terlebih dahulu");
      return;
    }
    setBatchTitle("");
    setBatchDesc("");
    setBatchOpen(true);
  };

  const handleBatchSave = async () => {
    const title = batchTitle.trim();
    if (!title) {
      showError("Judul wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        selectedDates.map((d) =>
          goPost("/api/school-holidays", {
            date: iso(d),
            title,
            description: batchDesc,
          })
        )
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;
      setSelected([]);
      setBatchOpen(false);
      await fetchHolidays();
      if (failed === 0) {
        showSuccess(`${ok} hari libur berhasil disimpan`);
      } else {
        showError(`${ok} tersimpan, ${failed} gagal (mungkin sudah terdaftar)`);
      }
    } catch {
      showError("Gagal menyimpan hari libur");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    const title = editTitle.trim();
    if (!title) {
      showError("Judul wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await goPut(`/api/school-holidays/${editing.id}`, {
        title,
        description: editDesc,
      });
      showSuccess("Hari libur berhasil diperbarui");
      setEditing(null);
      await fetchHolidays();
    } catch {
      showError("Gagal memperbarui hari libur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: Holiday) => {
    if (!confirm(`Hapus hari libur "${h.title}" (${h.date})?`)) return;
    try {
      await goDelete(`/api/school-holidays/${h.id}`);
      showSuccess("Hari libur berhasil dihapus");
      if (editing?.id === h.id) setEditing(null);
      await fetchHolidays();
    } catch {
      showError("Gagal menghapus hari libur");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Manajemen Hari Libur
          </h1>
          <p className="text-muted-foreground text-sm">
            Klik tanggal di kalender untuk menandai hari libur, lalu isi judul dan
            catatannya
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-col sm:flex-row gap-2">
            <CardTitle>Kalender</CardTitle>
            {selectedDates.length > 0 && (
              <Button size="sm" onClick={openBatchDialog} className="ml-auto">
                <Plus className="h-4 w-4 mr-2" />
                Simpan {selectedDates.length} Hari Libur
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Calendar
              mode="multiple"
              month={month}
              onMonthChange={setMonth}
              selected={selected}
              onSelect={setSelected}
              onDayClick={handleDayClick}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
            />
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[var(--radius-sm)] bg-primary" />
                Dipilih
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[var(--radius-sm)] bg-red-500/15 border border-red-500/30" />
                Hari libur tersimpan (klik untuk edit)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[var(--radius-sm)] bg-red-500/15 border border-red-500/30" />
                Minggu / tanggal merah nasional (otomatis libur)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 h-fit">
          <CardHeader>
            <CardTitle>Tanggal Terpilih ({selectedDates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada tanggal dipilih. Klik tanggal di kalender untuk
                memilihnya; klik lagi untuk membatalkan. Hari Minggu dan tanggal
                merah nasional tidak perlu dipilih karena sudah otomatis libur.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedDates.map((d) => (
                  <Badge key={iso(d)} variant="secondary" className="gap-1">
                    {format(d, "d MMM yyyy", { locale: localeId })}
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((prev) =>
                          (prev ?? []).filter((x) => iso(x) !== iso(d))
                        )
                      }
                      className="ml-0.5 hover:text-destructive"
                      aria-label={`Hapus ${iso(d)} dari seleksi`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {selectedDates.length > 0 && (
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={openBatchDialog} className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Simpan Hari Libur
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected([])}
                >
                  Bersihkan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Hari Libur</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={loading ? [] : holidays}
            getRowId={(h) => h.id}
            loading={loading}
            emptyTitle="Belum ada data hari libur"
            emptyDescription="Klik tanggal di kalender di atas untuk menambahkan hari libur pertama."
            actions={(h) => (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(h);
                    setEditTitle(h.title);
                    setEditDesc(h.description ?? "");
                  }}
                  aria-label={`Edit ${h.title}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(h)}
                  aria-label={`Hapus ${h.title}`}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            )}
            columns={[
              {
                key: "title",
                header: "Judul",
                card: "title",
                render: (h) => <span className="font-medium">{h.title}</span>,
              },
              {
                key: "date",
                header: "Tanggal",
                card: "field",
                render: (h) =>
                  format(new Date(h.date), "EEEE, d MMMM yyyy", {
                    locale: localeId,
                  }),
              },
              {
                key: "description",
                header: "Deskripsi",
                card: "field",
                render: (h) => h.description || "-",
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* Dialog simpan batch */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simpan {selectedDates.length} Hari Libur</DialogTitle>
            <DialogDescription>
              Satu judul dan catatan yang sama akan diterapkan ke semua tanggal
              terpilih. Catatan masih bisa diedit nanti.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-auto">
              {selectedDates.map((d) => (
                <Badge key={iso(d)} variant="outline">
                  {format(d, "d MMM yyyy", { locale: localeId })}
                </Badge>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Judul</Label>
              <Input
                autoFocus
                placeholder="Misal: Libur Semester, Cuti Bersama"
                value={batchTitle}
                onChange={(e) => setBatchTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan (Opsional)</Label>
              <Input
                placeholder="Untuk memperingati apa hari libur ini"
                value={batchDesc}
                onChange={(e) => setBatchDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleBatchSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog edit libur tersimpan */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hari Libur</DialogTitle>
            {editing && (
              <DialogDescription>
                {format(new Date(editing.date), "EEEE, d MMMM yyyy", {
                  locale: localeId,
                })}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Judul</Label>
              <Input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input
                placeholder="Untuk memperingati apa hari libur ini"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <div className="flex gap-2 sm:ml-auto">
              {editing && (
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(editing)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus
                </Button>
              )}
              <Button onClick={handleEditSave} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
