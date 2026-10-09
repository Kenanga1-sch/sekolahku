import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KartuPreview } from "./kartu-preview";
import { CARD_W_MM, CARD_H_MM } from "@/lib/kartu-print-layout";
import type { StudentCard } from "./use-cetak-kartu";

const student: StudentCard = {
  id: "S1",
  fullName: "Budi Santoso",
  nisn: "0012345678",
  nis: "2024001",
  kip: null,
  className: "VI A",
  photo: null,
  qrCode: "S1-0012345678",
  gender: "L",
  birthPlace: "Indramayu",
  birthDate: "2014-08-17",
};

const baseProps = {
  student,
  schoolName: "SDN 1 Kenanga",
  schoolAddress: "Jl. Pendidikan No. 1",
  schoolLogo: null,
  showPhoto: true,
  showNIS: true,
};

function renderCard(cardType: "pelajar" | "nisn" | "kip", forPrint: boolean): string {
  return renderToStaticMarkup(
    <KartuPreview {...baseProps} cardType={cardType} showBackSide printSide="combined" forPrint={forPrint} />
  );
}

describe("Dimensi kartu (sumber tunggal print-layout)", () => {
  it("88×58mm landscape — muat di plastik laminating 66×96mm", () => {
    expect(CARD_W_MM).toBe(88);
    expect(CARD_H_MM).toBe(58);
    expect(CARD_W_MM).toBeLessThan(96);
    expect(CARD_H_MM).toBeLessThan(66);
  });

  it.each(["pelajar", "nisn", "kip"] as const)("forPrint %s memakai 88mm × 58mm (bukan 85.6/54 lama)", (cardType) => {
    const html = renderCard(cardType, true);
    expect(html).toMatch(new RegExp(`width:\\s*${CARD_W_MM}mm`));
    expect(html).toMatch(new RegExp(`height:\\s*${CARD_H_MM}mm`));
    expect(html).not.toContain("85.6mm");
    expect(html).not.toMatch(/height:\s*54mm/);
  });

  it("preview layar mempertahankan rasio 88:58 (380×250px)", () => {
    const html = renderCard("pelajar", false);
    expect(html).toContain("380px");
    expect(html).toContain("250px");
    expect(html).not.toContain("240px");
  });
});

describe("Keterbacaan teks kartu", () => {
  it("teks isian berwarna hitam, bukan abu-abu slate", () => {
    for (const cardType of ["pelajar", "nisn", "kip"] as const) {
      const html = renderCard(cardType, true);
      expect(html).toContain("text-black");
      expect(html).not.toMatch(/text-slate-(400|500|600|700)/);
      expect(html).not.toContain("#58595b");
      expect(html).not.toContain("#475569");
    }
  });

  it("kartu pelajar punya spasi ekstra antara nama dan blok NISN (mb-2.5)", () => {
    const html = renderCard("pelajar", true);
    expect(html).toContain('class="mb-2.5"');
    expect(html).not.toContain('class="mb-1"');
  });
});
