/**
 * letter-richtext.ts — Util untuk isi kaya (rich text) blok surat.
 *
 * Isi kaya disimpan sebagai string JSON (skema TipTap) di dalam field blok
 * ber-type "richtext". File ini menyediakan parser ringan + helper konversi
 * agar renderer PDF/DOCX/HTML tidak bergantung pada instance editor TipTap.
 *
 * Skema TipTap (subset yang kita dukung):
 *   { type: "doc", content: [ { type: "paragraph", content: [ { type: "text",
 *     text: "...", marks: [{ type: "bold" }] } ] }, { type: "bulletList",
 *     content: [ { type: "listItem", content: [ { type: "paragraph", ... } ] } ] } ] }
 */

export interface RichMark {
  type: string;
}

export interface RichNode {
  type: string;
  text?: string;
  marks?: RichMark[];
  content?: RichNode[];
  attrs?: Record<string, unknown>;
}

export interface RichDoc {
  type: "doc";
  content: RichNode[];
}

/** Dokumen kosong standar. */
export function emptyRichDoc(): RichDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/** Apakah string merupakan JSON rich-text yang valid (dimulai '{'). */
export function looksLikeRichJson(v: unknown): boolean {
  return typeof v === "string" && v.trimStart().startsWith("{");
}

/**
 * Parsing string JSON menjadi RichDoc; mengembalikan null bila bukan rich text.
 */
export function parseRichText(v: unknown): RichDoc | null {
  if (!looksLikeRichJson(v)) return null;
  try {
    const obj = JSON.parse(String(v));
    if (obj && obj.type === "doc" && Array.isArray(obj.content)) {
      return obj as RichDoc;
    }
    return null;
  } catch {
    return null;
  }
}

/** Mengekstrak teks polos dari rich text (untuk validasi/pencarian). */
export function richTextToPlain(v: unknown): string {
  const doc = parseRichText(v);
  if (!doc) return typeof v === "string" ? v : "";
  const walk = (nodes: RichNode[] | undefined): string => {
    if (!nodes) return "";
    return nodes
      .map((n) => {
        if (n.type === "text") return n.text || "";
        if (n.type === "hardBreak") return "\n";
        const inner = walk(n.content);
        // Paragraf / list item diakhiri baris baru.
        if (n.type === "paragraph" || n.type === "heading" || n.type === "listItem") {
          return inner + "\n";
        }
        return inner;
      })
      .join("");
  };
  return walk(doc.content).trim();
}

/** Apakah isi kaya kosong (tak ada teks)? */
export function isRichEmpty(v: unknown): boolean {
  return richTextToPlain(v).trim() === "";
}

/**
 * Konversi string biasa (legacy) menjadi RichDoc agar bisa dimuat ke editor
 * TipTap. Teks multi-baris menjadi beberapa paragraf.
 */
export function plainToRichDoc(text: string): RichDoc {
  const lines = (text || "").split("\n");
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

/**
 * Menormalkan nilai field richtext: bila masih teks biasa (legacy), konversi ke
 * JSON; bila sudah JSON, kembalikan apa adanya.
 */
export function normalizeRichValue(v: unknown): string {
  if (looksLikeRichJson(v)) return String(v);
  return JSON.stringify(plainToRichDoc(typeof v === "string" ? v : ""));
}
