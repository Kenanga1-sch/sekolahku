import { describe, it, expect, vi, beforeEach } from "vitest";
import { goGet } from "@/lib/api-client";
import { fetchTemplateByModule } from "./report-template-runner";

vi.mock("@/lib/api-client", () => ({
  goGet: vi.fn(),
}));

vi.mock("@/lib/report-pdf", () => ({
  generateReportPdf: vi.fn(),
  schoolGlobalVars: () => ({}),
}));

vi.mock("@/lib/school-logo", () => ({ getSchoolLogo: () => "" }));

const layout = JSON.stringify({
  schemaVersion: 3,
  reportCode: "RPT_X",
  reportName: "Format X",
  paperSize: "A4",
  orientation: "portrait",
  showFooter: true,
  density: "normal",
  margin: { top: 36, bottom: 45, left: 40, right: 40 },
  typography: { baseFontSize: 11, tableFontSize: 11, lineHeight: 1.4, rowPadding: 4, blockGap: 8 },
  headerRepeat: true,
  sheets: [{ id: "s1", name: "L1", cols: 2, colWidths: [96, 96], cells: {} }],
});

describe("report-template-runner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetchTemplateByModule memilih template default modul", async () => {
    vi.mocked(goGet).mockResolvedValue({
      success: true,
      data: [
        { code: "RPT_A", name: "A", category: "Inventaris", module: "inventaris", layoutJson: layout, isDefault: false },
        { code: "RPT_B", name: "B", category: "Inventaris", module: "inventaris", layoutJson: layout, isDefault: true },
      ],
    } as any);
    const wb = await fetchTemplateByModule("inventaris");
    expect(wb?.reportCode).toBe("RPT_B");
    expect(wb?.module).toBe("inventaris");
  });

  it("fetchTemplateByModule jatuh ke template pertama bila tak ada default", async () => {
    vi.mocked(goGet).mockResolvedValue({
      success: true,
      data: [{ code: "RPT_A", name: "A", category: "Tabungan", module: "tabungan", layoutJson: layout }],
    } as any);
    const wb = await fetchTemplateByModule("tabungan");
    expect(wb?.reportCode).toBe("RPT_A");
  });

  it("fetchTemplateByModule mengembalikan null bila modul kosong", async () => {
    vi.mocked(goGet).mockResolvedValue({ success: true, data: [] } as any);
    expect(await fetchTemplateByModule("kosong")).toBeNull();
  });
});
