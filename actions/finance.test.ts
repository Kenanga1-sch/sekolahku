import { describe, it, expect, vi, beforeEach } from "vitest";
import * as finance from "./finance";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

// Mock the API client
vi.mock("@/lib/api-client", () => ({
  goGet: vi.fn(),
  goPost: vi.fn(),
  goPut: vi.fn(),
  goDelete: vi.fn(),
  CacheTTL: { SHORT: 60, MEDIUM: 600, LONG: 3600 },
}));

// Mock handleAction
vi.mock("@/lib/action-utils", () => ({
  handleAction: vi.fn((promise) => promise),
}));

describe("Finance Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Accounts", () => {
    it("should fetch accounts", async () => {
      vi.mocked(goGet).mockResolvedValueOnce([{ id: "1", name: "Cash" }]);
      const result = await finance.getAccounts();
      expect(result).toEqual([{ id: "1", name: "Cash" }]);
      expect(goGet).toHaveBeenCalledWith("/api/finance/accounts", expect.any(Object));
    });

    it("should create account", async () => {
      const data = { name: "Bank" };
      vi.mocked(goPost).mockResolvedValueOnce({ id: "2", ...data });
      const result = await finance.createAccount(data);
      expect(result).toEqual({ id: "2", ...data });
      expect(goPost).toHaveBeenCalledWith("/api/finance/accounts", data);
    });
  });

  describe("Transactions", () => {
    it("should fetch transactions with params", async () => {
      vi.mocked(goGet).mockResolvedValueOnce([]);
      await finance.getTransactions({ limit: 10 });
      expect(goGet).toHaveBeenCalledWith("/api/finance/transactions?limit=10", expect.any(Object));
    });

    it("should create transaction", async () => {
      const data: any = { type: "INCOME", amount: 1000, accountIdSource: "1" };
      vi.mocked(goPost).mockResolvedValueOnce({ id: "tx-1", ...data });
      const result = await finance.createTransaction(data);
      expect(result).toEqual({ id: "tx-1", ...data });
      expect(goPost).toHaveBeenCalledWith("/api/finance/transactions", data);
    });
  });
});
