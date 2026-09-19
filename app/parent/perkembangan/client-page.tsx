"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Sprout, ClipboardCheck, Lightbulb, Loader2, HeartHandshake } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { goGet, goPost } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { type ScreeningResult, DOMAIN_LABELS } from "@/lib/ruang-tumbuh/types";
import { metricDescriptors } from "@/lib/ruang-tumbuh/observasi";
import { PARENT_OBSERVATION_ITEMS } from "@/lib/ruang-tumbuh/parent-observasi";

interface Child {
  studentId: string;
  fullName: string;
  className?: string;
}

interface ParentObservation {
  id: string;
  academicYear?: string;
  answers?: string;
  notes?: string;
  createdAt: number;
}

interface Recommendation {
  id: string;
  domain?: string;
  recommendation: string;
  followUpType?: string;
  createdAt: number;
}

const GAME_META: Record<string, { name: string; icon: string }> = {
  "game-tangkap-target": { name: "Tangkap Target", icon: "🎣" },
  "game-jangan-terkecoh": { name: "Jangan Terkecoh", icon: "🛡️" },
  "game-ingat-urutannya": { name: "Ingat Urutannya", icon: "🧠" },
  "game-kereta-kata": { name: "Kereta Kata", icon: "📖" },
  "game-toko-buah": { name: "Toko Buah", icon: "🍎" },
};

const DOMAIN_COLORS: Record<string, string> = {
  perhatian: "#0ea5e9",
  inhibitory: "#8b5cf6",
  working_memory: "#10b981",
  literasi: "#f59e0b",
  numerasi: "#ef4444",
};

const fmtDate = (ms: number) => {
  try {
    return new Date(ms).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
};

export default function PerkembanganClientPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [studentId, setStudentId] = useState("");
  const [results, setResults] = useState<ScreeningResult[]>([]);
  const [observations, setObservations] = useState<ParentObservation[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [childLoading, setChildLoading] = useState(true);

  // Form pengamatan
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Daftar anak ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await goGet("/api/parent/children");
        const list: Child[] = res?.data || [];
        if (cancelled) return;
        setChildren(list);
        if (list.length && !studentId) setStudentId(list[0].studentId);
      } catch {
        showError("Gagal memuat daftar anak");
      } finally {
        if (!cancelled) setChildLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data per anak ──
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [r, o, rec]: any = await Promise.all([
          goGet(`/api/parent/ruang-tumbuh/results?studentId=${encodeURIComponent(studentId)}`),
          goGet(`/api/parent/ruang-tumbuh/observations?studentId=${encodeURIComponent(studentId)}`),
          goGet(`/api/parent/ruang-tumbuh/recommendations?studentId=${encodeURIComponent(studentId)}`),
        ]);
        if (cancelled) return;
        setResults(r?.data || []);
        const obs: ParentObservation[] = o?.data || [];
        setObservations(obs);
        setRecommendations(rec?.data || []);
        // Prefill form dari pengamatan terbaru.
        const latest = obs[0];
        try {
          setAnswers(latest?.answers ? JSON.parse(latest.answers) : {});
        } catch {
          setAnswers({});
        }
        setNotes(latest?.notes || "");
      } catch {
        showError("Gagal memuat data perkembangan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const chartData = useMemo(() => {
    return results.map((r, i) => ({
      idx: i + 1,
      label: `Skrining ${i + 1}`,
      date: fmtDate(r.computedAt),
      [r.domain]: Math.round(r.metrics.accuracy * 10) / 10,
    }));
  }, [results]);

  const domainsInResults = useMemo(() => {
    const s = new Set(results.map((r) => r.domain));
    return [...s];
  }, [results]);

  const toggleItem = (domain: string, item: string) => {
    setAnswers((prev) => {
      const cur = prev[domain] || [];
      return { ...prev, [domain]: cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item] };
    });
  };

  const totalChecked = Object.values(answers).reduce((n, arr) => n + arr.length, 0);

  const handleSubmit = async () => {
    if (!studentId) return;
    if (totalChecked === 0) {
      showError("Centang minimal satu pernyataan");
      return;
    }
    setSaving(true);
    try {
      await goPost("/api/parent/ruang-tumbuh/observations", { studentId, answers, notes });
      showSuccess("Pengamatan tersimpan. Terima kasih sudah berbagi!");
      const res: any = await goGet(`/api/parent/ruang-tumbuh/observations?studentId=${encodeURIComponent(studentId)}`);
      const obs: ParentObservation[] = res?.data || [];
      setObservations(obs);
    } catch {
      showError("Gagal menyimpan pengamatan. Coba lagi, ya.");
    } finally {
      setSaving(false);
    }
  };

  if (childLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!children.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-slate-500">
          Belum ada anak yang terhubung dengan akun ini. Hubungi sekolah untuk menautkan data anak.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header + pemilih anak ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
            <Sprout className="h-6 w-6 text-emerald-500" />
            Perkembangan Anak
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Pantau perkembangan skrining anak dan bagikan pengamatan Anda di rumah.
          </p>
        </div>
        {children.length > 1 && (
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.fullName} {c.className ? `· ${c.className}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Profil perkembangan ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-lg">📈</span> Profil Perkembangan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.length === 0 ? (
                <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  Belum ada hasil skrining. Hasil akan muncul di sini setelah anak mengikuti tantangan dari sekolah.
                </p>
              ) : (
                <>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                          labelFormatter={(_, payload) => {
                            const p = payload?.[0]?.payload;
                            return p ? `${p.label} · ${p.date}` : "";
                          }}
                          formatter={(value: number | undefined, name: string | undefined) => [
                            `${value ?? 0}%`,
                            DOMAIN_LABELS[name || ""] || name || "",
                          ]}
                        />
                        <Legend
                          formatter={(name) => <span className="text-xs text-slate-600 dark:text-slate-300">{DOMAIN_LABELS[name] || name}</span>}
                        />
                        {domainsInResults.map((d) => (
                          <Line
                            key={d}
                            type="monotone"
                            dataKey={d}
                            name={d}
                            stroke={DOMAIN_COLORS[d] || "#64748b"}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {[...results].reverse().map((r) => {
                      const meta = GAME_META[r.gameId] || { name: r.gameId, icon: "🎮" };
                      return (
                        <div
                          key={r.id}
                          className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{meta.icon}</span>
                              <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{meta.name}</p>
                                <p className="text-xs text-slate-400">{fmtDate(r.computedAt)}</p>
                              </div>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {Math.round(r.metrics.accuracy)}%
                            </span>
                          </div>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {metricDescriptors(r.metrics).map((m) => (
                              <span
                                key={m.label}
                                className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {m.label}: <b>{m.value}</b>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Rekomendasi dari sekolah ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-5 w-5 text-amber-500" /> Rekomendasi dari Sekolah
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  Belum ada rekomendasi yang dibagikan. Guru akan membagikan saran tindak lanjut bila perlu.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20"
                    >
                      <span className="text-lg">💡</span>
                      <div className="flex-1">
                        <p className="text-sm text-slate-700 dark:text-slate-200">{rec.recommendation}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {rec.domain && DOMAIN_LABELS[rec.domain] && (
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {DOMAIN_LABELS[rec.domain]}
                            </span>
                          )}
                          {rec.followUpType && (
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {rec.followUpType}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">{fmtDate(rec.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Kuesioner pengamatan orang tua ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartHandshake className="h-5 w-5 text-rose-500" /> Pengamatan di Rumah
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Bantu sekolah memahami anak Anda dengan mencentang pernyataan yang sesuai. Tidak ada jawaban benar atau
                salah.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {Object.values(PARENT_OBSERVATION_ITEMS).map((dom) => (
                <div key={dom.domain}>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {dom.label} <span className="font-normal text-slate-400">· {dom.prompt}</span>
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {dom.items.map((item) => {
                      const checked = (answers[dom.domain] || []).includes(item);
                      return (
                        <label
                          key={item}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleItem(dom.domain, item)} className="mt-0.5" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Catatan tambahan</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Hal lain yang ingin Anda bagikan tentang anak di rumah (opsional)…"
                  className="mt-2 min-h-[88px]"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  {observations.length > 0
                    ? `Pengamatan terakhir: ${fmtDate(observations[0].createdAt)}`
                    : "Belum pernah mengisi"}
                </span>
                <Button onClick={handleSubmit} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                  {saving ? "Menyimpan…" : "Simpan Pengamatan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
