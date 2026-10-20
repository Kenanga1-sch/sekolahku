import { describe, expect, it } from "vitest";
import { getBreadcrumbItems, getPageTitle } from "./page-titles";

describe("getPageTitle", () => {
  it("prefers the longest matching prefix", () => {
    expect(getPageTitle("/admin/siswa/detail")).toBe("Detail Siswa");
    expect(getPageTitle("/admin/siswa")).toBe("Manajemen Siswa");
    expect(getPageTitle("/admin")).toBe("Administrasi");
  });

  it("falls back to Dashboard for unknown routes", () => {
    expect(getPageTitle("/tidak-ada")).toBe("Dashboard");
  });
});

describe("getBreadcrumbItems", () => {
  it("returns no crumbs on the dashboard root", () => {
    expect(getBreadcrumbItems("/overview")).toEqual([]);
    expect(getBreadcrumbItems("/")).toEqual([]);
  });

  it("builds a hierarchy from known route labels", () => {
    expect(getBreadcrumbItems("/admin/siswa")).toEqual([
      { label: "Beranda", href: "/overview" },
      { label: "Administrasi", href: "/admin", current: false },
      { label: "Manajemen Siswa", href: "/admin/siswa", current: true },
    ]);
  });

  it("humanizes unknown final segments", () => {
    expect(getBreadcrumbItems("/inventaris/ruangan/detail")).toEqual([
      { label: "Beranda", href: "/overview" },
      { label: "Inventaris", href: "/inventaris", current: false },
      { label: "Ruangan", href: "/inventaris/ruangan", current: false },
      { label: "Detail", href: "/inventaris/ruangan/detail", current: true },
    ]);
  });

  it("ignores query strings and trailing slashes", () => {
    expect(getBreadcrumbItems("/profile/?tab=akun")).toEqual([
      { label: "Beranda", href: "/overview" },
      { label: "Profil", href: "/profile", current: true },
    ]);
  });
});
