import { describe, it, expect } from "vitest";
import { formatClassName, extractClassId, normalizeClassNameForApi } from "./class-utils";

describe("class-utils", () => {
  describe("formatClassName", () => {
    it("should add 'Kelas' prefix to numeric class names", () => {
      expect(formatClassName("1")).toBe("Kelas 1");
      expect(formatClassName("2")).toBe("Kelas 2");
      expect(formatClassName("VI")).toBe("Kelas VI");
    });

    it("should not duplicate 'Kelas' prefix if already present", () => {
      expect(formatClassName("Kelas 1")).toBe("Kelas 1");
      expect(formatClassName("kelas 2")).toBe("kelas 2");
      expect(formatClassName("KELAS III")).toBe("KELAS III");
    });

    it("should handle undefined/null gracefully", () => {
      expect(formatClassName("")).toBe("Kelas ");
      expect(formatClassName("   ")).toBe("Kelas ");
    });

    it("should preserve existing formatting", () => {
      expect(formatClassName("III-A")).toBe("Kelas III-A");
      expect(formatClassName("7B")).toBe("Kelas 7B");
    });
  });

  describe("extractClassId", () => {
    it("should extract ID from formatted name", () => {
      expect(extractClassId("Kelas 1")).toBe("1");
      expect(extractClassId("Kelas III")).toBe("III");
      expect(extractClassId("KELAS VII")).toBe("VII");
    });

    it("should return original string if no prefix found", () => {
      expect(extractClassId("1")).toBe("1");
      expect(extractClassId("3C")).toBe("3C");
    });
  });

  describe("normalizeClassNameForApi", () => {
    it("should uppercase and remove spaces", () => {
      expect(normalizeClassNameForApi("Kelas 1")).toBe("KELAS1");
      expect(normalizeClassNameForApi("KELAS II")).toBe("KELASII");
      expect(normalizeClassNameForApi("kelas 7A")).toBe("KELAS7A");
    });

    it("should trim whitespace", () => {
      expect(normalizeClassNameForApi("  Kelas 3  ")).toBe("KELAS3");
    });
  });
});
