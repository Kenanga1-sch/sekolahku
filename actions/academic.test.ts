import { describe, it, expect, vi, beforeEach } from "vitest";
import { getActiveAcademicYear } from "./academic";
import { goGet } from "@/lib/api-client";

// Mock the API client
vi.mock("@/lib/api-client", () => ({
  goGet: vi.fn(),
  CacheTTL: { LONG: 3600 },
}));

// Mock handleAction
vi.mock("@/lib/action-utils", () => ({
  handleAction: vi.fn((promise) => promise),
}));

describe("Academic Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch active academic year", async () => {
    const mockData = { id: "2023-2024", name: "2023/2024" };
    vi.mocked(goGet).mockResolvedValueOnce(mockData);

    const result = await getActiveAcademicYear();

    expect(result).toEqual(mockData);
    expect(goGet).toHaveBeenCalledWith("/api/academic/active-year", expect.any(Object));
  });
});
