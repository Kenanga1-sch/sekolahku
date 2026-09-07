import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock api-client sebelum import modul yang diuji.
vi.mock("@/lib/api-client", () => ({
    goGet: vi.fn(),
    goPost: vi.fn(),
    goPut: vi.fn(),
    goDelete: vi.fn(),
}));

import {
    getInventoryStats,
    getCategoryDistribution,
    getConditionBreakdown,
    getTopRoomsByValue,
    getAssets,
    getAssetReport,
    unwrapItems,
    returnBorrowRequest,
} from "@/lib/inventory";
import { goGet, goPost } from "@/lib/api-client";

const mockedGet = vi.mocked(goGet);
const mockedPost = vi.mocked(goPost);

beforeEach(() => {
    vi.clearAllMocks();
});

describe("getInventoryStats", () => {
    it("membuka data dari respons backend", async () => {
        mockedGet.mockResolvedValue({
            success: true,
            data: { totalAssets: 5, totalValue: 1000, totalItems: 7, itemsGood: 4, itemsDamaged: 2, itemsLost: 1 },
        } as never);
        const stats = await getInventoryStats();
        expect(stats.totalAssets).toBe(5);
        expect(mockedGet).toHaveBeenCalledWith("/api/inventory/stats");
    });

    it("tidak lagi menelan error (respons palsu dulu berupa nol semua)", async () => {
        mockedGet.mockRejectedValue(new Error("API Error: 500"));
        // Sebelumnya catch mengembalikan statistik nol — kegagalan query tidak
        // bisa dibedakan dari "belum ada inventaris". Kini error diteruskan.
        await expect(getInventoryStats()).rejects.toThrow("API Error: 500");
    });
});

describe("agregat dashboard", () => {
    it("getCategoryDistribution memanggil endpoint nyata, bukan data karangan", async () => {
        const fake = [{ name: "Elektronik", value: 3, color: "#3b82f6" }];
        mockedGet.mockResolvedValue(fake as never);
        const out = await getCategoryDistribution();
        // Sebelumnya: mengembalikan [{Elektronik:10},{Furniture:20},...] yang di-hardcode,
        // hasil fetch bahkan tidak dipakai.
        expect(out).toEqual(fake);
        expect(mockedGet).toHaveBeenCalledWith("/api/inventory/data?type=category-distribution");
    });

    it("getConditionBreakdown tidak membelah dua itemsDamaged", async () => {
        const fake = [{ name: "Baik", value: 9, color: "#10b981" }];
        mockedGet.mockResolvedValue(fake as never);
        const out = await getConditionBreakdown();
        expect(out).toEqual(fake);
    });

    it("getTopRoomsByValue tidak lagi mengembalikan array kosong", async () => {
        const fake = [{ id: "r1", name: "Lab", assetCount: 4, totalValue: 5000 }];
        mockedGet.mockResolvedValue(fake as never);
        const out = await getTopRoomsByValue();
        expect(out).toEqual(fake);
    });
});

describe("getAssets", () => {
    it("mengirim filter kategori sebagai parameter (dulu tidak pernah dikirim)", async () => {
        mockedGet.mockResolvedValue({ items: [], totalPages: 1, totalItems: 0 } as never);
        await getAssets(1, 20, { search: "proy", category: "Elektronik" });
        const url = mockedGet.mock.calls[0][0] as string;
        expect(url).toContain("category=Elektronik");
        expect(url).toContain("search=proy");
    });

    it("search diteruskan sebagai parameter, bukan string PocketBase", async () => {
        mockedGet.mockResolvedValue({ items: [], totalPages: 1, totalItems: 0 } as never);
        await getAssets(1, 20, { search: 'lab" || x' });
        const url = mockedGet.mock.calls[0][0] as string;
        // Sebelumnya string filter dipotong-potong dengan .replace() berantai
        // dan menghasilkan sampah seperti 'lablab"'.
        const params = new URLSearchParams(url.split("?")[1]);
        expect(params.get("search")).toBe('lab" || x');
    });
});

describe("getAssetReport", () => {
    it("menghitung kondisi dari field snake_case backend", async () => {
        mockedGet.mockResolvedValue({
            items: [
                {
                    id: "a1",
                    name: "Proyektor",
                    code: "P1",
                    category: "Elektronik",
                    quantity: 3,
                    price: 1000,
                    condition_good: 2,
                    condition_light_damaged: 1,
                    condition_heavy_damaged: 0,
                    condition_lost: 0,
                    expand: { room: { id: "r1", name: "Lab" } },
                },
            ],
            totalPages: 1,
            totalItems: 1,
        } as never);

        const report = await getAssetReport();
        expect(report[0].conditionGood).toBe(2);
        expect(report[0].conditionDamaged).toBe(1);
        expect(report[0].roomName).toBe("Lab");
        expect(report[0].totalValue).toBe(3000);
    });
});

describe("returnBorrowRequest", () => {
    it("memanggil endpoint pengembalian", async () => {
        mockedPost.mockResolvedValue({ success: true, status: "returned" } as never);
        const res = await returnBorrowRequest("br-1");
        expect(mockedPost).toHaveBeenCalledWith("/api/inventory/borrow-requests/br-1/return", {});
        expect(res.status).toBe("returned");
    });
});

describe("unwrapItems", () => {
    it("menerima bentuk respons items maupun data maupun array", () => {
        expect(unwrapItems({ items: [1] })).toEqual([1]);
        expect(unwrapItems({ data: [2] })).toEqual([2]);
        expect(unwrapItems([3])).toEqual([3]);
        expect(unwrapItems(null)).toEqual([]);
    });
});
