import { describe, expect, it } from "vitest";

import { fileKind, formatBytes, isEditableText, splitByUploadLimit, type CloudFile } from "./api";

/** Bangun CloudFile minimal untuk pengujian. */
function mk(partial: Partial<CloudFile>): CloudFile {
  return {
    id: "x",
    owner_id: "u",
    name: "berkas",
    is_folder: false,
    mime_type: "",
    size: 0,
    encrypted: false,
    created_at: 0,
    updated_at: 0,
    is_starred: false,
    sort_order: 0,
    ...partial,
  };
}

describe("fileKind", () => {
  it("folder dikenali dari is_folder", () => {
    expect(fileKind(mk({ is_folder: true, mime_type: "" }))).toBe("folder");
  });

  it.each([
    ["image/png", "image"],
    ["video/mp4", "video"],
    ["audio/mpeg", "audio"],
    ["application/pdf", "pdf"],
    ["text/plain", "doc"],
    ["text/html", "doc"],
    ["application/msword", "doc"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "doc"],
    ["application/octet-stream", "other"],
    ["", "other"],
  ])("mime %s → %s", (mime, kind) => {
    expect(fileKind(mk({ mime_type: mime }))).toBe(kind);
  });
});

describe("isEditableText", () => {
  it("false untuk folder", () => {
    expect(isEditableText(mk({ is_folder: true, mime_type: "text/plain" }))).toBe(false);
  });

  it("true untuk text/*", () => {
    expect(isEditableText(mk({ mime_type: "text/plain" }))).toBe(true);
    expect(isEditableText(mk({ mime_type: "text/markdown" }))).toBe(true);
  });

  it("true untuk application/json/xml/yaml/js", () => {
    expect(isEditableText(mk({ mime_type: "application/json" }))).toBe(true);
    expect(isEditableText(mk({ mime_type: "application/xml" }))).toBe(true);
  });

  it("true berdasarkan ekstensi (tanpa mime)", () => {
    for (const name of ["a.md", "a.txt", "b.csv", "c.yml", "d.yaml", "e.json", "f.log"]) {
      expect(isEditableText(mk({ name, mime_type: "" }))).toBe(true);
    }
  });

  it("false untuk tipe non-teks", () => {
    expect(isEditableText(mk({ name: "foto.jpg", mime_type: "image/jpeg" }))).toBe(false);
    expect(isEditableText(mk({ name: "video.mp4", mime_type: "video/mp4" }))).toBe(false);
    expect(isEditableText(mk({ name: "app.exe", mime_type: "application/octet-stream" }))).toBe(false);
  });
});

describe("formatBytes", () => {
  it("0 / negatif / non-finite → '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(Infinity)).toBe("0 B");
  });

  it("byte, KB, MB, GB dengan pembulatan wajar", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10 * 1024)).toBe("10 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });

  it("nilai sangat besar tidak menghasilkan unit undefined", () => {
    const out = formatBytes(5 * 1024 * 1024 * 1024 * 1024 * 1024);
    expect(out).not.toContain("undefined");
    expect(out.endsWith("TB")).toBe(true);
  });
});

describe("splitByUploadLimit", () => {
  const f = (name: string, size: number) => ({ name, size });

  it("tanpa batas (0) → semua diterima", () => {
    const r = splitByUploadLimit([f("a", 10), f("b", 999)], 0);
    expect(r.accepted).toHaveLength(2);
    expect(r.rejected).toHaveLength(0);
  });

  it("memisahkan yang melebihi batas", () => {
    const r = splitByUploadLimit([f("kecil", 50), f("besar", 200)], 100);
    expect(r.accepted.map((x) => x.name)).toEqual(["kecil"]);
    expect(r.rejected.map((x) => x.name)).toEqual(["besar"]);
  });

  it("tepat sama dengan batas → diterima", () => {
    const r = splitByUploadLimit([f("pas", 100)], 100);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
  });

  it("semua melebihi batas → accepted kosong", () => {
    const r = splitByUploadLimit([f("a", 200), f("b", 300)], 100);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected).toHaveLength(2);
  });

  it("daftar kosong", () => {
    const r = splitByUploadLimit([], 100);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected).toHaveLength(0);
  });
});
