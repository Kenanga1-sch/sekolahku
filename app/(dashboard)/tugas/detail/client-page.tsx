"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Box,
  Clock,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  archiveTugas,
  deleteTugas,
  deadlineLabel,
  formatDate,
  getTugas,
  listTugasRoster,
  listTugasSubmissions,
  remindTugas,
  MY_STATUS_LABEL,
  type Tugas,
  type TugasRosterItem,
  type TugasSubmission,
} from "@/lib/tugas";
import { TugasFormDialog } from "../_components/tugas-form-dialog";
import { GradingDialog } from "../_components/grading-dialog";

export function TugasDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id") || "";

  const [tugas, setTugas] = useState<Tugas | null>(null);
  const [roster, setRoster] = useState<TugasRosterItem[]>([]);
  const [submissions, setSubmissions] = useState<TugasSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [gradeTarget, setGradeTarget] = useState<TugasSubmission | null>(null);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [t, r, subs] = await Promise.all([
        getTugas(id),
        listTugasRoster(id),
        listTugasSubmissions(id),
      ]);
      setTugas(t || null);
      setRoster(r);
      setSubmissions(subs);
    } catch {
      showError("Gagal memuat detail tugas");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const subByStudent = new Map<string, TugasSubmission>();
  submissions.forEach((s) => subByStudent.set(s.studentId, s));

  const handleArchive = async (archived: boolean) => {
    if (!tugas) return;
    setBusy(true);
    try {
      await archiveTugas(tugas.id, archived);
      showSuccess(archived ? "Tugas diarsipkan" : "Tugas dipublikasikan kembali");
      fetchData();
    } catch (err: any) {
      showError(err?.message || "Gagal mengubah status tugas");
    } finally {
      setBusy(false);
    }
  };

  const handleRemind = async () => {
    if (!tugas) return;
    setBusy(true);
    try {
      const n = await remindTugas(tugas.id);
      showSuccess(n > 0 ? `Pengingat terkirim ke ${n} siswa` : "Semua siswa sudah mengumpulkan");
    } catch (err: any) {
      showError(err?.message || "Gagal mengirim pengingat");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!tugas) return;
    setBusy(true);
    try {
      await deleteTugas(tugas.id);
      showSuccess("Tugas dihapus");
      router.push("/tugas");
    } catch (err: any) {
      showError(err?.message || "Gagal menghapus tugas");
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!tugas) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="text-5xl">🔍</span>
        <p className="font-semibold text-slate-700 dark:text-slate-200">Tugas tidak ditemukan</p>
        <Button variant="outline" onClick={() => router.push("/tugas")}>
          Kembali ke daftar tugas
        </Button>
      </div>
    );
  }

  const submitted = tugas.submittedCount || 0;
  const total = tugas.totalStudents || 0;
  const archived = tugas.status === "archived";

  const columns: Column<TugasRosterItem>[] = [
    {
      key: "studentName",
      header: "Siswa",
      card: "title",
      render: (r) => <span className="font-medium text-slate-800 dark:text-slate-100">{r.studentName}</span>,
    },
    {
      key: "status",
      header: "Status",
      card: "field",
      render: (r) => {
        const badge = MY_STATUS_LABEL[r.status || ""];
        return (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
        );
      },
    },
    {
      key: "submittedAt",
      header: "Waktu Kumpul",
      hideBelowSm: true,
      card: "field",
      render: (r) => (
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          {r.submittedAt ? (
            <>
              <span>{formatDate(r.submittedAt)}</span>
              {r.isLate && <span className="rounded bg-rose-100 px-1.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">Terlambat</span>}
            </>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: "score",
      header: "Nilai",
      hideBelowSm: true,
      card: "field",
      render: (r) =>
        r.score != null ? (
          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{r.score}</span>
        ) : (
          <span className="text-slate-400">Belum dinilai</span>
        ),
    },
    {
      key: "action",
      header: "Aksi",
      card: "field",
      render: (r) => {
        const sub = subByStudent.get(r.studentId);
        if (!sub) return <span className="text-xs text-slate-400">Belum mengumpulkan</span>;
        return (
          <Button
            size="sm"
            variant={sub.status === "graded" ? "outline" : "default"}
            onClick={(e) => {
              e.stopPropagation();
              setGradeTarget(sub);
              setGradeOpen(true);
            }}
          >
            {sub.status === "graded" ? "Lihat/Ubah Nilai" : "Nilai"}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <button
        onClick={() => router.push("/tugas")}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-blue-600 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar tugas
      </button>

      {/* Header tugas */}
      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{tugas.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Box className="h-3.5 w-3.5" /> {tugas.subjectName || "Tanpa mapel"}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {tugas.className || "Kelas"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {deadlineLabel(tugas.dueAt)}
                </span>
              </p>
            </div>
            {archived ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Diarsipkan
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                Aktif
              </span>
            )}
          </div>

          {tugas.description && (
            <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-200">
              {tugas.description}
            </div>
          )}

          {tugas.attachmentUrl && (
            <a
              href={tugas.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-blue-400 dark:hover:bg-blue-950/20"
            >
              <FileText className="h-4 w-4" />
              {tugas.attachmentName || "Lampiran tugas"}
            </a>
          )}

          {/* Statistik pengumpulan */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 rounded-lg border border-slate-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Terkumpul</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {submitted}<span className="text-sm font-normal text-slate-400">/{total} siswa</span>
              </p>
            </div>
            <div className="flex-1 rounded-lg border border-slate-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Sudah dinilai</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {tugas.gradedCount || 0}<span className="text-sm font-normal text-slate-400">/{total} siswa</span>
              </p>
            </div>
            <div className="flex-1 rounded-lg border border-slate-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum kumpul</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {Math.max(0, total - submitted)}
                <span className="text-sm font-normal text-slate-400">/{total} siswa</span>
              </p>
            </div>
          </div>

          {/* Toolbar aksi */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setGradeTarget(null);
                setFormOpen(true);
              }}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
            {!archived && (
              <Button size="sm" variant="outline" onClick={handleRemind} disabled={busy}>
                {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Bell className="mr-1 h-3.5 w-3.5" />}
                Ingatkan
              </Button>
            )}
            {archived ? (
              <Button size="sm" variant="outline" onClick={() => handleArchive(false)} disabled={busy}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Publikasikan
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => handleArchive(true)} disabled={busy}>
                <Archive className="mr-1 h-3.5 w-3.5" /> Arsipkan
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-rose-600 hover:bg-rose-50" onClick={() => setDeleteOpen(true)} disabled={busy}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Roster pengumpulan */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-4 w-4 text-slate-500" /> Status Pengumpulan Siswa
        </h2>
        {roster.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Tidak ada siswa aktif di kelas ini.
            </CardContent>
          </Card>
        ) : (
          <DataTable
            data={roster}
            columns={columns}
            getRowId={(r) => r.studentId}
            emptyTitle="Belum ada siswa"
            emptyDescription="Roster kelas akan muncul di sini."
          />
        )}
      </div>

      <TugasFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tugas={tugas}
        onSaved={() => fetchData()}
      />

      <GradingDialog
        open={gradeOpen}
        onOpenChange={setGradeOpen}
        submission={gradeTarget}
        tugasId={tugas.id}
        onSaved={() => fetchData()}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tugas?</AlertDialogTitle>
            <AlertDialogDescription>
              Tugas &quot;{tugas.title}&quot; beserta semua pengumpulan siswa akan dihapus.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
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

export default TugasDetailClient;
