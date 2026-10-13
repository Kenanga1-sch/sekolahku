// Tes jaring pengaman untuk HistoryTab — mengunci ringkasan total sesi/menit
// dan daftar riwayat pemakaian.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { HistoryTab } from "./history-tab";
import type { ComputerSession } from "@/lib/computer";

vi.mock("@/lib/computer", () => ({
  listSessions: vi.fn(),
}));

const { listSessions } = await import("@/lib/computer");

function makeSessions(): ComputerSession[] {
  return [
    {
      id: "h1",
      studentName: "Budi",
      stationName: "Komputer 1",
      startedAt: "2026-10-13T08:00:00Z",
      minutesUsed: 20,
      endReason: "manual",
    } as ComputerSession,
    {
      id: "h2",
      studentName: "Siti",
      stationName: "Komputer 2",
      startedAt: "2026-10-13T09:00:00Z",
      minutesUsed: 15,
      endReason: "time_up",
    } as ComputerSession,
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  (listSessions as any).mockResolvedValue(makeSessions());
});

describe("HistoryTab", () => {
  it("memuat & menampilkan daftar riwayat", async () => {
    render(<HistoryTab />);
    await waitFor(() => expect(screen.getByText(/Budi/)).toBeInTheDocument());
    expect(screen.getByText(/Siti/)).toBeInTheDocument();
    expect(screen.getByText(/Komputer 1/)).toBeInTheDocument();
  });

  it("menampilkan ringkasan total sesi & total menit", async () => {
    render(<HistoryTab />);
    await waitFor(() => expect(screen.getByText("Total Sesi")).toBeInTheDocument());
    expect(screen.getByText("Total Menit")).toBeInTheDocument();
    const stats = document.querySelectorAll(".text-2xl.font-bold");
    const values = Array.from(stats).map((n) => n.textContent);
    expect(values).toContain("2");
    expect(values).toContain("35");
  });

  it("menampilkan menit per sesi", async () => {
    render(<HistoryTab />);
    await waitFor(() => expect(screen.getByText(/20 mnt/)).toBeInTheDocument());
    expect(screen.getByText(/15 mnt/)).toBeInTheDocument();
  });

  it("menampilkan badge Waktu habis untuk endReason time_up", async () => {
    render(<HistoryTab />);
    await waitFor(() => expect(screen.getByText("Waktu habis")).toBeInTheDocument());
  });

  it("menampilkan tombol muat ulang", async () => {
    render(<HistoryTab />);
    await waitFor(() =>
      expect(screen.getByLabelText("Muat ulang")).toBeInTheDocument(),
    );
  });
});
