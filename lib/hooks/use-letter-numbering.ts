/**
 * use-letter-numbering.ts — Ambil nomor urut surat otomatis dari backend.
 *
 * Memakai endpoint yang sudah ada:
 *   POST /api/eoffice/letter-numbering  → { classificationCode, date }
 *     balasan: { success, data: <nextSequence> }
 *
 * Dipakai di editor modular untuk mengisi nomor surat otomatis.
 */

import { useCallback, useEffect, useState } from "react";
import { goPost } from "@/lib/api-client";

interface Options {
  classificationCode: string;
  date: string;
  /** Ambi nomor saat mount. */
  immediate?: boolean;
}

interface State {
  sequence: number;
  loading: boolean;
  error: string | null;
}

export function useLetterNumbering({ classificationCode, date, immediate = true }: Options) {
  const [state, setState] = useState<State>({
    sequence: 0,
    loading: false,
    error: null,
  });

  const fetchNext = useCallback(async () => {
    if (!classificationCode) {
      setState({ sequence: 0, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res: any = await goPost("/api/eoffice/letter-numbering", {
        classificationCode,
        date,
      });
      const next = Number(res?.data ?? res?.nextSequence ?? 0);
      setState({ sequence: Number.isFinite(next) ? next : 0, loading: false, error: null });
    } catch (e) {
      setState({
        sequence: 0,
        loading: false,
        error: e instanceof Error ? e.message : "Gagal mengambil nomor urut",
      });
    }
  }, [classificationCode, date]);

  useEffect(() => {
    if (immediate) fetchNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classificationCode, date, immediate]);

  return { ...state, refresh: fetchNext };
}
