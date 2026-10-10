"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Monitor, Loader2, CheckCircle, XCircle, Lock, Clock } from "lucide-react";
import { goPost } from "@/lib/api-client";
import { evaluateScan } from "@/lib/kiosk/scan-gate";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import {
  getStationSession,
  formatCountdown,
  remainingSeconds,
  type ComputerSession,
} from "@/lib/computer";
import { Button } from "@/components/ui/button";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
  { ssr: false }
);

type Phase = "idle" | "scanning" | "active" | "locked" | "error";

function KioskKomputerContent() {
  const params = useSearchParams();
  const stationCode = params.get("station") || "";
  const pageVisible = usePageVisible();

  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<ComputerSession | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [message, setMessage] = useState("");
  const [stationName, setStationName] = useState("");
  const lastScanRef = useRef(0);
  const lastCodeRef = useRef<string | null>(null);
  const endedRef = useRef(false);

  // Muat status stasiun saat mount & saat kembali ke tab.
  const refreshStation = useCallback(async () => {
    if (!stationCode) {
      setPhase("error");
      setMessage("Kode komputer tidak diberikan pada URL.");
      return;
    }
    try {
      const state = await getStationSession(stationCode);
      setStationName(state.station.name);
      if (state.session) {
        setSession(state.session);
        setSecondsLeft(remainingSeconds(state.session.deadlineAt));
        setPhase(state.expired ? "locked" : "active");
      } else if (phase !== "locked") {
        setPhase("idle");
      }
    } catch {
      setPhase("error");
      setMessage("Gagal menghubungi server. Periksa koneksi.");
    }
  }, [stationCode, phase]);

  useEffect(() => {
    refreshStation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationCode]);

  useEffect(() => {
    if (pageVisible) refreshStation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible]);

  // Timer countdown.
  useEffect(() => {
    if (phase !== "active" || !session) return;
    const tick = () => {
      const rem = remainingSeconds(session.deadlineAt);
      setSecondsLeft(rem);
      if (rem <= 0) {
        setPhase("locked");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, session]);

  // Sinkronisasi berkala dengan server (server adalah sumber kebenaran).
  useEffect(() => {
    if (phase !== "active" && phase !== "locked") return;
    const id = setInterval(async () => {
      try {
        const state = await getStationSession(stationCode);
        if (!state.session) {
          // Sesi ditutup server (mis. end manual / waktu habis dari cron).
          setSession(null);
          setPhase("idle");
          return;
        }
        setSession(state.session);
        if (state.expired) setPhase("locked");
      } catch {
        /* diamkan; coba lagi */
      }
    }, 15000);
    return () => clearInterval(id);
  }, [phase, stationCode]);

  // Saat terkunci, beri tahu server sekali (idempoten).
  useEffect(() => {
    if (phase !== "locked" || !session || endedRef.current) return;
    endedRef.current = true;
    goPost(`/api/computer/sessions/${encodeURIComponent(session.id)}/end`, {
      reason: "time_up",
    }).catch(() => {});
  }, [phase, session]);

  const handleScan = useCallback(
    async (code: string) => {
      if (phase !== "idle" && phase !== "scanning") return;
      setPhase("scanning");
      try {
        const res = await goPost<{ data: ComputerSession }>(
          "/api/computer/kiosk/start",
          { code, stationCode },
          { skipRetry: true }
        );
        endedRef.current = false;
        setSession(res.data);
        setSecondsLeft(remainingSeconds(res.data.deadlineAt));
        setPhase("active");
        setMessage("");
      } catch (e: any) {
        const msg = e?.data?.error || e?.message || "Gagal memulai sesi";
        setMessage(msg);
        setPhase("error");
        setTimeout(() => setPhase("idle"), 4000);
      }
    },
    [phase, stationCode]
  );

  const onScanResult = useCallback(
    (result: { rawValue: string }[]) => {
      if (!result || result.length === 0) return;
      const code = result[0].rawValue;
      const decision = evaluateScan({
        now: Date.now(),
        inFlight: phase === "scanning",
        code,
        lastCode: lastCodeRef.current,
        lastCodeAt: lastScanRef.current,
      });
      if (decision) return;
      lastCodeRef.current = code;
      lastScanRef.current = Date.now();
      handleScan(code);
    },
    [phase, handleScan]
  );

  // ============ RENDER: terkunci ============
  if (phase === "locked") {
    return (
      <div className="min-h-screen bg-red-700 flex flex-col items-center justify-center text-center p-8">
        <Lock className="h-24 w-24 text-white mb-6" />
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">Waktu Habis</h1>
        <p className="text-red-100 text-lg max-w-md">
          Waktu menggunakan komputer ini telah berakhir. Terima kasih,{" "}
          {session?.studentName || "siswa"}.
        </p>
        <p className="text-red-200 mt-6 text-sm">
          Silakan hubungi petugas perpustakaan untuk membuka komputer.
        </p>
      </div>
    );
  }

  // ============ RENDER: sesi aktif ============
  if (phase === "active" && session) {
    const warn = secondsLeft <= 300;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center text-center p-8">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle className="h-10 w-10 text-green-400" />
          <div className="text-left">
            <p className="text-white text-xl font-bold">{session.studentName}</p>
            <p className="text-blue-200 text-sm">{stationName || session.stationName}</p>
          </div>
        </div>

        <p className="text-blue-200 text-sm uppercase tracking-widest mb-2">
          Sisa waktu
        </p>
        <div
          className={`font-mono font-bold tabular-nums leading-none ${
            warn ? "text-amber-400" : "text-white"
          }`}
          style={{ fontSize: "clamp(4rem, 22vw, 16rem)" }}
        >
          {formatCountdown(secondsLeft)}
        </div>

        {warn && (
          <p className="text-amber-300 text-lg mt-6 flex items-center gap-2">
            <Clock className="h-5 w-5" /> Segera simpan pekerjaanmu
          </p>
        )}
        <p className="text-blue-300/60 text-sm mt-8">
          Komputer akan terkunci otomatis saat waktu habis.
        </p>
      </div>
    );
  }

  // ============ RENDER: idle / scan / error ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
      <header className="p-4 flex items-center gap-3 border-b border-white/5">
        <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center">
          <Monitor className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white leading-none">
            Komputer Belajar
          </h1>
          <p className="text-blue-200 text-xs mt-1">
            {stationName || stationCode || "Stasiun tidak dikenal"}
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {phase === "scanning" || phase === "idle" ? (
          <div className="w-full max-w-sm">
            <p className="text-center text-blue-100 mb-4">
              {phase === "scanning"
                ? "Memproses…"
                : "Scan kartu siswa untuk mulai menggunakan komputer"}
            </p>
            <div className="rounded-2xl overflow-hidden border-2 border-blue-500/30 aspect-square bg-black">
              <Scanner
                onScan={onScanResult}
                scanDelay={250}
                paused={phase !== "idle" || !pageVisible}
                constraints={{ facingMode: "user" }}
                styles={{
                  container: { width: "100%", height: "100%" },
                  video: { width: "100%", height: "100%", objectFit: "cover" },
                }}
              />
            </div>
          </div>
        ) : phase === "error" ? (
          <div className="text-center max-w-sm">
            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <p className="text-white text-lg">{message}</p>
            <Button
              className="mt-6"
              variant="outline"
              onClick={() => setPhase("idle")}
            >
              Coba lagi
            </Button>
          </div>
        ) : (
          <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
        )}
      </div>
    </div>
  );
}

export default function KioskKomputerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        </div>
      }
    >
      <KioskKomputerContent />
    </Suspense>
  );
}
