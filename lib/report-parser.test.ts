import { describe, it, expect } from "vitest";
import {
  parseCellValue,
  tokenType,
  isListValue,
  isFormula,
  resolvePath,
  a1ToAddress,
  addressToA1,
  parseRange,
} from "./report-parser";

describe("report-parser", () => {
  it("mengenali teks biasa dan sel kosong", () => {
    expect(parseCellValue("Nama")).toEqual({ type: "TEXT", raw: "Nama" });
    expect(tokenType("")).toBe("EMPTY");
    expect(tokenType("   ")).toBe("EMPTY");
  });

  it("mengenali variabel scalar {{path}}", () => {
    const t = parseCellValue("{{laporan.periode}}");
    expect(t.type).toBe("SCALAR");
    if (t.type === "SCALAR") expect(t.path).toBe("laporan.periode");
  });

  it("mengenali variabel list {nama} dan {list.field}", () => {
    const a = parseCellValue("{nama_siswa}");
    expect(a.type).toBe("LIST");
    if (a.type === "LIST") {
      expect(a.root).toBe("nama_siswa");
      expect(a.field).toBeUndefined();
    }
    const b = parseCellValue("{items.saldo}");
    if (b.type === "LIST") {
      expect(b.root).toBe("items");
      expect(b.field).toBe("saldo");
    }
    expect(isListValue("{nama}")).toBe(true);
    expect(isListValue("{{nama}}")).toBe(false);
  });

  it("mengenali rumus =EXPR", () => {
    const t = parseCellValue("=SUM(C2:C5)");
    expect(t.type).toBe("FORMULA");
    if (t.type === "FORMULA") expect(t.expr).toBe("SUM(C2:C5)");
    expect(isFormula("=1+2")).toBe(true);
    expect(isFormula("1+2")).toBe(false);
  });

  it("resolvePath mengambil nilai bertitik", () => {
    const obj = { a: { b: { c: 42 } }, x: 1 };
    expect(resolvePath(obj, "a.b.c")).toBe(42);
    expect(resolvePath(obj, "x")).toBe(1);
    expect(resolvePath(obj, "a.z")).toBeUndefined();
    expect(resolvePath(null, "a")).toBeUndefined();
  });

  it("a1ToAddress & addressToA1 bolak-balik", () => {
    expect(a1ToAddress("A1")).toEqual({ r: 0, c: 0 });
    expect(a1ToAddress("C2")).toEqual({ r: 1, c: 2 });
    expect(a1ToAddress("AA10")).toEqual({ r: 9, c: 26 });
    expect(addressToA1(0, 0)).toBe("A1");
    expect(addressToA1(1, 2)).toBe("C2");
    expect(addressToA1(9, 26)).toBe("AA10");
    expect(a1ToAddress("bad")).toBeNull();
  });

  it("parseRange menghasilkan daftar koordinat", () => {
    const single = parseRange("B3");
    expect(single?.refs).toEqual([{ r: 2, c: 1 }]);

    const range = parseRange("A1:B2");
    expect(range?.refs.length).toBe(4);
    expect(range?.refs).toContainEqual({ r: 0, c: 0 });
    expect(range?.refs).toContainEqual({ r: 1, c: 1 });

    const crossSheet = parseRange("Sheet1!A1:A3");
    expect(crossSheet?.sheet).toBe("Sheet1");
    expect(crossSheet?.refs.length).toBe(3);

    expect(parseRange("???")).toBeNull();
  });
});
