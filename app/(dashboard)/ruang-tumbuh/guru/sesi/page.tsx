"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Play,
  Square,
  ClipboardCheck,
  Loader2,
  Mail,
  Lightbulb,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { goGet, goPost, goPut } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import type { ScreeningSession, SessionRosterItem } from "@/lib/ruang-tumbuh/types";
import { OBSERVATION_ITEMS, metricDescriptors } from "@/lib/ruang-tumbuh/observasi";

interface StudentDetail {
  hasAttempt: boolean;
  attemptStatus?: string;
  result?: {
    metrics: {
      accuracy: number;
      rtAvg: number;
      rtVariability: number;
      missed: number;
      incorrect: number;
      levelReached: number;
    };
    domain: string;
  };
  observation?: { checklist: string; notes: string };
}

export default function SessionDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionID = searchParams.get("id") || "";

  const [session, setSession] = useState<ScreeningSession | null>(null);
  const [roster, setRoster] = useState<SessionRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [detailStudent, setDetailStudent] = useState<SessionRosterItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [recText, setRecText] = useState("");
  const [recFollowUp, setRecFollowUp] = useState("observasi");
  const [recShared, setRecShared] = useState(true);
  const [recList, setRecList] = useState<any[]>([]);
  const [inviting, setInviting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res: any = await goGet(`/api/ruang-tumbuh/sessions/${sessionID}`);
      if (res?.data) {
        setSession(res.data.session || null);
        setRoster(res.data.roster || []);
      }
    } catch {
      showError("Gagal memuat sesi");
    } finally {
      setLoading(false);
    }
  }, [sessionID]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Saat sesi berlangsung, perbarui progress tiap 8 detik (tanpa loading state).
  useEffect(() => {
    if (session?.status !== "active") return;
    const t = setInterval(() => fetchData(), 8000);
    return () => clearInterval(t);
  }, [session?.status, fetchData]);

  const handleControl = async (action: "start" | "finish") => {
    setBusy(true);
    try {
      await goPost(`/api/ruang-tumbuh/sessions/${sessionID}/${action}`);
      showSuccess(action === "start" ? "Sesi dimulai. Siswa dapat mulai mengerjakan." : "Sesi diselesaikan.");
      fetchData();
    } catch {
      showError("Gagal mengubah status sesi");
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (item: SessionRosterItem) => {
    setDetailStudent(item);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res: any = await goGet(
        `/api/ruang-tumbuh/sessions/${sessionID}/students/${item.studentId}`,
      );
      const d: StudentDetail = res?.data || { hasAttempt: false };
      setDetail(d);
      const obsItems = d.observation?.checklist ? JSON.parse(d.observation.checklist) : [];
      setChecked(Array.isArray(obsItems) ? obsItems : []);
      setNotes(d.observation?.notes || "");
      // Muat rekomendasi yang sudah pernah dibuat untuk siswa ini.
      try {
        const recRes: any = await goGet(
          `/api/ruang-tumbuh/sessions/${sessionID}/recommendations?studentId=${item.studentId}`,
        );
        setRecList(recRes?.data || []);
      } catch {
        setRecList([]);
      }
      setRecText("");
      setRecShared(true);
    } catch {
      showError("Gagal memuat hasil siswa");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveObservation = async () => {
    if (!detailStudent) return;
    try {
      await goPost(`/api/ruang-tumbuh/sessions/${sessionID}/observations`, {
        studentId: detailStudent.studentId,
        checklist: checked,
        notes: notes.trim(),
      });
      showSuccess("Observasi tersimpan");
      fetchData();
    } catch {
      showError("Gagal menyimpan observasi");
    }
  };

  const handleSaveRecommendation = async () => {
    if (!detailStudent) return;
    const text = recText.trim();
    if (!text) {
      showError("Isi rekomendasi terlebih dahulu");
      return;
    }
    try {
      const res: any = await goPost(`/api/ruang-tumbuh/sessions/${sessionID}/recommendations`, {
        studentId: detailStudent.studentId,
        domain: detail?.result?.domain || "",
        recommendation: text,
        followUpType: recFollowUp,
        sharedToParent: recShared,
      });
      showSuccess(recShared ? "Rekomendasi tersimpan & dibagikan ke orang tua" : "Rekomendasi tersimpan");
      setRecText("");
      const recRes: any = await goGet(
        `/api/ruang-tumbuh/sessions/${sessionID}/recommendations?studentId=${detailStudent.studentId}`,
      );
      setRecList(recRes?.data || []);
      fetchData();
      void res;
    } catch {
      showError("Gagal menyimpan rekomendasi");
    }
  };

  const handleToggleShare = async (recId: string, shared: boolean) => {
    try {
      await goPut(`/api/ruang-tumbuh/recommendations/${recId}/share`, { shared });
      showSuccess(shared ? "Rekomendasi dibagikan ke orang tua" : "Rekomendasi ditarik dari orang tua");
      if (detailStudent) {
        const recRes: any = await goGet(
          `/api/ruang-tumbuh/sessions/${sessionID}/recommendations?studentId=${detailStudent.studentId}`,
        );
        setRecList(recRes?.data || []);
      }
    } catch {
      showError("Gagal mengubah status berbagi");
    }
  };

  const handleInviteParents = async () => {
    setInviting(true);
    try {
      const res: any = await goPost(`/api/ruang-tumbuh/sessions/${sessionID}/invite-parents`, {});
      showSuccess(res?.message || "Undangan terkirim");
    } catch {
      showError("Gagal mengirim undangan");
    } finally {
      setInviting(false);
    }
  };

  if (loading || !session) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const obsDomain = OBSERVATION_ITEMS[session.domain || "perhatian"] || OBSERVATION_ITEMS.perhatian;
  const pct = session.totalStudents
    ? Math.round((session.completedCount || 0) / session.totalStudents * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <button
        onClick={() => router.push("/ruang-tumbuh/guru")}
        className="flex items-center gap-2 text-sm text-slate-600 hover:underline dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar sesi
      </button>

      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{session.title || `${session.gameName} — ${session.className}`}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {session.gameName} · {session.className} · {session.academicYear}
              </p>
            </div>
            {session.status === "pending" && (
              <Button onClick={() => handleControl("start")} disabled={busy} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                MULAI
              </Button>
            )}
            {session.status === "active" && (
              <Button onClick={() => handleControl("finish")} disabled={busy} variant="destructive" className="rounded-full">
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Square className="mr-1 h-4 w-4" />}
                SELESAI
              </Button>
            )}
            {session.status === "finished" && (
              <span className="flex items-center gap-1 rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                <CheckCircle2 className="h-4 w-4" /> Sesi Selesai
              </span>
            )}
            <Button
              onClick={handleInviteParents}
              disabled={inviting}
              variant="outline"
              className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300"
            >
              {inviting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Mail className="mr-1 h-4 w-4" />}
              Undang Orang Tua
            </Button>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {session.status === "active" && (
              <span className="flex items-center gap-1 font-medium text-emerald-600">
                <Clock className="h-4 w-4" /> Berlangsung
              </span>
            )}
            <span className="text-slate-600 dark:text-slate-300">
              {session.completedCount || 0} dari {session.totalStudents || 0} siswa selesai
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {session.status === "pending" && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Siswa belum dapat memulai sebelum Anda menekan MULAI. Pastikan siswa siap dan perangkat berfungsi (protokol pelaksanaan).
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Daftar Siswa</h2>
        <div className="space-y-2">
          {roster.length === 0 && (
            <p className="text-sm text-slate-500">Tidak ada siswa terdaftar di kelas ini.</p>
          )}
          {roster.map((item) => (
            <div
              key={item.studentId}
              className="flex items-center gap-3 rounded-xl border bg-white p-3 dark:bg-slate-900"
            >
              <div className="flex-1">
                <p className="font-medium text-slate-800 dark:text-slate-100">{item.studentName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.attemptStatus === "completed"
                    ? `Selesai · akurasi ${item.accuracy != null ? item.accuracy.toFixed(0) + "%" : "-"}`
                    : item.attemptStatus === "in_progress"
                      ? "Sedang mengerjakan…"
                      : "Belum mulai"}
                  {item.hasObservation ? " · observasi ✓" : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => openDetail(item)}
              >
                <ClipboardCheck className="mr-1 h-3.5 w-3.5" /> Hasil
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Dialog hasil & observasi siswa */}
      <Dialog open={!!detailStudent} onOpenChange={(o) => !o && setDetailStudent(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailStudent?.studentName}</DialogTitle>
            <DialogDescription>
              Hasil {session.gameName} — deskriptor kemampuan, bukan diagnosis.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {!detail?.hasAttempt && (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  Siswa belum mengerjakan skrining ini.
                </p>
              )}

              {detail?.hasAttempt && !detail.result && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Siswa sedang mengerjakan / belum mengirim hasil.
                </p>
              )}

              {detail?.result && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {OBSERVATION_ITEMS[detail.result.domain]?.label || "Hasil"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {metricDescriptors(detail.result.metrics).map((m) => (
                      <div key={m.label} className="rounded-lg border bg-slate-50 p-2.5 dark:bg-slate-900">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{m.label}</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {m.value} <span className="font-normal text-xs text-slate-500">{m.note}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form observasi (§26) */}
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Observasi Guru — {obsDomain.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{obsDomain.prompt}</p>
                <div className="space-y-2">
                  {obsDomain.items.map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <Checkbox
                        checked={checked.includes(item)}
                        onCheckedChange={(v) =>
                          setChecked((c) => (v ? [...c, item] : c.filter((x) => x !== item)))
                        }
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                <Textarea
                  placeholder="Catatan bebas (opsional)…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Rekomendasi tindak lanjut (§25) */}
              <div className="space-y-2 border-t pt-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Lightbulb className="h-4 w-4 text-amber-500" /> Rekomendasi Tindak Lanjut
                </p>
                {recList.length > 0 && (
                  <div className="space-y-1.5">
                    {recList.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/60 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20"
                      >
                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{rec.recommendation}</span>
                        <button
                          onClick={() => handleToggleShare(rec.id, !rec.sharedToParent)}
                          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition ${
                            rec.sharedToParent
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          <Share2 className="h-3 w-3" />
                          {rec.sharedToParent ? "Dibagikan" : "Bagikan"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Textarea
                  placeholder="Tuliskan rekomendasi tindak lanjut untuk siswa…"
                  value={recText}
                  onChange={(e) => setRecText(e.target.value)}
                  rows={2}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={recFollowUp}
                    onChange={(e) => setRecFollowUp(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="observasi">Observasi lanjutan</option>
                    <option value="pendampingan">Pendampingan guru</option>
                    <option value="komunikasi">Komunikasi orang tua</option>
                    <option value="ruang_baca">Ruang baca khusus</option>
                  </select>
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <Checkbox checked={recShared} onCheckedChange={(v) => setRecShared(!!v)} />
                    Bagikan ke orang tua
                  </label>
                  <Button size="sm" onClick={handleSaveRecommendation} className="ml-auto rounded-full">
                    Tambah Rekomendasi
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailStudent(null)}>
              Tutup
            </Button>
            <Button onClick={handleSaveObservation} disabled={detailLoading}>
              Simpan Observasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
