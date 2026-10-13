// Tes jaring pengaman untuk BookingsTab — mengunci daftar jadwal, badge status,
// tombol batal, dan dialog Booking.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BookingsTab } from "./bookings-tab";
import type { ComputerBooking, ComputerStation, ReadingReport } from "@/lib/computer";

vi.mock("@/lib/computer", () => ({
  listBookings: vi.fn(),
  listStations: vi.fn(),
  listReadingReports: vi.fn(),
  createComputerBooking: vi.fn(),
  cancelComputerBooking: vi.fn(),
  bookingStatusLabel: (s: string) =>
    s === "active" ? "Berjalan" : s === "booked" ? "Dijadwalkan" : "Selesai",
}));

const {
  listBookings,
  listStations,
  listReadingReports,
  createComputerBooking,
  cancelComputerBooking,
} = await import("@/lib/computer");

const bookings: ComputerBooking[] = [
  {
    id: "b1",
    studentName: "Budi",
    stationName: "Komputer 1",
    slotStart: "2026-10-13T08:00:00Z",
    plannedMinutes: 30,
    status: "booked",
  } as ComputerBooking,
  {
    id: "b2",
    studentName: "Siti",
    stationName: "Komputer 2",
    slotStart: "2026-10-13T09:00:00Z",
    plannedMinutes: 45,
    status: "done",
  } as ComputerBooking,
];

const stations: ComputerStation[] = [
  { id: "s1", code: "PC-01", name: "Komputer 1", activeSession: null },
];

const reports: ReadingReport[] = [
  {
    id: "r1",
    studentName: "Budi",
    className: "VII-A",
    bookTitle: "Laskar Pelangi",
    status: "approved",
    studentId: "stu1",
  } as ReadingReport,
];

beforeEach(() => {
  vi.clearAllMocks();
  (listBookings as any).mockResolvedValue(bookings);
  (listStations as any).mockResolvedValue(stations);
  (listReadingReports as any).mockResolvedValue(reports);
});

describe("BookingsTab", () => {
  it("memuat & menampilkan daftar jadwal", async () => {
    render(<BookingsTab />);
    await waitFor(() => expect(screen.getByText(/Budi/)).toBeInTheDocument());
    expect(screen.getByText(/Siti/)).toBeInTheDocument();
  });

  it("menampilkan nama stasiun & durasi", async () => {
    render(<BookingsTab />);
    await waitFor(() => expect(screen.getByText(/Komputer 1/)).toBeInTheDocument());
    expect(screen.getByText(/45 menit/)).toBeInTheDocument();
  });

  it("menampilkan label status via bookingStatusLabel", async () => {
    render(<BookingsTab />);
    await waitFor(() => expect(screen.getByText("Dijadwalkan")).toBeInTheDocument());
    expect(screen.getByText("Selesai")).toBeInTheDocument();
  });

  it("menampilkan tombol batal hanya untuk booked/active", async () => {
    render(<BookingsTab />);
    await waitFor(() => expect(screen.getByText("Dijadwalkan")).toBeInTheDocument());
    expect(screen.getAllByLabelText("Batalkan jadwal")).toHaveLength(1);
  });

  it("membatalkan jadwal setelah konfirmasi", async () => {
    window.confirm = () => true;
    (cancelComputerBooking as any).mockResolvedValue(undefined);
    render(<BookingsTab />);
    await waitFor(() => expect(screen.getByText("Dijadwalkan")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Batalkan jadwal"));
    await waitFor(() => expect(cancelComputerBooking).toHaveBeenCalledWith("b1"));
  });

  it("membuka dialog Booking dengan opsi laporan & komputer", async () => {
    render(<BookingsTab />);
    await waitFor(() => expect(screen.getByText(/Budi/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("Booking"));
    await waitFor(() =>
      expect(screen.getByText("Booking Komputer")).toBeInTheDocument(),
    );
    expect(screen.getByText("Budi (VII-A) — Laskar Pelangi")).toBeInTheDocument();
    expect(screen.getByText("Komputer 1 (PC-01)")).toBeInTheDocument();
  });

  it("membuat jadwal lewat createComputerBooking", async () => {
    (createComputerBooking as any).mockResolvedValue(bookings[0]);
    render(<BookingsTab />);
    await waitFor(() => expect(screen.getByText(/Budi/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("Booking"));
    await waitFor(() => expect(screen.getByText("Booking Komputer")).toBeInTheDocument());
    const reportSel = document.querySelector("#bk-report") as HTMLSelectElement;
    const stationSel = document.querySelector("#bk-station") as HTMLSelectElement;
    const startInput = document.querySelector("#bk-start") as HTMLInputElement;
    fireEvent.change(reportSel, { target: { value: "r1" } });
    fireEvent.change(stationSel, { target: { value: "s1" } });
    fireEvent.change(startInput, { target: { value: "2026-10-13T08:00" } });
    fireEvent.click(screen.getByText("Simpan"));
    await waitFor(() =>
      expect(createComputerBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          stationId: "s1",
          studentId: "stu1",
          reportId: "r1",
          plannedMinutes: 30,
        }),
      ),
    );
  });
});
