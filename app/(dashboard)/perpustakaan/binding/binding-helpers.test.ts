// Tes jaring pengaman untuk helper binding — mengunci normalisasi ISBN barcode
// dan kunci cache AI. Ditulis sebelum pemecahan file agar perilaku tak berubah.
import { describe, it, expect } from "vitest";
import { normalizeISBNBarcode, aiCacheKey, resolveCoverState } from "./binding-helpers";

describe("normalizeISBNBarcode — ISBN-13", () => {
  it("ISBN-13 valid (prefix 978) diterima apa adanya", () => {
    const r = normalizeISBNBarcode("9786021234567");
    expect(r).toEqual({ isbn: "9786021234567", valid: true });
  });

  it("ISBN-13 (prefix 979) valid", () => {
    const r = normalizeISBNBarcode("9791234567890");
    expect(r.valid).toBe(true);
    expect(r.isbn).toBe("9791234567890");
  });

  it("EAN-13 + add-on 5 digit → dipotong ke 13 (ISBN inti)", () => {
    const r = normalizeISBNBarcode("978602123456799999");
    expect(r.isbn).toBe("9786021234567");
    expect(r.valid).toBe(true);
  });

  it("membuang spasi & tanda hubung dari hasil decode", () => {
    const r = normalizeISBNBarcode("978-602-123-456-7");
    expect(r.isbn).toBe("9786021234567");
    expect(r.valid).toBe(true);
  });
});

describe("normalizeISBNBarcode — ISBN-10", () => {
  it("ISBN-10 valid (9 digit + angka)", () => {
    const r = normalizeISBNBarcode("6021234567");
    expect(r.isbn).toBe("6021234567");
    expect(r.valid).toBe(true);
  });

  it("ISBN-10 valid berakhiran X", () => {
    const r = normalizeISBNBarcode("012345678X");
    expect(r.isbn).toBe("012345678X");
    expect(r.valid).toBe(true);
  });

  it("UPC-A buku lama (0 + ISBN-10 + check, 12 digit) → ISBN-10", () => {
    // 0 + 602123456 (9) ... length 12 mulai '0' → slice(1,11)
    const r = normalizeISBNBarcode("060212345678");
    expect(r.isbn).toBe("6021234567");
    expect(r.valid).toBe(true);
  });
});

describe("normalizeISBNBarcode — tidak valid", () => {
  it("bukan ISBN (barcode biasa) → valid=false", () => {
    const r = normalizeISBNBarcode("123456");
    expect(r.valid).toBe(false);
  });

  it("kosong → valid=false", () => {
    const r = normalizeISBNBarcode("");
    expect(r.valid).toBe(false);
    expect(r.isbn).toBe("");
  });

  it("teks non-numerik di-strip; panjang tak sesuai → valid=false", () => {
    const r = normalizeISBNBarcode("ABC-DEF");
    expect(r.valid).toBe(false);
  });
});

describe("resolveCoverState — sampul milik per judul", () => {
  it("sampul hasil unggahan dipakai apa adanya + overwrite", () => {
    const r = resolveCoverState({
      uploadedUrl: "/uploads/library/covers/abc.webp",
      ownedUrl: "/uploads/library/covers/lama.webp",
      isNewTitle: true,
    });
    expect(r).toEqual({
      coverUrl: "/uploads/library/covers/abc.webp",
      coverOverwrite: true,
    });
  });

  it("judul baru TIDAK mewarisi sampul judul lain", () => {
    const r = resolveCoverState({
      uploadedUrl: undefined,
      ownedUrl: "/uploads/library/covers/judul-lain.webp",
      isNewTitle: true,
    });
    expect(r.coverUrl).toBeUndefined();
    expect(r.coverOverwrite).toBe(false);
  });

  it("kandidat yang dipilih: pakai sampul miliknya, tanpa overwrite", () => {
    const r = resolveCoverState({
      uploadedUrl: undefined,
      ownedUrl: "/uploads/library/covers/milik-kandidat.webp",
      isNewTitle: false,
    });
    expect(r).toEqual({
      coverUrl: "/uploads/library/covers/milik-kandidat.webp",
      coverOverwrite: false,
    });
  });

  it("tanpa sampul sama sekali -> undefined, bukan string kosong", () => {
    const r = resolveCoverState({ isNewTitle: false });
    expect(r.coverUrl).toBeUndefined();
    expect(r.coverOverwrite).toBe(false);
  });

  it("spasi di URL diabaikan", () => {
    const r = resolveCoverState({ uploadedUrl: "   ", isNewTitle: false, ownedUrl: "  "});
    expect(r.coverUrl).toBeUndefined();
  });
});

describe("aiCacheKey — normalisasi judul & penulis", () => {
  it("trim + lowercase, dipisah '::'", () => {
    expect(aiCacheKey("  Laskar Pelangi ", " Andrea Hirata ")).toBe(
      "laskar pelangi::andrea hirata",
    );
  });

  it("deterministik: case/spasi berbeda → kunci sama", () => {
    expect(aiCacheKey("Buku", "Penulis")).toBe(aiCacheKey(" buku ", "PENULIS"));
  });
});
