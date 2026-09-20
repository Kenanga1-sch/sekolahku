import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { goGet } from "@/lib/api-client";
import StaffAggregatePage from "./page";

vi.mock("@/lib/api-client", () => ({
  goGet: vi.fn(),
}));

describe("Agregat Skrining (staff)", () => {
  it("merender state kosong saat backend mengirim array null", async () => {
    // Kondisi produksi: belum ada sesi skrining sama sekali. Backend
    // mengirim slice nil yang diserialisasi menjadi JSON null. Tanpa
    // normalisasi, agg.domainStats.length melempar TypeError dan halaman
    // jatuh ke root error boundary ("Terjadi Kesalahan Sistem.").
    vi.mocked(goGet).mockResolvedValueOnce({
      success: true,
      data: {
        totalStudents: 0,
        screenedCount: 0,
        domainStats: null,
        recentSessions: null,
      },
    });

    render(<StaffAggregatePage />);

    await waitFor(() => {
      expect(screen.getByText("Belum ada hasil yang terkumpul.")).toBeInTheDocument();
    });
    expect(screen.getByText("Belum ada sesi.")).toBeInTheDocument();
    expect(screen.getByText("Total Sesi")).toBeInTheDocument();
    // Tiga kartu metrik (total sesi, siswa diskrining, domain diukur) semua 0.
    expect(screen.getAllByText("0")).toHaveLength(3);
  });
});
