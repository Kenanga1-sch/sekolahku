// Tes payload ScanSettings eSCL.
//
// Regresi yang dijaga: region harus dalam satuan 1/300 inci TETAP (elemen
// pwg:ContentRegionUnits = escl:ThreeHundredthsOfInches), bukan piksel pada
// DPI yang diminta — pada 150 DPI versi lama mengirim setengah ukuran kertas
// sehingga lampu scanner Canon berhenti di tengah kaca.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestScan } from "./api";
import type { ScannerCaps } from "./escl-caps";

let postBodies: string[];

function installFetchMock(): ReturnType<typeof vi.fn> {
  postBodies = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "POST" && url.includes("/escl/ScanJobs")) {
      postBodies.push(String(init?.body ?? ""));
      return new Response("", {
        status: 201,
        headers: { Location: "/api/docstation/escl/ScanJobs/job-1" },
      });
    }
    if (url.includes("/NextDocument")) {
      return new Response(new Blob(["data"], { type: "image/jpeg" }), { status: 200 });
    }
    if (method === "DELETE") {
      return new Response("", { status: 200 });
    }
    throw new Error(`fetch tak terduga: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastPostBody(): string {
  expect(postBodies.length).toBeGreaterThan(0);
  return postBodies[postBodies.length - 1];
}

/** Biarkan DELETE "fire-and-forget" di finally selesai di bawah mock. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("requestScan — region eSCL 1/300 inci", () => {
  beforeEach(() => {
    installFetchMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("A4 @150 DPI: region tetap 2480×3508 (bukan 1240×1754), DPI tetap 150", async () => {
    const outcome = await requestScan({
      resolution: 150,
      preset: "color",
      paperSize: "a4",
      source: "flatbed",
      printerIp: "192.168.10.131",
    });
    await settle();

    const body = lastPostBody();
    expect(body).toContain("<pwg:Height>3508</pwg:Height>");
    expect(body).toContain("<pwg:Width>2480</pwg:Width>");
    expect(body).toContain(
      "<pwg:ContentRegionUnits>escl:ThreeHundredthsOfInches</pwg:ContentRegionUnits>",
    );
    expect(body).toContain("<scan:XResolution>150</scan:XResolution>");
    expect(body).toContain("<scan:YResolution>150</scan:YResolution>");
    expect(body).toContain("<pwg:InputSource xmlns:pwg=\"http://www.pwg.org/schemas/2010/12/sm\">Platen</pwg:InputSource>");
    expect(outcome.blobs).toHaveLength(1);
    expect(outcome.scanned).toBe(1);
  });

  it("A5 @600 DPI: region 1748×2480 (independen DPI)", async () => {
    await requestScan({
      resolution: 600,
      preset: "gray",
      paperSize: "a5",
      source: "flatbed",
      printerIp: "192.168.10.131",
    });
    await settle();

    const body = lastPostBody();
    expect(body).toContain("<pwg:Height>2480</pwg:Height>");
    expect(body).toContain("<pwg:Width>1748</pwg:Width>");
    expect(body).toContain("<scan:XResolution>600</scan:XResolution>");
    expect(body).toContain("<scan:ColorMode>Grayscale8</scan:ColorMode>");
  });

  it("ukuran custom 100×150 mm: region 1181×1772 pada DPI apa pun", async () => {
    await requestScan({
      resolution: 200,
      preset: "text",
      paperSize: "custom",
      customWidth: 100,
      customHeight: 150,
      source: "flatbed",
      printerIp: "192.168.10.131",
    });
    await settle();

    const body = lastPostBody();
    expect(body).toContain("<pwg:Height>1772</pwg:Height>");
    expect(body).toContain("<pwg:Width>1181</pwg:Width>");
    expect(body).toContain("<scan:XResolution>200</scan:XResolution>");
  });

  it("region di-clamp ke batas kaca bila caps diberikan (F4 > tinggi A4)", async () => {
    const caps: ScannerCaps = {
      makeModel: "Canon G7000 series",
      platen: {
        minWidth: 1,
        maxWidth: 2550,
        minHeight: 1,
        maxHeight: 3508,
        resolutions: [150, 200, 300, 600],
      },
      adf: null,
    };

    await requestScan({
      resolution: 300,
      preset: "color",
      paperSize: "f4", // 215×330 mm → 2539×3898 unit
      source: "flatbed",
      printerIp: "192.168.10.131",
      caps,
    });
    await settle();

    const body = lastPostBody();
    expect(body).toContain("<pwg:Height>3508</pwg:Height>"); // di-clamp dari 3898
    expect(body).toContain("<pwg:Width>2539</pwg:Width>"); // muat, tak berubah
  });
});
