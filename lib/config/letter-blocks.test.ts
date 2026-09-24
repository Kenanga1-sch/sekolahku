import { describe, it, expect } from "vitest";
import {
  createBlockInstance,
  findMissingRequired,
  findMissingRequiredInDocument,
  isFieldValueEmpty,
  type LetterBlockInstance,
} from "@/lib/config/letter-blocks";

describe("isFieldValueEmpty", () => {
  it("menganggap null/undefined/kosong sebagai kosong", () => {
    expect(isFieldValueEmpty(null)).toBe(true);
    expect(isFieldValueEmpty(undefined)).toBe(true);
    expect(isFieldValueEmpty("")).toBe(true);
    expect(isFieldValueEmpty("   ")).toBe(true);
  });

  it("menganggap teks berisi sebagai tidak kosong", () => {
    expect(isFieldValueEmpty("Halo")).toBe(false);
  });

  it("mendeteksi rich text JSON kosong (paragraf tanpa teks)", () => {
    const empty = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
    expect(isFieldValueEmpty(empty)).toBe(true);
  });

  it("mendeteksi rich text JSON yang berisi teks", () => {
    const filled = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Isi" }] }],
    });
    expect(isFieldValueEmpty(filled)).toBe(false);
  });

  it("menganggap HTML tanpa teks sebagai kosong", () => {
    expect(isFieldValueEmpty("<p></p>")).toBe(true);
  });
});

describe("findMissingRequired", () => {
  it("menemukan field wajib yang kosong pada blok isi", () => {
    const blok = createBlockInstance("isi");
    expect(blok).not.toBeNull();
    const missing = findMissingRequired([blok as LetterBlockInstance]);
    // Blok "isi" punya field wajib `text` yang masih kosong.
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].blockId).toBe("isi");
  });

  it("tidak melaporkan blok yang dinonaktifkan", () => {
    const blok = createBlockInstance("isi") as LetterBlockInstance;
    blok.enabled = false;
    expect(findMissingRequired([blok])).toHaveLength(0);
  });

  it("tidak melaporkan blok tanpa field wajib", () => {
    const blok = createBlockInstance("page_break");
    expect(findMissingRequired([blok as LetterBlockInstance])).toHaveLength(0);
  });

  it("memindai seluruh halaman dokumen", () => {
    const blok = createBlockInstance("isi") as LetterBlockInstance;
    const result = findMissingRequiredInDocument([
      { blocks: [] },
      { blocks: [blok] },
    ]);
    expect(result.length).toBeGreaterThan(0);
  });

  it("menciptakan blok baru (garis_pemisah, dua_kolom, daftar_centang, tanda_tangan_basah, barcode)", () => {
    const bGaris = createBlockInstance("garis_pemisah");
    const bDua = createBlockInstance("dua_kolom");
    const bCentang = createBlockInstance("daftar_centang");
    const bTtd = createBlockInstance("tanda_tangan_basah");
    const bBc = createBlockInstance("barcode");

    expect(bGaris).not.toBeNull();
    expect(bDua).not.toBeNull();
    expect(bCentang).not.toBeNull();
    expect(bTtd).not.toBeNull();
    expect(bBc).not.toBeNull();
  });
});
