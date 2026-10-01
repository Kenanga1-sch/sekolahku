// Tes modul ScannerCapabilities: parsing fixture asli dari printer di jaringan
// (Canon G7000 & Epson L6270), satuan 1/300 inci, filter DPI, dan clamp.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  capsMaxMMLabel,
  clearScannerCapsCache,
  clampRegionToCaps,
  esclRegionUnits,
  fetchScannerCaps,
  parseScannerCaps,
  regionExceedsCaps,
  supportedResolutions,
} from "./escl-caps";

function fixture(name: string): string {
  return readFileSync(join(process.cwd(), "lib/docstation/__fixtures__", name), "utf8");
}

const canonXml = fixture("canon-scanner-capabilities.xml");
const epsonXml = fixture("epson-scanner-capabilities.xml");

describe("parseScannerCaps", () => {
  it("Canon G7000: platen 2550×3508 (1/300 in), ADF 2550×4200", () => {
    const caps = parseScannerCaps(canonXml);
    expect(caps).not.toBeNull();
    expect(caps!.makeModel).toBe("Canon G7000 series");
    expect(caps!.platen).toEqual({
      minWidth: 1,
      maxWidth: 2550,
      minHeight: 1,
      maxHeight: 3508,
      resolutions: [75, 100, 150, 200, 300, 600, 1200],
    });
    expect(caps!.adf).not.toBeNull();
    expect(caps!.adf!.maxHeight).toBe(4200);
    expect(caps!.adf!.resolutions[caps!.adf!.resolutions.length - 1]).toBe(600);
  });

  it("Epson L6270: platen min 96, max 2550×3510, tanpa 150 DPI", () => {
    const caps = parseScannerCaps(epsonXml);
    expect(caps).not.toBeNull();
    expect(caps!.makeModel).toBe("EPSON L6270 Series");
    expect(caps!.platen!.minWidth).toBe(96);
    expect(caps!.platen!.maxHeight).toBe(3510);
    expect(caps!.platen!.resolutions).toEqual([100, 200, 300, 600, 1200]);
  });

  it("XML rusak → null", () => {
    expect(parseScannerCaps("bukan-xml-<")).toBeNull();
    expect(parseScannerCaps("")).toBeNull();
  });
});

describe("esclRegionUnits — satuan 1/300 inci", () => {
  it("A4 → 2480×3508 (cocok dengan MaxHeight caps printer)", () => {
    expect(esclRegionUnits("a4")).toEqual({ width: 2480, height: 3508 });
  });

  it("A5 → 1748×2480", () => {
    expect(esclRegionUnits("a5")).toEqual({ width: 1748, height: 2480 });
  });

  it("custom 100×150 mm → 1181×1772", () => {
    expect(esclRegionUnits("custom", 100, 150)).toEqual({ width: 1181, height: 1772 });
  });
});

describe("clamp & validasi caps", () => {
  const canon = parseScannerCaps(canonXml)!;

  it("clamp region F4 (3898) ke tinggi kaca 3508", () => {
    const r = clampRegionToCaps({ width: 2539, height: 3898 }, canon, "flatbed");
    expect(r).toEqual({ width: 2539, height: 3508, clamped: true });
  });

  it("A4 pas di kaca → tidak di-clamp", () => {
    const r = clampRegionToCaps({ width: 2480, height: 3508 }, canon, "flatbed");
    expect(r.clamped).toBe(false);
  });

  it("tanpa caps → tak berubah", () => {
    const r = clampRegionToCaps({ width: 9999, height: 9999 }, null, "flatbed");
    expect(r).toEqual({ width: 9999, height: 9999, clamped: false });
  });

  it("regionExceedsCaps: A4 tidak, F4 ya, tanpa caps tidak", () => {
    expect(regionExceedsCaps(esclRegionUnits("a4"), canon, "flatbed")).toBe(false);
    expect(regionExceedsCaps(esclRegionUnits("f4"), canon, "flatbed")).toBe(true);
    expect(regionExceedsCaps(esclRegionUnits("a3"), null, "flatbed")).toBe(false);
  });

  it("capsMaxMMLabel menampilkan batas kaca dalam mm", () => {
    expect(capsMaxMMLabel(canon, "flatbed")).toBe("216 × 297 mm");
    expect(capsMaxMMLabel(canon, "adf")).toBe("216 × 356 mm");
    expect(capsMaxMMLabel(null, "flatbed")).toBeNull();
  });
});

describe("supportedResolutions — filter DPI per printer", () => {
  const canon = parseScannerCaps(canonXml)!;
  const epson = parseScannerCaps(epsonXml)!;
  const options = [150, 200, 300, 600];

  it("Canon mendukung semua opsi", () => {
    expect(supportedResolutions(canon, "flatbed", options)).toEqual(options);
  });

  it("Epson tidak mendukung 150 → tersaring", () => {
    expect(supportedResolutions(epson, "flatbed", options)).toEqual([200, 300, 600]);
  });

  it("tanpa caps → opsi asli", () => {
    expect(supportedResolutions(null, "flatbed", options)).toEqual(options);
  });
});

describe("fetchScannerCaps — cache & error", () => {
  beforeEach(() => {
    clearScannerCapsCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearScannerCapsCache();
  });

  it("GET dipanggil sekali untuk IP yang sama (cache)", async () => {
    const fetchMock = vi.fn(
      async () => new Response(canonXml, { status: 200, headers: { "Content-Type": "application/xml" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const a = await fetchScannerCaps("192.168.10.131");
    const b = await fetchScannerCaps("192.168.10.131");
    expect(a?.makeModel).toBe("Canon G7000 series");
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain(
      "/api/docstation/escl/ScannerCapabilities",
    );
  });

  it("respons non-2xx → null dan tidak di-cache", async () => {
    const fetchMock = vi.fn(async () => new Response("error", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchScannerCaps("192.168.10.99")).toBeNull();
    expect(await fetchScannerCaps("192.168.10.99")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
