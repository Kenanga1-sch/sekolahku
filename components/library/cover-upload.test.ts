// Tes alur upload sampul (CoverField) — memastikan kontrak ke backend
// POST /api/library/catalog/cover tetap: field `file` + opsional `isbn`,
// dan respons {url} dipetakan menjadi URL sampul.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { goPost } from "@/lib/api-client";

import { uploadCoverFile } from "./cover-upload";

vi.mock("@/lib/api-client", () => ({ goPost: vi.fn() }));

// compressImage asli memakai FileReader+Image yang tak pernah "load" di jsdom;
// unit di sini menguji kontrak upload, bukan kompresi.
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return { ...actual, compressImage: vi.fn(async (f: File) => f) };
});

const goPostMock = vi.mocked(goPost);
const pngFile = () => new File(["png"], "cover.png", { type: "image/png" });

describe("uploadCoverFile", () => {
  beforeEach(() => {
    goPostMock.mockReset();
  });

  it("mengirim FormData (file+isbn) ke endpoint cover dan mengembalikan url", async () => {
    goPostMock.mockResolvedValue({ url: "/uploads/library/covers/978-x.jpg" });

    const url = await uploadCoverFile(pngFile(), "978-123");

    expect(url).toBe("/uploads/library/covers/978-x.jpg");
    expect(goPostMock).toHaveBeenCalledTimes(1);
    const [endpoint, body] = goPostMock.mock.calls[0] as [string, FormData];
    expect(endpoint).toBe("/api/library/catalog/cover");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("isbn")).toBe("978-123");
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("isbn tidak dikirim bila kosong", async () => {
    goPostMock.mockResolvedValue({ url: "/uploads/library/covers/ts.jpg" });

    await uploadCoverFile(pngFile());

    const body = goPostMock.mock.calls[0][1] as FormData;
    expect(body.get("isbn")).toBeNull();
  });

  it("respons error server → melempar pesan error tersebut", async () => {
    goPostMock.mockResolvedValue({ error: "Ukuran file melebihi batas 5 MB" });

    await expect(uploadCoverFile(pngFile())).rejects.toThrow("5 MB");
  });

  it("file non-gambar ditolak di klien tanpa memanggil server", async () => {
    const pdf = new File(["pdf"], "dokumen.pdf", { type: "application/pdf" });

    await expect(uploadCoverFile(pdf)).rejects.toThrow("berupa gambar");
    expect(goPostMock).not.toHaveBeenCalled();
  });
});
