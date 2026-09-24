"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchStatus } from "@/lib/docstation/api";
import type { PrinterInfo } from "../_components/types";

const POLL_INTERVAL_MS = 15000;

/**
 * Memantau status konektivitas printer lewat /api/docstation/status.
 * Melakukan polling berkala dan membersihkan interval saat unmount.
 */
export function usePrinterStatus() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchStatus();
      setPrinters(data.printers);
      if (data.defaultPrinter) setDefaultPrinter(data.defaultPrinter);
    } catch {
      setPrinters((prev) => prev.map((p) => ({ ...p, online: false })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return { printers, defaultPrinter, loading, refresh };
}
