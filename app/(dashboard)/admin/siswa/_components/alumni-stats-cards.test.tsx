// Tes jaring pengaman untuk AlumniStatsCards — mengunci 3 kartu ringkasan
// dan nilai statistiknya.
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AlumniStatsCards } from "./alumni-stats-cards";
import type { AlumniStats } from "../alumni-types";

const stats: AlumniStats = {
  totalAlumni: 120,
  totalDocuments: 80,
  pendingVerification: 7,
  activeCount: 90,
  graduatedCount: 20,
  transferredCount: 6,
  droppedCount: 4,
};

describe("AlumniStatsCards", () => {
  it("menampilkan 3 judul kartu", () => {
    render(<AlumniStatsCards stats={stats} />);
    expect(screen.getByText("Total Buku Induk")).toBeInTheDocument();
    expect(screen.getByText("Siswa Aktif")).toBeInTheDocument();
    expect(screen.getByText("Menunggu Verifikasi Dokumen")).toBeInTheDocument();
  });

  it("menampilkan nilai statistik", () => {
    render(<AlumniStatsCards stats={stats} />);
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("menampilkan 0 saat stats null", () => {
    render(<AlumniStatsCards stats={null} />);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(3);
  });
});
