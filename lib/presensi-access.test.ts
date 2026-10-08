import { describe, it, expect } from "vitest";
import { canManageHolidays, HARI_LIBUR_ROLES } from "./presensi-access";

describe("canManageHolidays", () => {
  it("mengizinkan admin dan superadmin", () => {
    expect(canManageHolidays("admin")).toBe(true);
    expect(canManageHolidays("superadmin")).toBe(true);
  });

  it("menolak role lain", () => {
    expect(canManageHolidays("guru")).toBe(false);
    expect(canManageHolidays("staff")).toBe(false);
    expect(canManageHolidays("siswa")).toBe(false);
  });

  it("menolak nilai kosong", () => {
    expect(canManageHolidays(undefined)).toBe(false);
    expect(canManageHolidays(null)).toBe(false);
    expect(canManageHolidays("")).toBe(false);
  });

  it("HARI_LIBUR_ROLES berisi persis admin & superadmin", () => {
    expect(HARI_LIBUR_ROLES).toEqual(["admin", "superadmin"]);
  });
});
