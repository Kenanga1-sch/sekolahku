/**
 * report-parser.ts — Parsing nilai sel menjadi token: teks, variabel scalar,
 * variabel list, atau rumus. Juga utilitas konversi alamat sel A1 → koordinat.
 */

export type TokenType = "EMPTY" | "TEXT" | "SCALAR" | "LIST" | "FORMULA";

export interface ScalarToken {
  type: "SCALAR";
  raw: string;
  path: string; // "laporan.periode"
}

export interface ListToken {
  type: "LIST";
  raw: string;
  root: string; // "nama_siswa" atau "items"
  field?: string; // "saldo" untuk {items.saldo}; undefined → root itu sendiri
}

export interface FormulaToken {
  type: "FORMULA";
  raw: string;
  expr: string; // tanpa tanda "="
}

export interface TextToken {
  type: "TEXT" | "EMPTY";
  raw: string;
}

export type CellToken = ScalarToken | ListToken | FormulaToken | TextToken;

const SCALAR_RE = /^\{\{\s*([^{}]+?)\s*\}\}$/;
const LIST_RE = /^\{([^{}]+?)\}$/;

/**
 * Parse satu nilai sel menjadi token.
 * Prioritas: rumus (=), scalar ({{...}}), list ({...}), lalu teks biasa.
 */
export function parseCellValue(value: string | undefined | null): CellToken {
  const raw = value == null ? "" : String(value);
  const trimmed = raw.trim();
  if (trimmed === "") return { type: "EMPTY", raw };

  if (trimmed.startsWith("=") && trimmed.length > 1) {
    return { type: "FORMULA", raw, expr: trimmed.slice(1).trim() };
  }

  const scalar = SCALAR_RE.exec(trimmed);
  if (scalar) {
    return { type: "SCALAR", raw, path: scalar[1].trim() };
  }

  const list = LIST_RE.exec(trimmed);
  if (list) {
    const body = list[1].trim();
    const dot = body.indexOf(".");
    if (dot === -1) return { type: "LIST", raw, root: body, field: undefined };
    return { type: "LIST", raw, root: body.slice(0, dot).trim(), field: body.slice(dot + 1).trim() };
  }

  return { type: "TEXT", raw };
}

export function tokenType(value: string | undefined | null): TokenType {
  return parseCellValue(value).type;
}

export function isListValue(value: string | undefined | null): boolean {
  return tokenType(value) === "LIST";
}

export function isFormula(value: string | undefined | null): boolean {
  return tokenType(value) === "FORMULA";
}

/** Ambil nilai dari objek dengan path bertitik ("a.b.c"). */
export function resolvePath(obj: any, path: string): any {
  if (obj == null || !path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

// ── Alamat sel A1 ↔ koordinat ─────────────────────────────────────

/** "A1" → { c: 0, r: 0 }. Mengembalikan null bila tidak valid. */
export function a1ToAddress(ref: string): { r: number; c: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!m) return null;
  let col = 0;
  const letters = m[1].toUpperCase();
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { r: Number(m[2]) - 1, c: col - 1 };
}

/** { c:0, r:0 } → "A1". */
export function addressToA1(r: number, c: number): string {
  let n = c + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${r + 1}`;
}

/**
 * Urai referensi range "A1:C5" / "A1" / "Sheet1!A1:C5" → daftar koordinat.
 */
export interface ParsedRange {
  sheet?: string;
  refs: { r: number; c: number }[];
}

export function parseRange(ref: string): ParsedRange | null {
  let sheet: string | undefined;
  let body = ref.trim();
  const bang = body.indexOf("!");
  if (bang !== -1) {
    sheet = body.slice(0, bang).trim();
    body = body.slice(bang + 1).trim();
  }
  const parts = body.split(":");
  if (parts.length === 1) {
    const a = a1ToAddress(parts[0]);
    return a ? { sheet, refs: [a] } : null;
  }
  if (parts.length === 2) {
    const a = a1ToAddress(parts[0]);
    const b = a1ToAddress(parts[1]);
    if (!a || !b) return null;
    const refs: { r: number; c: number }[] = [];
    const r0 = Math.min(a.r, b.r);
    const r1 = Math.max(a.r, b.r);
    const c0 = Math.min(a.c, b.c);
    const c1 = Math.max(a.c, b.c);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        refs.push({ r, c });
      }
    }
    return { sheet, refs };
  }
  return null;
}
