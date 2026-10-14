import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from "@/lib/inventory";
import KategoriPage from "./page";

vi.mock("@/lib/inventory", () => ({
    getCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
}));

vi.mock("@/lib/stores/auth-store", () => ({
    useAuthStore: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const mockCategories = [
    { id: "c1", name: "Buku", codePrefix: "BK", kind: "ASSET", sortOrder: 40 },
    { id: "c2", name: "Alat Tulis Kantor", codePrefix: "ATK", kind: "ITEM", sortOrder: 10 },
];

async function renderPage(role: string) {
    vi.mocked(useAuthStore).mockReturnValue({ user: { role } as any });
    vi.mocked(getCategories).mockResolvedValue(mockCategories as any);
    vi.mocked(createCategory).mockResolvedValue({} as any);
    vi.mocked(updateCategory).mockResolvedValue({} as any);
    vi.mocked(deleteCategory).mockResolvedValue(true);

    render(<KategoriPage />);
    await waitFor(() => expect(screen.getAllByText("Buku").length).toBeGreaterThan(0));
}

describe("Kategori Inventaris", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("menampilkan daftar kategori dari API", async () => {
        await renderPage("superadmin");
        expect(screen.getAllByText("Buku").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Alat Tulis Kantor").length).toBeGreaterThan(0);
        // Awalan kode tampil.
        expect(screen.getAllByText("BK").length).toBeGreaterThan(0);
    });

    it("admin bisa menambah kategori & payload dikirim", async () => {
        await renderPage("superadmin");

        fireEvent.click(screen.getByText("Tambah Kategori"));

        const name = await screen.findByLabelText(/Nama Kategori/i);
        fireEvent.change(name, { target: { value: "Olahraga" } });
        const prefix = screen.getByLabelText(/Awalan Kode/i);
        fireEvent.change(prefix, { target: { value: "or" } });

        fireEvent.submit(document.querySelector("form")!);

        await waitFor(() => {
            expect(createCategory).toHaveBeenCalledWith(
                expect.objectContaining({ name: "Olahraga", codePrefix: "OR" })
            );
        });
    });

    it("non-admin tidak melihat tombol Tambah Kategori", async () => {
        await renderPage("guru");
        expect(screen.queryByText("Tambah Kategori")).not.toBeInTheDocument();
    });
});
