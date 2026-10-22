import { describe, expect, it } from "vitest";
import { emptyWordVariables, unknownWordVariables, wordFilename } from "./template-word";
import { resolveWordTemplate } from "./template-word";

describe("unknownWordVariables", () => {
  it("melaporkan token tanpa nilai", () => {
    expect(
      unknownWordVariables(["nama", "kelas", "tanggal"], { nama: "Andi", tanggal: "1 Okt" })
    ).toEqual(["kelas"]);
  });
  it("nilai kosong dianggap tak terisi", () => {
    expect(unknownWordVariables(["nama"], { nama: "" })).toEqual(["nama"]);
  });
  it("section loop diabaikan bila array tersedia", () => {
    expect(unknownWordVariables(["siswa"], { siswa: [{ nama: "A" }] })).toEqual([]);
  });
  it("kosong bila semua terisi", () => {
    expect(unknownWordVariables(["a", "b"], { a: 1, b: 2 })).toEqual([]);
  });
});

describe("emptyWordVariables", () => {
  it("hanya melaporkan kunci yang ada tapi kosong", () => {
    expect(emptyWordVariables(["nama", "kelas", "tanggal"], { nama: "", tanggal: "1 Okt" })).toEqual([
      "nama",
    ]);
  });
  it("token tanpa kunci bukan 'kosong' (itu unknown)", () => {
    expect(emptyWordVariables(["tidak_ada"], { nama: "Andi" })).toEqual([]);
  });
  it("null/undefined juga dianggap kosong", () => {
    expect(emptyWordVariables(["a", "b"], { a: null, b: undefined })).toEqual(["a", "b"]);
  });
});

describe("wordFilename", () => {
  it("slug + .docx", () => {
    expect(wordFilename("SK Kenaikan Kelas")).toBe("sk-kenaikan-kelas.docx");
  });
  it("tidak dobel ekstensi", () => {
    expect(wordFilename("laporan.docx")).toBe("laporan-docx.docx");
  });
});

describe("resolveWordTemplate", () => {
  const okFetch = (data: unknown, status = 200) =>
    (async () => ({
      ok: status === 200,
      status,
      json: async () => data,
    })) as unknown as typeof fetch;

  it("menolak bila belum ada default (404)", async () => {
    await expect(resolveWordTemplate("arsip", okFetch(null, 404))).rejects.toThrow("Belum ada template");
  });

  it("menolak template default yang bukan docx", async () => {
    const f = okFetch({ success: true, data: { filePath: "templates/x.xlsx", kind: "xlsx" } });
    await expect(resolveWordTemplate("tabungan", f)).rejects.toThrow("bukan Word");
  });

  it("menerima default docx", async () => {
    const f = okFetch({
      success: true,
      data: { filePath: "templates/sk-v1.docx", kind: "docx", code: "RPT_SK", name: "SK" },
    });
    const res = await resolveWordTemplate("kepegawaian", f);
    // Path lama templates/... = publik (tanpa /api/files).
    expect(res).toEqual({ url: "/templates/sk-v1.docx", code: "RPT_SK", name: "SK" });
  });

  it("mengarahkan unggahan uploads/templates via endpoint terautentikasi", async () => {
    const f = okFetch({
      success: true,
      data: { filePath: "uploads/templates/rpt-1.docx", kind: "docx", code: "RPT_X", name: "X" },
    });
    const res = await resolveWordTemplate("arsip", f);
    expect(res.url).toBe("/api/files/uploads/templates/rpt-1.docx");
  });

  it("menerima filePath docx tanpa kind (kompatibel lama)", async () => {
    const f = okFetch({ success: true, data: { filePath: "templates/lama.docx", kind: "" } });
    const res = await resolveWordTemplate("arsip", f);
    expect(res.url).toBe("/templates/lama.docx");
  });

  it("memakai template bawaan repo bila default modul belum ada", async () => {
    const res = await resolveWordTemplate("buku-induk", okFetch(null, 404), "", "/templates/buku-induk-v1.docx");
    expect(res).toEqual({
      url: "/templates/buku-induk-v1.docx",
      code: "",
      name: "",
      fromFallback: true,
    });
  });

  it("memakai template bawaan repo bila default bukan docx", async () => {
    const f = okFetch({ success: true, data: { filePath: "templates/x.xlsx", kind: "xlsx" } });
    const res = await resolveWordTemplate("buku-induk", f, "", "/templates/buku-induk-v1.docx");
    expect(res.fromFallback).toBe(true);
  });

  it("memakai template bawaan repo bila jaringan gagal", async () => {
    const failing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const res = await resolveWordTemplate("buku-induk", failing, "", "/templates/buku-induk-v1.docx");
    expect(res.url).toBe("/templates/buku-induk-v1.docx");
  });
});

