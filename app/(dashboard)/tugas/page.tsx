"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { showError, showSuccess } from "@/lib/toast";
import {
  deleteTugas,
  listTugas,
  deadlineLabel,
  type Tugas,
} from "@/lib/tugas";
import { TugasFormDialog } from "./_components/tugas-form-dialog";

type StatusFilter = "all" | "published" | "archived";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "published", label: "Aktif" },
  { value: "all", label: "Semua" },
  { value: "archived", label: "Diarsipkan" },
];

export default function TugasPage() {
  const router = useRouter();
  const [list, setList] = useState<Tugas[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("published");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tugas | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tugas | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data } = await listTugas({ status: filter, q: search });
      setList(data);
    } catch {
      showError("Gagal memuat daftar tugas");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (t: Tugas) => {
    setEditTarget(t);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTugas(deleteTarget.id);
      showSuccess("Tugas dihapus");
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      showError(err?.message || "Gagal menghapus tugas");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Tugas>[] = [
    {
      key: "title",
      header: "Judul",
      card: "title",
      render: (t) => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{t.title}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {t.subjectName || "Tanpa mapel"} · {t.className || "Kelas"}
          </p>
        </div>
      ),
    },
    {
      key: "dueAt",
      header: "Batas Waktu",
      sortable: true,
      hideBelowSm: true,
      card: "field",
      render: (t) => (
        <span className="text-sm text-slate-600 dark:text-slate-300">{deadlineLabel(t.dueAt)}</span>
      ),
    },
    {
      key: "progress",
      header: "Pengumpulan",
      sortable: true,
      card: "field",
      render: (t) => {
        const total = t.totalStudents || 0;
        const done = t.submittedCount || 0;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm tabular-nums">
              {done}/{total}
            </span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            {(t.gradedCount || 0) > 0 && (
              <span className="text-xs text-slate-400">· {t.gradedCount} dinilai</span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      card: "field",
      render: (t) =>
        t.status === "archived" ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Diarsipkan
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            Aktif
          </span>
        ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <NotebookPen className="text-blue-600" /> Tugas &amp; PR
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Berikan tugas kepada siswa di kelas yang Anda walai.
          </p>
        </div>
        <Button
          className="rounded-full"
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          Buat Tugas
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full border border-slate-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                filter === f.value
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari judul tugas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-5xl">📝</span>
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              {filter === "archived" ? "Tidak ada tugas diarsipkan" : "Belum ada tugas"}
            </p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {filter === "archived"
                ? "Tugas yang diarsipkan akan muncul di sini."
                : "Buat tugas pertama untuk siswa di kelas Anda."}
            </p>
            {filter !== "archived" && (
              <Button
                className="rounded-full"
                onClick={() => {
                  setEditTarget(null);
                  setFormOpen(true);
                }}
              >
                Buat Tugas
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <DataTable
          data={list}
          columns={columns}
          getRowId={(t) => t.id}
          onRowClick={(t) => router.push(`/tugas/detail?id=${t.id}`)}
          onEdit={handleEdit}
          onDelete={(t) => setDeleteTarget(t)}
          emptyTitle="Tidak ada tugas"
          emptyDescription="Coba ubah filter atau kata kunci pencarian."
        />
      )}

      <TugasFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tugas={editTarget}
        onSaved={() => fetchData()}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tugas?</AlertDialogTitle>
            <AlertDialogDescription>
              Tugas &quot;{deleteTarget?.title}&quot; beserta semua pengumpulan siswa akan dihapus.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
