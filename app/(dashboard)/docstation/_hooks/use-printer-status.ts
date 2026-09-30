"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchStatus } from "@/lib/docstation/api";
import type { PrinterInfo } from "../_components/types";

const POLL_INTERVAL_MS = 15000;

/**
 * Memantau status konektivitas printer lewat /api/docstation/status.
 * Melakukan polling berkala dan membersihkan interval saat unmount.
 *
 * Request dibatalkan (AbortController) dan setState dilewati setelah unmount
 * (dijaga mountedRef) agar tidak ada pembaruan state pada komponen yang hilang.
 */
export function usePrinterStatus() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    // Controller baru tiap permintaan; yang lama dibatalkan lebih dulu agar
    // tak ada dua request yang menggantung dan menulis state bersamaan.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await fetchStatus(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;
      setPrinters(data.printers);
      if (data.defaultPrinter) setDefaultPrinter(data.defaultPrinter);
    } catch {
      // Abaikan pembatalan (AbortError): ini bukan kegagalan jaringan.
      if (!mountedRef.current || controller.signal.aborted) return;
      setPrinters((prev) => prev.map((p) => ({ ...p, online: false })));
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    abortRef.current = new AbortController();
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [refresh]);

  return { printers, defaultPrinter, loading, refresh };
}
