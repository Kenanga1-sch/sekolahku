/**
 * letter-pdf-types.ts — Tipe bersama untuk renderer PDF surat.
 *
 * Diekstrak dari letter-pdf.tsx (refactor, zero behavior change).
 */
import type { LetterStandard } from "@/lib/config/letter-standards";
import type { LetterDocumentData } from "@/lib/config/letter-document";

/** Data sekolah untuk kop & tanda tangan. */
export interface LetterSchoolData {
  schoolName: string;
  npsn: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  /** Baris instansi atasan (mis. "PEMERINTAH KABUPATEN INDRAMAYU"). */
  governanceLine?: string;
  departmentLine?: string;
  principalName?: string;
  principalNip?: string;
  stampUrl?: string;
}

export interface LetterPdfInput {
  standard: LetterStandard;
  document: LetterDocumentData;
  school: LetterSchoolData;
  /** Variabel {{...}} terisi. */
  vars: Record<string, string>;
  /** Nama berkas saat diunduh. */
  fileName?: string;
}
