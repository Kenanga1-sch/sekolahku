import { describe, it, expect } from "vitest";
import { resolveSettingsPatch } from "./resolve-settings-patch";

describe("resolveSettingsPatch", () => {
  it("patch objek lolos apa adanya tanpa id", () => {
    const out = resolveSettingsPatch({ school_name: "SDN Baru" }, null);
    expect(out).toEqual({ school_name: "SDN Baru" });
  });

  it("id dari objek patch ikut dibuang agar tidak menimpa tujuan", () => {
    const out = resolveSettingsPatch({ id: "default", school_name: "X" }, null);
    expect(out).toEqual({ school_name: "X" });
    expect("id" in out).toBe(false);
  });

  it("patch function (pola setState) di-resolve dengan prev", () => {
    const out = resolveSettingsPatch(
      (prev) => ({ ...prev, school_name: "Sekolah Baru" }),
      { id: "default", school_name: "Lama", landing_tagline: "Tag" }
    );
    expect(out.school_name).toBe("Sekolah Baru");
    expect(out.landing_tagline).toBe("Tag");
    expect("id" in out).toBe(false);
  });

  it("function dengan prev null tidak meledak", () => {
    const out = resolveSettingsPatch((prev) => ({ ...prev, school_name: "Baru" }), null);
    expect(out).toEqual({ school_name: "Baru" });
  });

  it("payload tidak pernah berisi id (regresi bug hanya-id)", () => {
    const out = resolveSettingsPatch(
      (prev) => ({ ...prev, school_name: "X" }),
      { id: "default" }
    );
    expect(JSON.stringify(out)).not.toContain('"id"');
    expect(Object.keys(out)).toContain("school_name");
  });

  it("input tidak valid menghasilkan objek kosong", () => {
    expect(resolveSettingsPatch(null as never, null)).toEqual({});
    expect(resolveSettingsPatch("junk" as never, null)).toEqual({});
  });
});
