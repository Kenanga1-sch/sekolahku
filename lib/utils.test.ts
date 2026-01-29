import { describe, it, expect, vi } from "vitest";
import {
  cn,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatDistance,
  getStatusColor,
  getStatusLabel,
  getGenderLabel,
  slugify,
  truncate,
  isValidNIK,
  isValidPhone,
  isValidEmail,
  calculateAge,
  delay,
  generateId,
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
    expect(formatted).toContain("2024");
  }, 10000);

  it("should accept string date", () => {
    const formatted = formatDate("2024-06-20");
    expect(formatted).toContain("2024");
  });
});

describe("formatDateTime", () => {
  it("should include time in formatted output", () => {
    const date = new Date("2024-01-15T14:30:00");
    const formatted = formatDateTime(date);
    expect(formatted).toContain("2024");
  });
});

describe("formatCurrency", () => {
  it("should format number as Indonesian Rupiah", () => {
    const formatted = formatCurrency(1000000);
    expect(formatted).toContain("Rp");
    expect(formatted).toContain("1.000.000");
  });

  it("should handle zero", () => {
    const formatted = formatCurrency(0);
    expect(formatted).toContain("Rp");
    expect(formatted).toContain("0");
  });
});

describe("formatDistance", () => {
  it("should format distance in meters when less than 1km", () => {
    expect(formatDistance(0.5)).toBe("500 meter");
    expect(formatDistance(0.123)).toBe("123 meter");
  });

  it("should format distance in kilometers when >= 1km", () => {
    expect(formatDistance(1.5)).toBe("1.50 km");
    expect(formatDistance(10)).toBe("10.00 km");
  });
});

describe("getStatusColor", () => {
  it("should return correct color classes for each status", () => {
    expect(getStatusColor("pending")).toContain("yellow");
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
    expect(getStatusLabel("pending")).toBe("Menunggu Verifikasi");
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

describe("slugify", () => {
  it("should convert text to slug format", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("Pengumuman SPMB 2024")).toBe("pengumuman-spmb-2024");
  });

  it("should remove special characters", () => {
    expect(slugify("Hello! @World#")).toBe("hello-world");
  });

  it("should handle multiple spaces", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });
});

describe("truncate", () => {
  it("should truncate long text with ellipsis", () => {
    expect(truncate("Hello World", 5)).toBe("Hello...");
  });

  it("should not truncate short text", () => {
    expect(truncate("Hello", 10)).toBe("Hello");
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
    expect(isValidPhone("+6281234567890")).toBe(true);
    expect(isValidPhone("6281234567890")).toBe(true);
  });

  it("should reject invalid phone numbers", () => {
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("0812345678901234")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("should validate correct email formats", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("user.name@domain.co.id")).toBe(true);
  });

  it("should reject invalid emails", () => {
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("@domain.com")).toBe(false);
    expect(isValidEmail("test@")).toBe(false);
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

  it("should accept string date", () => {
    const birthYear = new Date().getFullYear() - 25;
    const age = calculateAge(`${birthYear}-06-15`);
    expect(age).toBeGreaterThanOrEqual(24);
    expect(age).toBeLessThanOrEqual(26);
  });
});

describe("delay", () => {
  it("should delay execution", async () => {
    const start = Date.now();
    await delay(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
  });
});

describe("generateId", () => {
  it("should generate random string of specified length", () => {
    expect(generateId(8)).toHaveLength(8);
    expect(generateId(16)).toHaveLength(16);
  });

  it("should use default length of 8", () => {
    expect(generateId()).toHaveLength(8);
  });

  it("should generate unique IDs", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it("should only contain alphanumeric characters", () => {
    const id = generateId(100);
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });
});
