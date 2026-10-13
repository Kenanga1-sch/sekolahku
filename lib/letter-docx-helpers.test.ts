// Tes jaring pengaman untuk helper DOCX (letter-docx-helpers).
// Mengunci konversi mm→twip, substitusi variabel, dan baris label.
import { describe, it, expect } from "vitest";
import { mmToTwip, substitute, labelRow, makeImageResolver } from "./letter-docx-helpers";

describe("mmToTwip", () => {
  it("mengonversi mm ke twip dengan pembulatan", () => {
    expect(mmToTwip(10)).toBe(Math.round(10 * 56.6929));
    expect(mmToTwip(0)).toBe(0);
  });
});

describe("substitute", () => {
  it("mengganti variabel yang terdefinisi", () => {
    expect(substitute("Halo {{nama}}", { nama: "Budi" })).toBe("Halo Budi");
  });

  it("menyisakan placeholder bila variabel tak ada atau kosong", () => {
    expect(substitute("Halo {{nama}}", {})).toBe("Halo {{nama}}");
    expect(substitute("Halo {{nama}}", { nama: "" })).toBe("Halo {{nama}}");
  });

  it("mengembalikan string kosong untuk input kosong", () => {
    expect(substitute("", { a: "b" })).toBe("");
  });
});

describe("labelRow", () => {
  it("menghasilkan Paragraph tanpa melempar", () => {
    const p = labelRow("Nomor", "001/2026");
    expect(p).toBeTruthy();
  });
});

describe("makeImageResolver", () => {
  it("mengembalikan null bila URL tak ada di peta", () => {
    const resolver = makeImageResolver(new Map());
    expect(resolver("http://x/y.png", 100)).toBeNull();
  });
});
