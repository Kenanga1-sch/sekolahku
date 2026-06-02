import { describe, it, expect, vi, beforeEach } from "vitest";
import * as savings from "./savings-admin";
import { goGet, goPost, goPut } from "@/lib/api-client";

// Mock the API client
vi.mock("@/lib/api-client", () => ({
  goGet: vi.fn(),
  goPost: vi.fn(),
  goPut: vi.fn(),
  CacheTTL: { SHORT: 60, MEDIUM: 600, LONG: 3600 },
}));

// Mock handleAction
vi.mock("@/lib/action-utils", () => ({
  handleAction: vi.fn((promise) => promise),
}));

describe("Savings Admin Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Treasurer", () => {
    it("should fetch savings treasurer", async () => {
      const mockUser = { id: "u-1", name: "Admin" };
      vi.mocked(goGet).mockResolvedValueOnce(mockUser);
      const result = await savings.getSavingsTreasurer();
      expect(result).toEqual(mockUser);
      expect(goGet).toHaveBeenCalledWith("/api/savings/treasurer", expect.any(Object));
    });

    it("should assign savings treasurer", async () => {
      vi.mocked(goPost).mockResolvedValueOnce({ success: true });
      await savings.assignSavingsTreasurer("u-2");
      expect(goPost).toHaveBeenCalledWith("/api/savings/treasurer", { userId: "u-2" });
    });
  });

  describe("Vault", () => {
    it("should fetch brankas summary", async () => {
      vi.mocked(goGet).mockResolvedValueOnce({ total: 1000000 });
      const result = await savings.getBrankasSummary();
      expect(result).toEqual({ total: 1000000 });
      expect(goGet).toHaveBeenCalledWith("/api/savings/brankas/summary", expect.any(Object));
    });

    it("should transfer funds", async () => {
      vi.mocked(goPost).mockResolvedValueOnce({ success: true });
      await savings.transferVaultFunds("setor_ke_bank", 500000, "u-1");
      expect(goPost).toHaveBeenCalledWith("/api/savings/brankas/transfer", {
        tipe: "setor_ke_bank",
        nominal: 500000,
        userId: "u-1"
      });
    });
  });
});
