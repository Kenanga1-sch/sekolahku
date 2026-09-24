"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OPENCV_URL = "/docstation/vendor/opencv.js";
const WORKER_URL = "/docstation/worker.js";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Mengelola Web Worker mesin gambar DocStation (OpenCV + fallback pure-JS) dan
 * memuat OpenCV.js on-demand dengan laporan progres.
 *
 * Worker dapat dibuat mandiri (tanpa OpenCV) — bulatkan pemrosesan ke engine
 * pure-JS bila OpenCV belum/tidak tersedia.
 */
export function useOpenCV() {
  const [state, setState] = useState<OpenCVLoadState>(initialState);
  const workerRef = useRef<Worker | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const pendingRef = useRef<((result: WorkerResult) => void)[]>([]);
  const cancelledRef = useRef(false);

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(WORKER_URL);
    worker.onmessage = (event: MessageEvent) => {
      const resolver = pendingRef.current.shift();
      if (resolver) resolver(event.data as WorkerResult);
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    readerRef.current?.cancel().catch(() => {});
    setState((s) => ({ ...s, status: "cancelled" }));
  }, []);

  const load = useCallback(async () => {
    if (state.status === "ready") return;
    cancelledRef.current = false;
    setState({ ...initialState, status: "loading" });

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
      const blobUrl = URL.createObjectURL(blob);
      const worker = ensureWorker();
      worker.postMessage({ type: "INITIALIZE_OPENCV_URL", payload: { url: blobUrl } });
      setState((s) => ({ ...s, status: "ready" }));
    } catch {
      if (!cancelledRef.current) {
        setState((s) => ({ ...s, status: "error" }));
      }
    } finally {
      readerRef.current = null;
    }
  }, [ensureWorker, state.status]);

  /** Mengirim tugas ke worker dan menunggu hasilnya (satu tugas pada satu waktu). */
  const run = useCallback(
    (request: WorkerRequest): Promise<WorkerResult> => {
      const worker = ensureWorker();
      return new Promise<WorkerResult>((resolve) => {
        pendingRef.current.push(resolve);
        if (request.transfer && request.transfer.length > 0) {
          worker.postMessage({ type: request.type, payload: request.payload }, request.transfer);
        } else {
          worker.postMessage({ type: request.type, payload: request.payload });
        }
      });
    },
    [ensureWorker],
  );

  // Bersihkan worker saat unmount.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current = [];
    };
  }, []);

  return { ...state, load, cancel, run };
}
