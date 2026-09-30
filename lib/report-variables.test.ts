import { describe, it, expect } from "vitest";
import {
  REPORT_VARIABLE_MODULES,
  getVariableModule,
  findModuleByLabel,
  tokensForModule,
  datasetNamesForModule,
} from "./report-variables";

describe("report-variables catalog", () => {
  it("setiap modul punya module & label unik dan grup berisi field", () => {
    const modules = new Set<string>();
    for (const m of REPORT_VARIABLE_MODULES) {
      expect(m.module).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(modules.has(m.module)).toBe(false);
      modules.add(m.module);
      expect(m.groups.length).toBeGreaterThan(0);
      for (const g of m.groups) expect(g.fields.length).toBeGreaterThan(0);
    }
  });

  it("getVariableModule jatuh ke umum bila tidak ditemukan", () => {
    expect(getVariableModule("tidak-ada").module).toBe("umum");
    expect(getVariableModule(undefined).module).toBe("umum");
    expect(getVariableModule("inventaris").module).toBe("inventaris");
  });

  it("findModuleByLabel mencocokkan label kategori (case-insensitive)", () => {
    expect(findModuleByLabel("Inventaris")?.module).toBe("inventaris");
    expect(findModuleByLabel("inventaris")?.module).toBe("inventaris");
    expect(findModuleByLabel("tidak ada")).toBeUndefined();
  });

  it("tokensForModule menghasilkan token row {..} dan rekap {{..}}", () => {
    const tokens = tokensForModule("siswa");
    expect(tokens).toContain("{siswa.nama}");
    expect(tokens).toContain("{{siswa.per_kelas}}");
  });

  it("datasetNamesForModule mengumpulkan nama dataset unik", () => {
    const names = datasetNamesForModule("inventaris");
    expect(names).toContain("data");
    expect(names).toContain("aset");
  });
});
