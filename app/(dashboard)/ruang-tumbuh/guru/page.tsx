"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Sprout, Users, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { goGet, goPost } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ScreeningGame, ScreeningSession } from "@/lib/ruang-tumbuh/types";
import { IMPLEMENTED_GAME_IDS } from "@/lib/ruang-tumbuh/observasi";

// Sama dengan isStaffOrAdmin di backend (skrining_handler.go:39).
const STAFF_ADMIN_ROLES = ["superadmin", "admin", "staff"];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Belum dimulai", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  active: { label: "Berlangsung", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  finished: { label: "Selesai", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" },
  cancelled: { label: "Dibatalkan", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300" },
};

const GAME_ICON: Record<string, string> = {
  "game-tangkap-target": "🎣",
  "game-jangan-terkecoh": "🛡️",
  "game-ingat-urutannya": "🧠",
  "game-kereta-kata": "📖",
  "game-toko-buah": "🍎",
};

export default function GuruRuangTumbuhPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isStaffAdmin = STAFF_ADMIN_ROLES.includes((user?.role || "").toLowerCase());
  const [sessions, setSessions] = useState<ScreeningSession[]>([]);
  const [games, setGames] = useState<ScreeningGame[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ gameId: "", title: "", classId: "" });

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, gameRes]: any[] = await Promise.all([
        goGet(`/api/ruang-tumbuh/sessions`),
        goGet(`/api/ruang-tumbuh/games`),
      ]);
      setSessions(sessRes?.data || []);
      setGames(gameRes?.data || []);
      // Staff/admin tidak terikat ke kelas wali — mereka memilih kelas saat
      // membuat sesi. Ambun daftar kelas aktif untuk picker.
      if (isStaffAdmin) {
        try {
          const clsRes: any = await goGet(`/api/academic/classes`);
          setClasses(clsRes?.data || clsRes || []);
        } catch {
          setClasses([]);
        }
      }
    } catch {
      showError("Gagal memuat data skrining");
    } finally {
      setLoading(false);
    }
  }, [isStaffAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!form.gameId) {
      showError("Pilih jenis skrining dulu");
      return;
    }
    if (isStaffAdmin && !form.classId) {
      showError("Pilih kelas terlebih dahulu");
      return;
    }
    setCreating(true);
    try {
      // Staff/admin menentukan kelas via query classId (backend:
      // skrining_handler.go:141). Guru wali tidak perlu — backend ambil
      // kelas wali-nya otomatis.
      const base = `/api/ruang-tumbuh/sessions`;
      const url = isStaffAdmin && form.classId
        ? `${base}?classId=${encodeURIComponent(form.classId)}`
        : base;
      await goPost(url, {
        gameId: form.gameId,
        title: form.title.trim(),
        notes: "",
      });
      showSuccess("Sesi skrining berhasil dibuat");
      setOpen(false);
      setForm({ gameId: "", title: "", classId: "" });
      fetchData();
    } catch (e) {
      // Tampilkan alasan sebenarnya dari backend (mis. "Anda bukan wali
      // kelas manapun") alih-alih toast generik.
      showError(e instanceof Error ? e.message : "Gagal membuat sesi");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sprout className="text-emerald-600" /> Skrining & Perkembangan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sesi skrining untuk kelas yang Anda walai.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full">
              <Plus className="mr-1 h-4 w-4" /> Buat Sesi
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Sesi Skrining</DialogTitle>
              <DialogDescription>
                {isStaffAdmin
                  ? "Pilih kelas yang akan diskrining — sesi berlaku untuk seluruh siswa aktif di kelas tersebut."
                  : "Sesi berlaku untuk seluruh siswa aktif di kelas Anda saat ini."}
              </DialogDescription>
            </DialogHeader>
            {isStaffAdmin && (
              <div className="space-y-2">
                <Label htmlFor="class">Kelas <span className="text-rose-500">*</span></Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {classes.length === 0 ? (
                    <p className="col-span-full text-sm text-slate-500">
                      Tidak ada kelas aktif. Tambahkan kelas di Manajemen Siswa terlebih dahulu.
                    </p>
                  ) : (
                    classes.map((cls) => (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, classId: cls.id }))}
                        className={`rounded-xl border p-2.5 text-sm font-medium transition ${
                          form.classId === cls.id
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                            : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        }`}
                      >
                        {cls.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="game">Jenis Skrining</Label>
                <div className="space-y-2">
                  {games.map((g) => {
                    const ready = IMPLEMENTED_GAME_IDS.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={!ready}
                        onClick={() => setForm((f) => ({ ...f, gameId: g.id }))}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                          form.gameId === g.id
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                            : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        } ${ready ? "" : "cursor-not-allowed opacity-60"}`}
                      >
                        <span className="text-2xl">{GAME_ICON[g.id] || "🎮"}</span>
                        <div className="flex-1">
                          <p className="font-medium">{g.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{g.description}</p>
                        </div>
                        {!ready && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Segera
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Judul Sesi (opsional)</Label>
                <Input
                  id="title"
                  placeholder="mis. Skrining Perhatian — September 2026"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !form.gameId || (isStaffAdmin && !form.classId)}
              >
                {creating ? "Membuat…" : "Buat Sesi"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {activeCount > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              <b>{activeCount} sesi sedang berlangsung.</b> Siswa dapat mulai mengerjakan kapan saja sampai Anda menekan Selesai.
            </p>
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-5xl">🌱</span>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Belum ada sesi skrining</p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Buat sesi pertama untuk mulai mengumpulkan data perkembangan siswa kelas Anda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => {
            const badge = STATUS_BADGE[s.status] || STATUS_BADGE.pending;
            const pct = s.totalStudents ? Math.round((s.completedCount || 0) / s.totalStudents * 100) : 0;
            return (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/ruang-tumbuh/guru/sesi?id=${s.id}`)}
                className="w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{GAME_ICON[s.gameId] || "🎮"}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {s.title || `${s.gameName} — ${s.className}`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {s.className} · {new Date(s.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Users className="h-3.5 w-3.5" />
                  <span>{s.completedCount || 0}/{s.totalStudents || 0} selesai</span>
                  <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
