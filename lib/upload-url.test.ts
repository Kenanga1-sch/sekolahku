import { describe, expect, it } from "vitest";
import { resolveUploadUrl } from "@/lib/upload-url";

describe("resolveUploadUrl", () => {
  it("meneruskan URL absolut dan data URL apa adanya", () => {
    expect(resolveUploadUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(resolveUploadUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("menyajikan folder publik lewat /uploads/*", () => {
    // "gallery" = folder publik; gambar laporan diunggah ke sini.
    expect(resolveUploadUrl("/uploads/gallery/x.png")).toBe("/uploads/gallery/x.png");
    expect(resolveUploadUrl("gallery/x.png")).toBe("/uploads/gallery/x.png");
  });

  it("mengarahkan folder privat ke endpoint terautentikasi", () => {
    expect(resolveUploadUrl("/uploads/spmb/x.pdf")).toBe("/api/files/uploads/spmb/x.pdf");
    expect(resolveUploadUrl("uploads/templates/rpt-1.xlsx")).toBe("/api/files/uploads/templates/rpt-1.xlsx");
  });

  it("melewatkan path template lama (publik) apa adanya", () => {
    expect(resolveUploadUrl("templates/custom-v2.xlsx")).toBe("/templates/custom-v2.xlsx");
  });

  it("mengembalikan undefined untuk input kosong", () => {
    expect(resolveUploadUrl(undefined)).toBeUndefined();
    expect(resolveUploadUrl("")).toBeUndefined();
  });
});
