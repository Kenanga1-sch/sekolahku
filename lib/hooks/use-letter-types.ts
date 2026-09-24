/**
 * use-letter-types.ts — Ambil daftar jenis surat dari DB (dengan fallback
 * ke konstanta bila endpoint belum tersedia / gagal).
 *
 * Endpoint: GET /api/eoffice/letter-types
 */

import { useCallback, useEffect, useState } from "react";
import { goGet } from "@/lib/api-client";
import {
  LETTER_TYPE_OPTIONS,
  resolveLetterCategory,
  type LetterTypeOption,
} from "@/lib/config/letter-standards";

interface RawLetterType {
  id: number;
  jenisSurat: string;
  kodeKlasifikasi: string;
  kategori: string;
  formatNomor: string;
  isActive?: boolean;
  urut?: number;
}

function mapRow(row: RawLetterType): LetterTypeOption {
  return {
    id: row.id,
    jenisSurat: row.jenisSurat,
    kodeKlasifikasi: row.kodeKlasifikasi,
    kategori: row.kategori,
    formatNomor: row.formatNomor,
    standardCategory: resolveLetterCategory(row.kategori),
  };
}

export function useLetterTypes() {
  const [options, setOptions] = useState<LetterTypeOption[]>(LETTER_TYPE_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await goGet("/api/eoffice/letter-types");
      const data: RawLetterType[] = Array.isArray(res?.data) ? res.data : [];
      if (data.length > 0) {
        setOptions(data.map(mapRow));
        setError(null);
      } else {
        // DB kosong → pakai konstanta.
        setOptions(LETTER_TYPE_OPTIONS);
      }
    } catch {
      // Fallback ke konstanta.
      setOptions(LETTER_TYPE_OPTIONS);
      setError("Gagal memuat jenis surat dari server; memakai bawaan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { options, loading, error, refresh };
}
