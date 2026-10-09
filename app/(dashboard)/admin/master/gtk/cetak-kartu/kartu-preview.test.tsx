// Tes render kartu GTK: konten identitas (nama, NIP, NUPTK, jabatan) + QR.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KartuGtkPreview, gtkCardIdentity } from "./kartu-preview";
import { CARD_W_MM, CARD_H_MM } from "@/lib/kartu-print-layout";
import type { GtkCard } from "./use-cetak-kartu";

const baseCard: GtkCard = {
  id: "emp-1",
  // name = TANPA gelar, degree terpisah — persis pola data produksi.
  name: "Budi Santoso",
  email: "budi@sekolah.id",
  nip: "197001011990031001",
  nuptk: "1234567890123456",
  employmentStatus: "PNS",
  jobType: "Guru Kelas",
  category: "guru",
  degree: "S.Pd",
  photoUrl: null,
  qrCode: "GTK-197001011990031001",
};

const baseProps = {
  card: baseCard,
  schoolName: "SDN 1 Kenanga",
  schoolAddress: "Jl. Pendidikan No. 1",
  schoolLogo: null,
  showPhoto: true,
  showNIP: true,
};

function renderGtk(opts: { showBackSide?: boolean; forPrint?: boolean; printSide?: "front" | "back" | "combined"; showNIP?: boolean; card?: GtkCard } = {}): string {
  const { showBackSide = true, forPrint = false, printSide = "combined", showNIP = true, card = baseCard } = opts;
  return renderToStaticMarkup(
    <KartuGtkPreview {...baseProps} card={card} showNIP={showNIP} showBackSide={showBackSide} printSide={printSide} forPrint={forPrint} />
  );
}

describe("Dimensi kartu GTK (sumber tunggal lib/kartu-print-layout)", () => {
  it("88mm × 58mm — sama dengan kartu siswa (plastik laminating seragam)", () => {
    expect(CARD_W_MM).toBe(88);
    expect(CARD_H_MM).toBe(58);
  });

  it("forPrint memakai 88mm × 58mm; preview layar 380×250px", () => {
    const print = renderGtk({ forPrint: true });
    expect(print).toMatch(new RegExp(`width:\\s*${CARD_W_MM}mm`));
    expect(print).toMatch(new RegExp(`height:\\s*${CARD_H_MM}mm`));
    const screen = renderGtk();
    expect(screen).toContain("380px");
    expect(screen).toContain("250px");
  });
});

describe("gtkCardIdentity — qrCode stabil → NIP → NUPTK → id", () => {
  it("prioritas qrCode stabil dari DB", () => {
    expect(gtkCardIdentity(baseCard)).toBe("GTK-197001011990031001");
  });
  it("tanpa qrCode (data lama) → NIP", () => {
    expect(gtkCardIdentity({ ...baseCard, qrCode: "" })).toBe("197001011990031001");
  });
  it("tanpa qrCode & NIP → NUPTK", () => {
    expect(gtkCardIdentity({ ...baseCard, qrCode: "", nip: null })).toBe("1234567890123456");
  });
  it("tanpa qrCode, NIP & NUPTK → id", () => {
    expect(gtkCardIdentity({ ...baseCard, qrCode: "", nip: null, nuptk: null })).toBe("emp-1");
  });
});

describe("KartuGTK — konten depan", () => {
  it("menampilkan nama + gelar hasil gabungan, NIP, NUPTK, jabatan, status", () => {
    const html = renderGtk({ showBackSide: false });
    // formatNamaGtk(name, degree) → "Budi Santoso, S.Pd".
    expect(html).toContain("Budi Santoso, S.Pd");
    expect(html).not.toMatch(/>Budi Santoso</); // tidak tampil polos tanpa gelar
    expect(html).toContain("197001011990031001");
    expect(html).toContain("1234567890123456");
    expect(html).toContain("Guru Kelas");
    expect(html).toContain("PNS");
  });

  it("showNIP=false menyembunyikan NIP (NUPTK tetap tampil)", () => {
    const html = renderGtk({ showBackSide: false, showNIP: false });
    expect(html).not.toContain("197001011990031001");
    expect(html).toContain("1234567890123456");
  });

  it("footer ID memakai 8 karakter terakhir NIP", () => {
    const html = renderGtk({ showBackSide: false });
    // NIP 197001011990031001 → 8 char terakhir = 90031001.
    expect(html).toMatch(/ID:\s*90031001/);
  });

  it("staff tanpa NIP: baris NIP tidak dirender, NUPTK tetap ada", () => {
    const staff: GtkCard = { ...baseCard, nip: null, jobType: "Tenaga Administrasi", employmentStatus: "Honorer", category: "staff" };
    const html = renderGtk({ showBackSide: false, card: staff });
    expect(html).not.toContain("197001011990031001");
    expect(html).toContain("Tenaga Administrasi");
    expect(html).toContain("1234567890123456");
  });
});

describe("KartuGTK — sisi belakang", () => {
  it("berisi ketentuan penggunaan + QR identitas", () => {
    const html = renderGtk();
    expect(html).toContain("Ketentuan Penggunaan");
    expect(html).toContain("Tidak boleh dipindahtangankan");
  });

  it("printSide=back hanya merender belakang (nama tak ada)", () => {
    const html = renderGtk({ printSide: "back", forPrint: true });
    expect(html).not.toContain("Budi Santoso, S.Pd");
    expect(html).toContain("Ketentuan Penggunaan");
  });

  it("footer kategori: guru → label Guru", () => {
    const html = renderGtk({ printSide: "back" });
    expect(html).toContain("Guru ·");
  });
});
