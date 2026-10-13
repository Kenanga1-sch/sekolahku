// Tes jaring pengaman helper spreadsheet transkrip alumni.
import { describe, it, expect } from "vitest";
import {
  scoreToLetter,
  getAcademicYearOptions,
  DEFAULT_COLUMNS,
} from "./alumni-spreadsheet-helpers";

describe("scoreToLetter", () => {
  it("memetakan rentang nilai ke huruf", () => {
    expect(scoreToLetter(90)).toBe("A");
    expect(scoreToLetter(85)).toBe("A");
    expect(scoreToLetter(80)).toBe("B");
    expect(scoreToLetter(75)).toBe("B");
    expect(scoreToLetter(60)).toBe("C");
    expect(scoreToLetter(55)).toBe("D");
    expect(scoreToLetter(49)).toBe("E");
    expect(scoreToLetter(0)).toBe("E");
  });
});

describe("getAcademicYearOptions", () => {
  it("mengembalikan daftar tahun ajaran menurun", () => {
    const opts = getAcademicYearOptions("2020");
    expect(opts.length).toBeGreaterThan(0);
    // menurun (reverse)
    expect(opts[0] > opts[opts.length - 1]).toBe(true);
    // format "YYYY/YYYY+1"
    expect(opts.every((o) => /^\d{4}\/\d{4}$/.test(o))).toBe(true);
  });

  it("memakai basis default bila enrolledYear kosong", () => {
    const opts = getAcademicYearOptions();
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => /^\d{4}\/\d{4}$/.test(o))).toBe(true);
  });
});

describe("DEFAULT_COLUMNS", () => {
  it("memuat kolom standar transkrip", () => {
    const keys = DEFAULT_COLUMNS.map((c) => c.key);
    expect(keys).toContain("subjectName");
    expect(keys).toContain("score");
    expect(keys).toContain("scoreLetter");
  });
});
