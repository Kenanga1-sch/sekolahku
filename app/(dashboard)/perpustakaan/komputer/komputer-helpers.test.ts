import { describe, it, expect } from "vitest";
import { formatDateTime } from "./komputer-helpers";

describe("formatDateTime", () => {
  it("mengembalikan '-' untuk undefined", () => {
    expect(formatDateTime(undefined)).toBe("-");
  });

  it("mengembalikan '-' untuk string kosong", () => {
    expect(formatDateTime("")).toBe("-");
  });

  it("mengembalikan '-' untuk tanggal tidak valid", () => {
    expect(formatDateTime("bukan-tanggal")).toBe("-");
  });

  it("memformat tanggal valid tanpa melempar", () => {
    const out = formatDateTime("2026-10-13T08:30:00Z");
    expect(out).not.toBe("-");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("memformat tanggal dengan gaya id-ID", () => {
    const out = formatDateTime("2026-01-05T00:00:00Z");
    expect(out).toMatch(/2026/);
  });
});
