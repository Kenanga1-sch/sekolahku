"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OPENCV_URL = "/docstation/vendor/opencv.js";
const WORKER_URL = "/docstation/worker.js";

/** Batas tunggu satu tugas worker (ms) — AUTO_PIPELINE bisa lama di HP kentang. */
const WORKER_TASK_TIMEOUT_MS = 120000;
/** Batas tunggu OpenCV.js siap setelah di-post ke worker (ms). */
const OPENCV_INIT_TIMEOUT_MS = 30000;

export interface OpenCVLoadState {
  /** Status: idle | loading | ready | error | cancelled */
  status: "idle" | "loading" | "ready" | "error" | "cancelled";
  percent: number;
  receivedMB: number;
  totalMB: number;
}

const initialState: OpenCVLoadState = {
  status: "idle",
  percent: 0,
  receivedMB: 0,
  totalMB: 8.2,
};

export interface WorkerRequest {
  type:
    | "ENHANCE_BW"
    | "ENHANCE_BG"
    | "ENHANCE_DESPECKLE"
    | "ENHANCE_DESPECKLE_STRONG"
    | "ENHANCE_PUNCH_HOLE"
    | "ENHANCE_WHITE_BG"
    | "ENHANCE_ILLUMINATION"
    | "REMOVE_STRAY_MARKS"
    | "REMOVE_ADF_BORDER"
    | "SHARPEN_USM"
    | "DESKEW"
    | "PERSPECTIVE_WARP"
    | "AUTO_STITCH"
    | "AUTO_PIPELINE"
    | "DETECT_PAPER"
    | "DETECT_BLANK";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  transfer?: Transferable[];
}

export interface WorkerResult {
  /** Id korelasi — dicocokkan dengan permintaan, bukan urutan antrean. */
  requestId?: number;
  /** Jenis balasan worker (ENHANCE_RESULT, DESKEW_RESULT, INITIALIZED, ...). */
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface PendingTask {
  resolve: (result: WorkerResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Mengelola Web Worker mesin gambar DocStation (OpenCV + fallback pure-JS) dan
 * memuat OpenCV.js on-demand dengan laporan progres.
 *
 * Protokol korelasi: setiap `run()` mengirim `requestId` unik; worker
 * mengembalikannya di setiap hasil tugas. Pesan spontan `INITIALIZED` (tanpa
 * requestId yang cocok) tidak pernah dianggap hasil tugas — ini menutup race
 * lama di mana INITIALIZED menukar hasil enhance dan membuat
 * `applyImageData(undefined)` meledak.
 *
 * Worker dapat dibuat mandiri (tanpa OpenCV) — bulatkan pemrosesan ke engine
 * pure-JS bila OpenCV belum/tidak tersedia.
 */
export function useOpenCV() {
  const [state, setState] = useState<OpenCVLoadState>(initialState);
  const workerRef = useRef<Worker | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const pendingRef = useRef<Map<number, PendingTask>>(new Map());
  const requestIdRef = useRef(0);
  const initWaitersRef = useRef<Set<(engine: string) => void>>(new Set());
  const cancelledRef = useRef(false);

  const rejectAllPending = useCallback((err: Error) => {
    for (const [, task] of pendingRef.current) {
      clearTimeout(task.timer);
      try {
        task.reject(err);
      } catch {
        /* ignore */
      }
    }
    pendingRef.current.clear();
  }, []);

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(WORKER_URL);
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as WorkerResult;
      // Pesan boot / siap OpenCV — teruskan ke penunggu load(), bukan ke tugas.
      if (!data || data.type === "INITIALIZED") {
        const engine = typeof data?.cvEngine === "string" ? data.cvEngine : "pure-js";
        for (const notify of initWaitersRef.current) {
          try {
            notify(engine);
          } catch {
            /* ignore */
          }
        }
        return;
      }
      const id = typeof data.requestId === "number" ? data.requestId : null;
      if (id === null) return;
      const task = pendingRef.current.get(id);
      if (!task) return;
      pendingRef.current.delete(id);
      clearTimeout(task.timer);
      task.resolve(data);
    };
    worker.onerror = () => {
      rejectAllPending(new Error("Worker DocStation gagal (error)"));
    };
    workerRef.current = worker;
    return worker;
  }, [rejectAllPending]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    readerRef.current?.cancel().catch(() => {});
    rejectAllPending(new Error("Dibatalkan pengguna"));
    setState((s) => ({ ...s, status: "cancelled" }));
  }, [rejectAllPending]);

  const load = useCallback(async () => {
    if (state.status === "ready") return;
    cancelledRef.current = false;
    setState({ ...initialState, status: "loading" });

    const worker = ensureWorker();
    let blobUrl: string | null = null;
    try {
      const response = await fetch(OPENCV_URL);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const contentLength = response.headers.get("content-length");
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 8595774;

      readerRef.current = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await readerRef.current.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
        }

        const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
        setState({
          status: "loading",
          percent,
          receivedMB: Number((receivedBytes / 1024 / 1024).toFixed(1)),
          totalMB: Number((totalBytes / 1024 / 1024).toFixed(1)),
        });
        if (cancelledRef.current) return;
      }

      const blob = new Blob(chunks as BlobPart[]);
      blobUrl = URL.createObjectURL(blob);

      // Tunggu konfirmasi OpenCV dari worker; fallback pure-JS bila timeout.
      const initPromise = new Promise<string>((resolve) => {
        const notify = (engine: string) => {
          initWaitersRef.current.delete(notify);
          resolve(engine);
        };
        initWaitersRef.current.add(notify);
        window.setTimeout(() => {
          if (initWaitersRef.current.delete(notify)) resolve("pure-js-timeout");
        }, OPENCV_INIT_TIMEOUT_MS);
      });
      worker.postMessage({ type: "INITIALIZE_OPENCV_URL", payload: { url: blobUrl } });
      await initPromise;
      if (cancelledRef.current) return;
      setState((s) => ({ ...s, status: "ready" }));
    } catch {
      if (!cancelledRef.current) {
        // Gagal unduh OpenCV bukan fatal — pure-JS tetap jalan.
        setState((s) => ({ ...s, status: "ready" }));
      }
    } finally {
      readerRef.current = null;
      if (blobUrl) {
        // importScripts sudah menyalin isi; URL blob aman dicabut.
        window.setTimeout(() => {
          try {
            URL.revokeObjectURL(blobUrl as string);
          } catch {
            /* ignore */
          }
        }, 5000);
      }
    }
  }, [ensureWorker, state.status]);

  /** Mengirim tugas ke worker dan menunggu hasilnya (boleh paralel, dikorelasikan id). */
  const run = useCallback(
    (request: WorkerRequest): Promise<WorkerResult> => {
      const worker = ensureWorker();
      const requestId = (requestIdRef.current += 1);
      return new Promise<WorkerResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (pendingRef.current.delete(requestId)) {
            reject(new Error("Worker timeout — coba lagi atau kecilkan resolusi"));
          }
        }, WORKER_TASK_TIMEOUT_MS);
        pendingRef.current.set(requestId, { resolve, reject, timer });
        const message = { type: request.type, payload: request.payload, requestId };
        if (request.transfer && request.transfer.length > 0) {
          worker.postMessage(message, request.transfer);
        } else {
          worker.postMessage(message);
        }
      });
    },
    [ensureWorker],
  );

  // Bersihkan worker saat unmount. Salin referensi map di dalam effect agar
  // cleanup memakai map yang sama sepanjang hidup effect (bukan nilai ref
  // yang bisa berubah antar render).
  useEffect(() => {
    const pending = pendingRef.current;
    const waiters = initWaitersRef.current;
    return () => {
      for (const [, task] of pending) {
        clearTimeout(task.timer);
        try {
          task.reject(new Error("Komponen ditutup"));
        } catch {
          /* ignore */
        }
      }
      pending.clear();
      waiters.clear();
      // worker dibuat lazy (bisa null saat mount) — baca nilai terbaru.
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return { ...state, load, cancel, run };
}
