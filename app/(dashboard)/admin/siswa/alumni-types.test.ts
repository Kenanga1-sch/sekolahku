import { describe, it, expect } from "vitest";
import { statusInfo } from "./alumni-types";

describe("statusInfo", () => {
  it("memuat 4 status siswa", () => {
    expect(Object.keys(statusInfo).sort()).toEqual(
      ["active", "dropped", "graduated", "transferred"],
    );
  });

  it("memberi label Indonesia untuk tiap status", () => {
    expect(statusInfo.active.label).toBe("Aktif");
    expect(statusInfo.graduated.label).toBe("Alumni");
    expect(statusInfo.transferred.label).toBe("Pindahan");
    expect(statusInfo.dropped.label).toBe("Keluar");
  });

  it("menyertakan kelas warna & border", () => {
    for (const key of Object.keys(statusInfo)) {
      expect(statusInfo[key].color).toBeTruthy();
      expect(statusInfo[key].border).toBeTruthy();
    }
  });
});
