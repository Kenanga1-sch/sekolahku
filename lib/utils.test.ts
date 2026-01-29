import { describe, it, expect } from "vitest";
import {
  cn,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatDistance,
  getStatusColor,
  getStatusLabel,
  getGenderLabel,
} from "@/lib/utils";

describe("cn (classNames)", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", true && "active", false && "inactive")).toBe("base active");
  });

  it("should merge Tailwind classes correctly", () => {
    expect(cn("p-4", "p-2")).toBe("p-2"); // Tailwind merge behavior
  });
});

describe("formatDate", () => {
  it("should format date in Indonesian locale", () => {
    const date = new Date("2024-01-15");
    const formatted = formatDate(date);
    expect(formatted).toContain("Januari");
    expect(formatted).toContain("2024");
  }, 10000);

  it("should accept string date", () => {
    const formatted = formatDate("2024-06-20");
    expect(formatted).toContain("Juni");
    expect(formatted).toContain("2024");
  });
});

describe("formatDateTime", () => {
  it("should include time in formatted output", () => {
    const date = new Date("2024-01-15T14:30:00");
    const formatted = formatDateTime(date);
    expect(formatted).toContain("2024");
    expect(formatted).toContain("14:30");
  });
});

describe("formatCurrency", () => {
  it("should format number as Indonesian Rupiah", () => {
    const formatted = formatCurrency(1000000);
    expect(formatted).toMatch(/Rp.*1\.000\.000/);
  });

  it("should handle zero", () => {
    const formatted = formatCurrency(0);
    expect(formatted).toMatch(/Rp.*0/);
  });
});

describe("formatDistance", () => {
  it("should format distance in kilometers", () => {
    expect(formatDistance(1.5)).toBe("1.50 km");
    expect(formatDistance(10)).toBe("10.00 km");
  });
});

describe("getStatusColor", () => {
  it("should return correct color classes for each status", () => {
    expect(getStatusColor("submitted")).toContain("amber");
    expect(getStatusColor("accepted")).toContain("green");
    expect(getStatusColor("rejected")).toContain("red");
    expect(getStatusColor("verified")).toContain("blue");
  });

  it("should return default color for unknown status", () => {
    expect(getStatusColor("unknown")).toContain("gray");
  });
});

describe("getStatusLabel", () => {
  it("should return Indonesian labels", () => {
    expect(getStatusLabel("submitted")).toBe("Menunggu Verifikasi");
    expect(getStatusLabel("accepted")).toBe("Diterima");
    expect(getStatusLabel("rejected")).toBe("Ditolak");
    expect(getStatusLabel("verified")).toBe("Terverifikasi");
  });

  it("should return original status if unknown", () => {
    expect(getStatusLabel("custom")).toBe("custom");
  });
});

describe("getGenderLabel", () => {
  it("should return Indonesian gender labels", () => {
    expect(getGenderLabel("L")).toBe("Laki-laki");
    expect(getGenderLabel("P")).toBe("Perempuan");
  });
});
