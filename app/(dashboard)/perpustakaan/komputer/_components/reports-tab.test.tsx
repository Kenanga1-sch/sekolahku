// Tes jaring pengaman untuk ReportsTab — mengunci filter, badge status,
// tombol Setujui/Tolak, dan dialog penolakan.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReportsTab } from "./reports-tab";
import type { ReadingReport } from "@/lib/computer";

vi.mock("@/lib/computer", () => ({
  listReadingReports: vi.fn(),
  reviewReadingReport: vi.fn(),
  reportStatusLabel: (s: string) =>
    s === "approved" ? "Disetujui" : s === "rejected" ? "Ditolak" : "Menunggu",
}));

const { listReadingReports, reviewReadingReport } = await import("@/lib/computer");

function makeReports(): ReadingReport[] {
  return [
    {
      id: "r1",
      studentName: "Budi",
      className: "VII-A",
      bookTitle: "Laskar Pelangi",
      bookAuthor: "Andrea",
      status: "pending",
      summary: "Ringkasan A",
      conclusion: "Kesimpulan A",
      question: "Pertanyaan A",
      reviewNotes: "",
    } as ReadingReport,
    {
      id: "r2",
      studentName: "Siti",
      className: "VIII-B",
      bookTitle: "Bumi Manusia",
      bookAuthor: "Pram",
      status: "approved",
      summary: "Ringkasan B",
      conclusion: "Kesimpulan B",
      question: "Pertanyaan B",
      reviewNotes: "Bagus",
    } as ReadingReport,
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  (listReadingReports as any).mockResolvedValue(makeReports());
});

describe("ReportsTab", () => {
  it("memuat & menampilkan daftar laporan", async () => {
    render(<ReportsTab />);
    await waitFor(() => expect(screen.getByText("Laporan Baca")).toBeInTheDocument());
    expect(screen.getByText("Budi")).toBeInTheDocument();
    expect(screen.getByText("Siti")).toBeInTheDocument();
  });

  it("menampilkan badge status per laporan", async () => {
    render(<ReportsTab />);
    await waitFor(() => expect(screen.getByText("Menunggu")).toBeInTheDocument());
    expect(screen.getAllByText("Disetujui").length).toBeGreaterThan(0);
  });

  it("menampilkan judul buku & penulis", async () => {
    render(<ReportsTab />);
    await waitFor(() => expect(screen.getByText(/Laskar Pelangi/)).toBeInTheDocument());
    expect(screen.getByText(/Andrea/)).toBeInTheDocument();
  });

  it("menampilkan tombol Setujui & Tolak hanya untuk pending", async () => {
    render(<ReportsTab />);
    await waitFor(() => expect(screen.getByText("Setujui")).toBeInTheDocument());
    expect(screen.getByText("Tolak")).toBeInTheDocument();
    expect(screen.getAllByText("Setujui")).toHaveLength(1);
  });

  it("memanggil reviewReadingReport(true) saat Setujui", async () => {
    (reviewReadingReport as any).mockResolvedValue(undefined);
    render(<ReportsTab />);
    await waitFor(() => expect(screen.getByText("Setujui")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Setujui"));
    await waitFor(() =>
      expect(reviewReadingReport).toHaveBeenCalledWith("r1", true),
    );
  });

  it("membuka dialog Tolak & mengirim catatan", async () => {
    (reviewReadingReport as any).mockResolvedValue(undefined);
    render(<ReportsTab />);
    await waitFor(() => expect(screen.getByText("Tolak")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Tolak"));
    await waitFor(() =>
      expect(screen.getByText("Tolak Laporan")).toBeInTheDocument(),
    );
    const notes = screen.getByPlaceholderText(
      "Misalnya: kesimpulan belum sesuai isi buku.",
    );
    fireEvent.change(notes, { target: { value: "Kurang lengkap" } });
    // tombol "Tolak" di footer dialog adalah yang terakhir di DOM
    const tolakButtons = screen.getAllByText("Tolak");
    fireEvent.click(tolakButtons[tolakButtons.length - 1]);
    await waitFor(() =>
      expect(reviewReadingReport).toHaveBeenCalledWith("r1", false, "Kurang lengkap"),
    );
  });

  it("menampilkan catatan reviewer untuk laporan ditolak/disetujui", async () => {
    render(<ReportsTab />);
    await waitFor(() => expect(screen.getByText(/Catatan: Bagus/)).toBeInTheDocument());
  });

  it("memuat ulang saat filter diubah", async () => {
    render(<ReportsTab />);
    await waitFor(() => expect(screen.getByText("Budi")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("Menunggu"), {
      target: { value: "approved" },
    });
    await waitFor(() => expect(listReadingReports).toHaveBeenCalledTimes(2));
  });
});
