import { describe, expect, it } from "vitest";
import { evaluateScan, SAME_CODE_BLOCK_MS, SCAN_COOLDOWN_MS } from "./scan-gate";

const base = { now: 1_000_000, inFlight: false, code: "asset-1", lastCode: null as string | null, lastCodeAt: 0 };

describe("evaluateScan", () => {
  it("menerima scan pertama kali", () => {
    expect(evaluateScan({ ...base })).toBeNull();
  });

  it("menolak saat transaksi masih berjalan (in-flight)", () => {
    expect(evaluateScan({ ...base, inFlight: true })).toBe("in-flight");
  });

  it("menolak kode identik dalam jendela SAME_CODE_BLOCK", () => {
    const res = evaluateScan({ ...base, code: "asset-1", lastCode: "asset-1", lastCodeAt: base.now - SAME_CODE_BLOCK_MS + 1 });
    expect(res).toBe("same-code");
  });

  it("menerima kode identik setelah jendela SAME_CODE_BLOCK lewat", () => {
    const res = evaluateScan({ ...base, code: "asset-1", lastCode: "asset-1", lastCodeAt: base.now - SAME_CODE_BLOCK_MS });
    expect(res).toBeNull();
  });

  it("menolak scan beda kode yang datang dalam < 300 ms", () => {
    const res = evaluateScan({ ...base, code: "asset-2", lastCode: "asset-1", lastCodeAt: base.now - SCAN_COOLDOWN_MS + 1 });
    expect(res).toBe("too-fast");
  });

  it("menerima scan beda kode setelah cooldown berlalu", () => {
    const res = evaluateScan({ ...base, code: "asset-2", lastCode: "asset-1", lastCodeAt: base.now - SCAN_COOLDOWN_MS });
    expect(res).toBeNull();
  });

  it("menerima beda kode walau < 300 ms dari scan lama bila jeda sudah cukup (batas bawah eksak)", () => {
    const res = evaluateScan({ ...base, code: "asset-2", lastCode: "asset-1", lastCodeAt: base.now - SCAN_COOLDOWN_MS + 50 });
    expect(res).toBe("too-fast");
  });

  it("menolak duplikat bahkan saat in-flight tidak aktif dan waktu sangat dekat", () => {
    const res = evaluateScan({ ...base, code: "QR-STU-001", lastCode: "QR-STU-001", lastCodeAt: base.now - 10 });
    expect(res).toBe("same-code");
  });
});
