// Tes jaring pengaman untuk helper murni Cloud Storage (KindIcon, formatDate).
// Ditulis SEBELUM pemecahan file — mengunci perilaku yang sudah ada agar
// refactor ekstraksi tidak mengubah tampilan/format.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KindIcon, formatDate } from "./cloud-storage-helpers";
import type { CloudFile } from "@/lib/cloudstorage/api";

function makeFile(over: Partial<CloudFile>): CloudFile {
  return {
    id: "f1",
    owner_id: "u1",
    name: "berkas",
    is_folder: false,
    mime_type: "",
    size: 0,
    encrypted: false,
    created_at: 0,
    updated_at: 0,
    is_starred: false,
    sort_order: 0,
    ...over,
  };
}

describe("formatDate — Unix seconds → tanggal ringkas id-ID", () => {
  it("0 / falsy → '-'", () => {
    expect(formatDate(0)).toBe("-");
  });

  it("timestamp valid → tanggal ringkas (bukan string kosong)", () => {
    // 2023-11-14T22:13:20Z
    const out = formatDate(1700000000);
    expect(out).toMatch(/2023/);
    expect(out).toContain("Nov");
  });
});

describe("KindIcon — ikon kelas per jenis berkas", () => {
  it("folder memakai warna emerald", () => {
    const html = renderToStaticMarkup(<KindIcon file={makeFile({ is_folder: true })} />);
    expect(html).toContain("emerald");
  });

  it("gambar memakai warna sky", () => {
    const html = renderToStaticMarkup(<KindIcon file={makeFile({ mime_type: "image/png" })} />);
    expect(html).toContain("sky");
  });

  it("video memakai warna violet", () => {
    const html = renderToStaticMarkup(<KindIcon file={makeFile({ mime_type: "video/mp4" })} />);
    expect(html).toContain("violet");
  });

  it("audio memakai warna pink", () => {
    const html = renderToStaticMarkup(<KindIcon file={makeFile({ mime_type: "audio/mpeg" })} />);
    expect(html).toContain("pink");
  });

  it("pdf memakai warna rose", () => {
    const html = renderToStaticMarkup(<KindIcon file={makeFile({ mime_type: "application/pdf" })} />);
    expect(html).toContain("rose");
  });

  it("doc memakai warna amber", () => {
    const html = renderToStaticMarkup(<KindIcon file={makeFile({ mime_type: "application/msword" })} />);
    expect(html).toContain("amber");
  });

  it("jenis lain ('other') memakai warna neutral", () => {
    const html = renderToStaticMarkup(<KindIcon file={makeFile({ mime_type: "application/octet-stream" })} />);
    expect(html).toContain("neutral");
  });

  it("className tambahan diteruskan ke ikon (mis. ukuran)", () => {
    const html = renderToStaticMarkup(<KindIcon file={makeFile({ is_folder: true })} className="h-8 w-8" />);
    expect(html).toContain("h-8");
    expect(html).toContain("w-8");
  });

  it("default ukuran h-6 w-6 bila className tidak diberi", () => {
    const html = renderToStaticMarkup(<KindIcon file={makeFile({ is_folder: true })} />);
    expect(html).toContain("h-6");
    expect(html).toContain("w-6");
  });
});
