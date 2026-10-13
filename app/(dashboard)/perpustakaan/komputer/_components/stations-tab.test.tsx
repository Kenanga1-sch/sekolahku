// Tes jaring pengaman untuk StationsTab — mengunci daftar kartu komputer,
// badge Tersedia/Dipakai, tombol hapus, dan dialog Tambah.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StationsTab } from "./stations-tab";
import type { ComputerStation } from "@/lib/computer";

vi.mock("@/lib/computer", () => ({
  listStations: vi.fn(),
  createStation: vi.fn(),
  deleteStation: vi.fn(),
}));

const { listStations, createStation, deleteStation } = await import("@/lib/computer");

function makeStations(): ComputerStation[] {
  return [
    { id: "s1", code: "PC-01", name: "Komputer 1", location: "Ruang A", activeSession: null },
    {
      id: "s2",
      code: "PC-02",
      name: "Komputer 2",
      location: "",
      activeSession: { studentName: "Budi" } as ComputerStation["activeSession"],
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  (listStations as any).mockResolvedValue(makeStations());
});

describe("StationsTab", () => {
  it("memuat & menampilkan daftar komputer", async () => {
    render(<StationsTab />);
    await waitFor(() => expect(screen.getByText("Komputer 1")).toBeInTheDocument());
    expect(screen.getByText("Komputer 2")).toBeInTheDocument();
    expect(screen.getByText("PC-01")).toBeInTheDocument();
  });

  it("menampilkan badge Tersedia & Dipakai", async () => {
    render(<StationsTab />);
    await waitFor(() => expect(screen.getByText("Tersedia")).toBeInTheDocument());
    expect(screen.getByText(/Dipakai: Budi/)).toBeInTheDocument();
  });

  it("menampilkan lokasi bila ada", async () => {
    render(<StationsTab />);
    await waitFor(() => expect(screen.getByText("Ruang A")).toBeInTheDocument());
  });

  it("menampilkan tombol hapus per komputer", async () => {
    render(<StationsTab />);
    await waitFor(() =>
      expect(screen.getByLabelText("Hapus Komputer 1")).toBeInTheDocument(),
    );
  });

  it("membuka dialog Tambah saat tombol diklik", async () => {
    render(<StationsTab />);
    await waitFor(() => expect(screen.getByText("Komputer 1")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Tambah"));
    await waitFor(() =>
      expect(screen.getByText("Tambah Komputer")).toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText("PC-01")).toBeInTheDocument();
  });

  it("menyimpan komputer baru lewat createStation", async () => {
    (createStation as any).mockResolvedValue(undefined);
    render(<StationsTab />);
    await waitFor(() => expect(screen.getByText("Komputer 1")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Tambah"));
    await waitFor(() => expect(screen.getByPlaceholderText("PC-01")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("PC-01"), {
      target: { value: "PC-09" },
    });
    fireEvent.change(screen.getByPlaceholderText("Komputer 1"), {
      target: { value: "Komputer Baru" },
    });
    fireEvent.click(screen.getByText("Simpan"));
    await waitFor(() => expect(createStation).toHaveBeenCalled());
  });

  it("menghapus komputer setelah konfirmasi", async () => {
    window.confirm = () => true;
    (deleteStation as any).mockResolvedValue(undefined);
    render(<StationsTab />);
    await waitFor(() => expect(screen.getByText("Komputer 1")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Hapus Komputer 1"));
    await waitFor(() => expect(deleteStation).toHaveBeenCalledWith("s1"));
  });
});
