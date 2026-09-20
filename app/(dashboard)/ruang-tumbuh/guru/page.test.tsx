import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { goGet, goPost } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import GuruRuangTumbuhPage from "./page";

vi.mock("@/lib/api-client", () => ({
  goGet: vi.fn(),
  goPost: vi.fn(),
}));

vi.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: vi.fn(),
}));

const mockGames = [
  { id: "game-tangkap-target", name: "Tangkap Target", description: "uji perhatian", isActive: true },
];

const mockClasses = [
  { id: "c1", name: "Kelas 4", isActive: true },
  { id: "c2", name: "Kelas 5", isActive: true },
];

async function renderPage(role: string) {
  vi.mocked(useAuthStore).mockReturnValue({ user: { role } as any });
  vi.mocked(goGet).mockImplementation(async (endpoint: string) => {
    if (endpoint.includes("/games")) return { data: mockGames };
    if (endpoint.includes("/academic/classes")) return { data: mockClasses };
    return { data: [] };
  });
  vi.mocked(goPost).mockResolvedValue({ success: true });

  render(<GuruRuangTumbuhPage />);
  await waitFor(() => expect(screen.getByText("Buat Sesi")).toBeInTheDocument());
}

describe("Skrining Siswa — buat sesi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin: pemilih kelas tampil & classId dikirim saat buat sesi", async () => {
    await renderPage("superadmin");

    fireEvent.click(screen.getByText("Buat Sesi"));

    // Deskripsi untuk staff/admin menyebut pemilihan kelas.
    expect(
      screen.getByText(/Pilih kelas yang akan diskrining/i),
    ).toBeInTheDocument();
    // Tombol kelas dari /api/academic/classes muncul.
    await waitFor(() => expect(screen.getByText("Kelas 4")).toBeInTheDocument());

    // Pilih game (Tangkap Target) lalu kelas, lalu buat.
    fireEvent.click(screen.getByText("Tangkap Target"));
    fireEvent.click(screen.getByText("Kelas 4"));

    fireEvent.click(screen.getAllByText("Buat Sesi").pop()!);

    await waitFor(() => {
      const call = vi.mocked(goPost).mock.calls[0];
      expect(call?.[0]).toContain("classId=c1");
    });
  });

  it("admin: tidak bisa buat sesi sebelum kelas dipilih", async () => {
    await renderPage("admin");

    fireEvent.click(screen.getByText("Buat Sesi"));
    fireEvent.click(screen.getByText("Tangkap Target"));

    const createBtn = screen.getAllByText("Buat Sesi").pop()!;
    // Tombol Buat Sesi di footer dialog disabled sampai kelas dipilih.
    expect(createBtn).toBeDisabled();
    expect(vi.mocked(goPost)).not.toHaveBeenCalled();
  });

  it("guru: tidak ada pemilih kelas & sesi dibuat tanpa classId", async () => {
    await renderPage("guru");

    fireEvent.click(screen.getByText("Buat Sesi"));

    expect(screen.getByText(/kelas Anda saat ini/i)).toBeInTheDocument();
    expect(screen.queryByText("Kelas 4")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Tangkap Target"));
    fireEvent.click(screen.getAllByText("Buat Sesi").pop()!);

    await waitFor(() => expect(vi.mocked(goPost)).toHaveBeenCalled());
    expect(vi.mocked(goPost).mock.calls[0]?.[0]).not.toContain("classId");
  });
});
