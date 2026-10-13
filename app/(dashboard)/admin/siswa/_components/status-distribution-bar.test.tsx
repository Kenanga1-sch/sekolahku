// Tes jaring pengaman untuk StatusDistributionBar — mengunci total siswa,
// legenda persentase, dan segmen bar.
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusDistributionBar } from "./status-distribution-bar";
import type { AlumniStats } from "../alumni-types";

const stats: AlumniStats = {
  totalAlumni: 120,
  totalDocuments: 80,
  pendingVerification: 7,
  activeCount: 50,
  graduatedCount: 30,
  transferredCount: 10,
  droppedCount: 10,
};

describe("StatusDistributionBar", () => {
  it("menampilkan total siswa", () => {
    render(
      <StatusDistributionBar
        stats={stats}
        totalStudents={100}
        activePct={50}
        graduatedPct={30}
        transferredPct={10}
        droppedPct={10}
      />,
    );
    expect(screen.getByText(/100 Total Siswa/)).toBeInTheDocument();
  });

  it("menampilkan legenda tiap status", () => {
    render(
      <StatusDistributionBar
        stats={stats}
        totalStudents={100}
        activePct={50}
        graduatedPct={30}
        transferredPct={10}
        droppedPct={10}
      />,
    );
    expect(screen.getByText("Distribusi Status Siswa")).toBeInTheDocument();
    expect(screen.getByText(/Aktif:/)).toBeInTheDocument();
    expect(screen.getByText(/Alumni:/)).toBeInTheDocument();
    expect(screen.getByText(/Pindahan:/)).toBeInTheDocument();
    expect(screen.getByText(/Keluar:/)).toBeInTheDocument();
  });

  it("menampilkan persentase yang diberikan", () => {
    render(
      <StatusDistributionBar
        stats={stats}
        totalStudents={100}
        activePct={50}
        graduatedPct={30}
        transferredPct={10}
        droppedPct={10}
      />,
    );
    expect(screen.getByText(/\(50%\)/)).toBeInTheDocument();
    expect(screen.getByText(/\(30%\)/)).toBeInTheDocument();
  });
});
