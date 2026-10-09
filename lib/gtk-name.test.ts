import { describe, expect, it } from "vitest";
import { formatNamaGtk } from "./gtk-name";

describe("formatNamaGtk — \"Nama, Gelar\"", () => {
  it("nama + gelar → digabung", () => {
    expect(formatNamaGtk("Badrudin", "S.Pd.")).toBe("Badrudin, S.Pd.");
  });
  it("tanpa gelar → nama saja", () => {
    expect(formatNamaGtk("Umar Said", null)).toBe("Umar Said");
    expect(formatNamaGtk("Umar Said", "")).toBe("Umar Said");
  });
  it("nama kosong → hanya gelar (bukan \", S.Pd.\")", () => {
    expect(formatNamaGtk("", "S.Pd.")).toBe("S.Pd.");
    expect(formatNamaGtk(null, "S.Pd.")).toBe("S.Pd.");
  });
  it("keduanya kosong → string kosong", () => {
    expect(formatNamaGtk(null, null)).toBe("");
    expect(formatNamaGtk(undefined, undefined)).toBe("");
  });
  it("whitespace ditrim", () => {
    expect(formatNamaGtk("  Rusmaningsih ", " S.Pd.SD. ")).toBe("Rusmaningsih, S.Pd.SD.");
  });
  it("users.name sudah ber-gelar + degree kosong → tidak dobel", () => {
    expect(formatNamaGtk("Badrudin, S.Pd.", null)).toBe("Badrudin, S.Pd.");
  });
});
