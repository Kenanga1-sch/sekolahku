import { describe, it, expect } from "vitest";
import { cn, formatDate, formatCurrency, isValidNIK, isValidPhone, calculateAge } from "@/lib/utils";

describe("cn (classNames)", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", true && "active", false && "inactive")).toBe("base active");
  });
});

describe("formatDate", () => {
  it("should format date in Indonesian locale", () => {
    const date = new Date("2024-01-15");
    const formatted = formatDate(date);
    expect(formatted).toContain("2024");
    expect(formatted).toContain("Januari");
  });
});

describe("formatCurrency", () => {
  it("should format number as Indonesian Rupiah", () => {
    const formatted = formatCurrency(1000000);
    expect(formatted).toContain("Rp");
    expect(formatted).toContain("1.000.000");
  });
});

describe("isValidNIK", () => {
  it("should validate 16-digit NIK", () => {
    expect(isValidNIK("1234567890123456")).toBe(true);
    expect(isValidNIK("123456789012345")).toBe(false);
    expect(isValidNIK("12345678901234567")).toBe(false);
    expect(isValidNIK("123456789012345a")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("should validate Indonesian phone numbers", () => {
    expect(isValidPhone("081234567890")).toBe(true);
    expect(isValidPhone("08123456789")).toBe(true);
    expect(isValidPhone("0812345678901234")).toBe(false);
  });
});

describe("calculateAge", () => {
  it("should calculate age from birth date", () => {
    const today = new Date();
    const birthYear = today.getFullYear() - 10;
    const birthDate = new Date(birthYear, 0, 1);
    const age = calculateAge(birthDate);
    expect(age).toBeGreaterThanOrEqual(9);
    expect(age).toBeLessThanOrEqual(11);
  });
});
