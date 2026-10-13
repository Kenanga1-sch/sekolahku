// Tes jaring pengaman untuk RowActions — mengunci daftar aksi per jenis berkas
// (urutan, label, tautan unduh, danger) yang dipakai BAIK di dropdown desktop
// maupun bottom-sheet mobile. Konten Radix hanya muncul saat dibuka, jadi test
// berinteraksi: klik trigger → baca menu.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { RowActions } from "./row-actions";
import { fileDownloadUrl } from "@/lib/cloudstorage/api";
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

const noop = () => {};

function renderAndOpenMenu(file: CloudFile, handlers: Partial<Record<string, () => void>> = {}) {
  const cb = {
    onPreview: noop,
    onRename: noop,
    onCopy: noop,
    onCut: noop,
    onShare: noop,
    onDelete: noop,
    onEdit: noop,
    onRotate: noop,
    onMoveTo: noop,
    onCopyTo: noop,
    ...handlers,
  };
  render(<RowActions file={file} {...cb} />);
  // Trigger pertama = menu desktop (hidden md:block). jsdom tak menerapkan CSS
  // media query, jadi keduanya ada di DOM; gunakan yang pertama. Radix butuh
  // pointerdown untuk membuka (bukan hanya click).
  const triggers = screen.getAllByRole("button", { name: "Menu berkas" });
  fireEvent.pointerDown(triggers[0], { button: 0, ctrlKey: false });
  fireEvent.click(triggers[0]);
  return screen.getByRole("menu");
}

/** Label menu-item yang tampil, urut sesuai DOM. */
function menuLabels(menu: HTMLElement): string[] {
  return within(menu)
    .getAllByRole("menuitem")
    .map((el) => el.textContent?.trim() ?? "");
}

describe("RowActions — daftar aksi per jenis berkas", () => {
  it("berkas biasa: Pratinjau…Hapus tanpa Edit teks & tanpa rotate", () => {
    const menu = renderAndOpenMenu(makeFile({ mime_type: "application/octet-stream" }));
    const labels = menuLabels(menu);
    expect(labels).toContain("Pratinjau");
    expect(labels).toContain("Unduh");
    expect(labels).toContain("Ganti Nama");
    expect(labels).toContain("Bagikan");
    expect(labels).toContain("Hapus");
    expect(labels).not.toContain("Edit teks");
    expect(labels.some((l) => l.startsWith("Putar 90°"))).toBe(false);
  });

  it("folder: tanpa Pratinjau/Edit teks/Unduh/rotate", () => {
    const menu = renderAndOpenMenu(makeFile({ is_folder: true }));
    const labels = menuLabels(menu);
    expect(labels).not.toContain("Pratinjau");
    expect(labels).not.toContain("Unduh");
    expect(labels).not.toContain("Edit teks");
    expect(labels.some((l) => l.startsWith("Putar 90°"))).toBe(false);
    expect(labels).toContain("Ganti Nama");
    expect(labels).toContain("Hapus");
  });

  it("berkas teks: menampilkan Edit teks", () => {
    const menu = renderAndOpenMenu(makeFile({ name: "catatan.txt", mime_type: "text/plain" }));
    expect(menuLabels(menu)).toContain("Edit teks");
  });

  it("gambar: menampilkan Putar kanan & kiri (urutan kanan dulu)", () => {
    const menu = renderAndOpenMenu(makeFile({ name: "foto.png", mime_type: "image/png" }));
    const labels = menuLabels(menu);
    const r = labels.findIndex((l) => l.includes("ke kanan"));
    const l = labels.findIndex((l) => l.includes("ke kiri"));
    expect(r).toBeGreaterThanOrEqual(0);
    expect(l).toBeGreaterThan(r);
  });
});

describe("RowActions — urutan & tautan", () => {
  it("urutan aksi berkas teks lengkap", () => {
    const menu = renderAndOpenMenu(makeFile({ name: "a.txt", mime_type: "text/plain" }));
    expect(menuLabels(menu)).toEqual([
      "Pratinjau",
      "Edit teks",
      "Unduh",
      "Ganti Nama",
      "Pindah ke…",
      "Salin ke…",
      "Salin",
      "Potong",
      "Bagikan",
      "Hapus",
    ]);
  });

  it("aksi Unduh memakai href fileDownloadUrl(id, true)", () => {
    const menu = renderAndOpenMenu(makeFile({ id: "abc123", mime_type: "application/pdf" }));
    const anchor = within(menu).getByRole("menuitem", { name: "Unduh" }).closest("a");
    expect(anchor?.getAttribute("href")).toBe(fileDownloadUrl("abc123", true));
  });
});

describe("RowActions — callback dipanggil sesuai aksi", () => {
  it("klik 'Ganti Nama' memanggil onRename; klik 'Hapus' memanggil onDelete", () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const menu = renderAndOpenMenu(makeFile(), { onRename, onDelete });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Ganti Nama" }));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("onRotate(90) untuk 'ke kanan' dan onRotate(270) untuk 'ke kiri'", () => {
    const onRotate = vi.fn();
    const menu = renderAndOpenMenu(makeFile({ name: "x.jpg", mime_type: "image/jpeg" }), { onRotate });
    fireEvent.click(within(menu).getByRole("menuitem", { name: /ke kanan/ }));
    expect(onRotate).toHaveBeenCalledWith(90);
    // menu tertutup setelah run(); buka lagi untuk aksi kedua
    const trigger2 = screen.getAllByRole("button", { name: "Menu berkas" })[0];
    fireEvent.pointerDown(trigger2, { button: 0, ctrlKey: false });
    fireEvent.click(trigger2);
    const menu2 = screen.getByRole("menu");
    fireEvent.click(within(menu2).getByRole("menuitem", { name: /ke kiri/ }));
    expect(onRotate).toHaveBeenCalledWith(270);
  });
});
