import { describe, expect, it, vi } from "vitest";
import { createRef, useState, type RefObject } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { SheetGrid, browserFontFamily, type SheetGridHandle } from "@/components/report-builder/sheet-grid";
import { createSheet, cellKey, type ReportSheet } from "@/lib/config/report-sheet";
import type { PageBreakPlan } from "@/lib/report-paginate";

describe("sheet-grid rendering", () => {
  it("maps PDF core fonts to browser equivalents", () => {
    expect(browserFontFamily("Helvetica")).toBe('Helvetica, Arial, "Liberation Sans", sans-serif');
    expect(browserFontFamily("Times-Roman")).toBe('"Times New Roman", Times, serif');
    expect(browserFontFamily("Courier")).toBe('"Courier New", Courier, monospace');
  });

  it("maps added font families to browser stacks", () => {
    expect(browserFontFamily("Arial")).toBe('Arial, "Liberation Sans", Helvetica, sans-serif');
    expect(browserFontFamily("Bookman Old Style")).toContain("Bookman");
    expect(browserFontFamily("Liberation Serif")).toContain("Liberation Serif");
  });
});

function makeSheet(): ReportSheet {
  return createSheet({ id: "s1", name: "Sheet1", cols: 4, rows: 5 });
}

describe("sheet-grid interaksi", () => {
  it("kembali fokus ke grid setelah Enter sehingga panah tetap berfungsi", () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <SheetGrid
        sheet={makeSheet()}
        onChange={onChange}
        selected={{ r: 0, c: 0 }}
        onSelect={onSelect}
        hideToolbar
      />,
    );

    const scroll = container.querySelector("[tabindex='0']") as HTMLElement;
    expect(scroll).toBeTruthy();

    // Buka editor sel lalu ketik Enter.
    fireEvent.keyDown(scroll, { key: "Enter" });
    const input = scroll.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });

    // Setelah commit, fokus harus kembali ke container grid (via requestAnimationFrame).
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          expect(document.activeElement).toBe(scroll);
          // Panah berikutnya harus menggeser seleksi, bukan diam.
          fireEvent.keyDown(scroll, { key: "ArrowDown" });
          expect(onSelect).toHaveBeenCalledWith({ r: 1, c: 0 });
          resolve();
        });
      });
    });
  });

  it("tombol Delete menghapus shape/gambar terpilih, bukan sel", () => {
    const ref = createRef<SheetGridHandle>();
    const onChange = vi.fn();
    const sheet = { ...makeSheet(), shapes: [] as ReportSheet["shapes"] };
    const { container } = render(
      <SheetGrid
        ref={ref}
        sheet={sheet}
        onChange={onChange}
        selected={{ r: 0, c: 0 }}
        onSelect={() => {}}
        hideToolbar
      />,
    );

    // Tambah shape lewat API imperatif, lalu panggil delete lewat tombol Delete.
    act(() => ref.current!.addShape("rect"));
    expect(onChange).toHaveBeenCalled();
    const added = onChange.mock.calls[onChange.mock.calls.length - 1][0] as ReportSheet;
    expect(added.shapes).toHaveLength(1);

    const scroll = container.querySelector("[tabindex='0']") as HTMLElement;
    onChange.mockClear();
    fireEvent.keyDown(scroll, { key: "Delete" });

    const afterDelete = onChange.mock.calls[0]?.[0] as ReportSheet | undefined;
    expect(afterDelete?.shapes).toHaveLength(0);
  });

  it("lebar kolom dirender absolut (px) & kolom lain tak ikut berubah", () => {
    const sheet = createSheet({ id: "s2", name: "Sheet1", cols: 3, rows: 3, colWidths: [100, 200, 300] });
    const { container } = render(
      <SheetGrid
        sheet={sheet}
        onChange={() => {}}
        selected={{ r: 0, c: 0 }}
        onSelect={() => {}}
        hideToolbar
      />,
    );

    // Header kolom A/B/C memakai width px absolut (bukan persen).
    const headers = Array.from(container.querySelectorAll(".sticky.top-0.z-10 > div")) as HTMLElement[];
    const widths = headers.map((el) => el.style.width);
    expect(widths.some((w) => w.endsWith("px"))).toBe(true);
    expect(widths.some((w) => w.endsWith("%"))).toBe(false);
  });

  it("lebar kolom absolut TIDAK diregangkan meski lebih sempit dari kertas (kop_sek)", () => {
    // 23 kolom × 40px = 920px (690pt) pada LEGAL landscape (konten 929pt).
    // Perilaku Excel: tetap 920px — tidak di-auto-fill ke lebar kertas.
    const sheet = createSheet({
      id: "s3",
      name: "Kop",
      cols: 23,
      colWidths: Array.from({ length: 23 }, () => 40),
    });
    const contentWidthPt = 929;
    const plan: PageBreakPlan = {
      breakAfterOutputRow: new Set(),
      breakAfterInputRow: new Set(),
      pageOfInputRow: new Map(),
      rowsPerPage: [1],
      pageCount: 1,
      contentWidthPt,
      contentHeightPt: 500,
      headerHeightPt: 0,
      totalHeightPt: 30,
      marginTopPt: 36,
      marginRightPt: 40,
      marginBottomPt: 45,
      marginLeftPt: 40,
      typography: { baseFontSize: 11, tableFontSize: 11, lineHeight: 1.4, rowPadding: 4, blockGap: 8 },
    };
    const { container } = render(
      <SheetGrid
        sheet={sheet}
        onChange={() => {}}
        selected={{ r: 0, c: 0 }}
        onSelect={() => {}}
        hideToolbar
        pageBreakPlan={plan}
        zoom={1}
      />,
    );
    const headers = Array.from(container.querySelectorAll(".sticky.top-0.z-10 > div")) as HTMLElement[];
    const px = headers.map((el) => parseFloat(el.style.width) || 0);
    const total = px.reduce((a, b) => a + b, 0);
    // Total tetap 920px (23 × 40), bukan diregangkan ke ~1239px.
    expect(total).toBeCloseTo(920, 0);
  });

  it("kolom dengan lebar 0 disembunyikan (garis tipis unhide)", () => {
    const sheet = createSheet({ id: "s4", name: "S", cols: 3, colWidths: [96, 0, 96] });
    const { container } = render(
      <SheetGrid
        sheet={sheet}
        onChange={() => {}}
        selected={{ r: 0, c: 0 }}
        onSelect={() => {}}
        hideToolbar
      />,
    );
    const headerRow = container.querySelector(".sticky.top-0.z-10");
    const thin = headerRow?.querySelector('[title*="tersembunyi"]');
    expect(thin).not.toBeNull();
  });

  it("deleteLastRow mengurangi tepat 1 baris per klik (bukan semua sekaligus)", () => {
    const ref = createRef<SheetGridHandle>();
    const sheet = createSheet({ id: "s5", name: "S", cols: 3 });
    const { container } = render(
      <SheetGrid
        ref={ref}
        sheet={sheet}
        onChange={() => {}}
        selected={{ r: 0, c: 0 }}
        onSelect={() => {}}
        hideToolbar
      />,
    );
    const rows = () => container.querySelectorAll('[title^="Pilih baris"]').length;

    expect(rows()).toBe(12);
    // Tambah 6 baris (perilaku "Row Below" pada sheet kosong) → 18.
    act(() => {
      for (let i = 0; i < 6; i++) ref.current!.insertRowBelow();
    });
    expect(rows()).toBe(18);
    // Satu klik = satu baris, bukan langsung reset ke 12.
    act(() => ref.current!.deleteLastRow());
    expect(rows()).toBe(17);
    act(() => {
      for (let i = 0; i < 5; i++) ref.current!.deleteLastRow();
    });
    expect(rows()).toBe(12);
  });

  it("deleteLastRow berhenti di 1 baris (tidak pernah 0)", () => {
    const ref = createRef<SheetGridHandle>();
    const sheet = createSheet({ id: "s6", name: "S", cols: 2 });
    const { container } = render(
      <SheetGrid
        ref={ref}
        sheet={sheet}
        onChange={() => {}}
        selected={{ r: 0, c: 0 }}
        onSelect={() => {}}
        hideToolbar
      />,
    );
    act(() => {
      for (let i = 0; i < 50; i++) ref.current!.deleteLastRow();
    });
    expect(container.querySelectorAll('[title^="Pilih baris"]').length).toBe(1);
  });

  it("setelah padding habis, deleteLastRow menghapus baris data terakhir", () => {
    const ref = createRef<SheetGridHandle>();
    const sheet = createSheet({ id: "s7", name: "S", cols: 2 });
    sheet.cells[cellKey(13, 0)] = { value: "TERAKHIR" };
    const { container } = render(
      <StatefulGrid initial={sheet} refCb={ref} />,
    );
    const rows = () => container.querySelectorAll('[title^="Pilih baris"]').length;

    expect(rows()).toBe(18); // dataRows 14 + padding
    // 4 klik pertama menghabisi padding dulu.
    act(() => {
      for (let i = 0; i < 4; i++) ref.current!.deleteLastRow();
    });
    expect(rows()).toBe(14);
    expect(container.textContent).toContain("TERAKHIR");
    // Klik ke-5: baris data terakhir ikut terhapus struktural.
    act(() => ref.current!.deleteLastRow());
    expect(rows()).toBe(13);
    expect(container.textContent).not.toContain("TERAKHIR");
  });

  it("insert di dalam data menambah tepat 1 baris tampilan (simetri dengan hapus)", () => {
    const ref = createRef<SheetGridHandle>();
    const sheet = createSheet({ id: "s8", name: "S", cols: 2 });
    for (let r = 0; r < 10; r++) sheet.cells[cellKey(r, 0)] = { value: `R${r}` };
    const { container } = render(<StatefulGrid initial={sheet} refCb={ref} />);
    const rows = () => container.querySelectorAll('[title^="Pilih baris"]').length;

    expect(rows()).toBe(14); // max(10 + 4, minRows 12)
    act(() => ref.current!.insertRowBelow()); // selected r=0 → insert di dalam data
    expect(rows()).toBe(15); // +1, bukan +2
  });
});

/** Grid dengan sheet berstate — meniru induk yang meneruskan `onChange`. */
function StatefulGrid({ initial, refCb }: { initial: ReportSheet; refCb: RefObject<SheetGridHandle | null> }) {
  const [cur, setCur] = useState(initial);
  return (
    <SheetGrid
      ref={refCb}
      sheet={cur}
      onChange={setCur}
      selected={{ r: 0, c: 0 }}
      onSelect={() => {}}
      hideToolbar
    />
  );
}

function cellEls(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(".cursor-cell")) as HTMLElement[];
}

describe("sheet-grid merge vertikal", () => {
  it("merge vertikal menyimpan rowSpan & menghapus sel tertutup", () => {
    const ref = createRef<SheetGridHandle>();
    const onChange = vi.fn();
    const sheet = createSheet({ id: "m1", name: "S", cols: 2, rows: 4, rowHeights: { 0: 24, 1: 24, 2: 24 } });
    const { container } = render(
      <SheetGrid
        ref={ref}
        sheet={sheet}
        onChange={onChange}
        selected={{ r: 0, c: 0 }}
        onSelect={() => {}}
        hideToolbar
      />,
    );

    const cells = cellEls(container);
    fireEvent.mouseDown(cells[0]);
    fireEvent.mouseEnter(cells[4]);
    act(() => ref.current!.mergeSelection());

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ReportSheet;
    expect(next.cells[cellKey(0, 0)]).toMatchObject({ rowSpan: 3, colSpan: 1 });
    expect(next.cells[cellKey(1, 0)]).toBeUndefined();
    expect(next.cells[cellKey(2, 0)]).toBeUndefined();
  });

  it("split dari sel yang tertutup mengembalikan span anchor", () => {
    const ref = createRef<SheetGridHandle>();
    const onChange = vi.fn();
    const sheet = createSheet({ id: "m2", name: "S", cols: 2 });
    sheet.cells[cellKey(0, 0)] = { value: "Gabung", rowSpan: 2, colSpan: 2 };
    render(
      <SheetGrid
        ref={ref}
        sheet={sheet}
        onChange={onChange}
        selected={{ r: 1, c: 1 }}
        onSelect={() => {}}
        hideToolbar
      />,
    );

    act(() => ref.current!.unmergeSelection());
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ReportSheet;
    expect(next.cells[cellKey(0, 0)]?.rowSpan).toBeUndefined();
    expect(next.cells[cellKey(0, 0)]?.colSpan).toBeUndefined();
  });

  it("merge menolak seleksi yang menimpa merge yang ada (cegah span hilang)", () => {
    const ref = createRef<SheetGridHandle>();
    const onChange = vi.fn();
    const sheet = createSheet({ id: "m3", name: "S", cols: 3 });
    sheet.cells[cellKey(0, 0)] = { value: "A", colSpan: 2 };
    const { container } = render(
      <SheetGrid
        ref={ref}
        sheet={sheet}
        onChange={onChange}
        selected={{ r: 0, c: 1 }}
        onSelect={() => {}}
        hideToolbar
      />,
    );

    // A1 sudah merge (colSpan 2 → menutup A1:B1). Seleksi B1→C1 menimpanya.
    const cells = cellEls(container);
    fireEvent.mouseDown(cells[1]);
    fireEvent.mouseEnter(cells[2]);
    act(() => ref.current!.mergeSelection());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("baris anchor merge vertikal tumbuh menyerap baris tertutup", () => {
    const baseRows = (c: HTMLElement) =>
      (Array.from(c.querySelectorAll("div.flex")) as HTMLElement[]).filter(
        (el) => (el.firstElementChild as HTMLElement)?.style?.width === "32px",
      );
    const base = createSheet({ id: "m4", name: "S", cols: 2, rows: 4, rowHeights: { 0: 24, 1: 24, 2: 24 } });
    const merged: ReportSheet = { ...base, cells: { [cellKey(0, 0)]: { rowSpan: 3 } } };

    const { container: c1 } = render(
      <SheetGrid sheet={base} onChange={() => {}} selected={{ r: 0, c: 0 }} onSelect={() => {}} hideToolbar />,
    );
    const { container: c2 } = render(
      <SheetGrid sheet={merged} onChange={() => {}} selected={{ r: 0, c: 0 }} onSelect={() => {}} hideToolbar />,
    );

    const h1 = parseFloat(baseRows(c1)[0].style.minHeight || "0");
    const h2 = parseFloat(baseRows(c2)[0].style.minHeight || "0");
    expect(h2).toBeGreaterThan(h1);
  });

  it("merge horizontal tidak membuat ruang kosong setelah anchor", () => {
    const sheet = createSheet({ id: "m9", name: "S", cols: 3, colWidths: [100, 120, 140] });
    sheet.cells[cellKey(0, 0)] = { value: "MERGE", colSpan: 2 };
    sheet.cells[cellKey(0, 2)] = { value: "KANAN" };
    const { container } = render(
      <SheetGrid sheet={sheet} onChange={() => {}} selected={{ r: 0, c: 0 }} onSelect={() => {}} hideToolbar />,
    );

    const gutter = container.querySelector('[title="Pilih baris 1"]') as HTMLElement;
    const kids = Array.from(gutter.parentElement!.children) as HTMLElement[];
    // gutter + anchor A:B + cell C. Tidak ada placeholder B tambahan.
    expect(kids).toHaveLength(3);
    expect(kids[1].style.width).toBe("220px");
    expect(kids[2].style.width).toBe("140px");
  });

  it("sel tertutup tetap memakan slot kolom — sel sesudahnya tidak bergeser", () => {
    const sheet = createSheet({ id: "m5", name: "S", cols: 3, colWidths: [100, 120, 140] });
    sheet.cells[cellKey(0, 0)] = { value: "JUDUL", rowSpan: 2 };
    const { container } = render(
      <SheetGrid sheet={sheet} onChange={() => {}} selected={{ r: 0, c: 0 }} onSelect={() => {}} hideToolbar />,
    );

    const gutter2 = container.querySelector('[title="Pilih baris 2"]') as HTMLElement;
    const kids = Array.from(gutter2.parentElement!.children) as HTMLElement[];
    // gutter + slot A (tertutup) + B + C — kolom tidak kehilangan kotak.
    expect(kids).toHaveLength(4);
    expect(kids[1].style.width).toBe("100px");
    expect(kids[2].style.width).toBe("120px");
    expect(kids[3].style.width).toBe("140px");
  });

  it("baris tertutup pertama ditarik ke atas — tinggi total tidak bertambah", () => {
    const sheet = createSheet({ id: "m6", name: "S", cols: 2, rowHeights: { 0: 24, 1: 24, 2: 24 } });
    sheet.cells[cellKey(0, 0)] = { value: "G", rowSpan: 2 };
    const { container } = render(
      <SheetGrid sheet={sheet} onChange={() => {}} selected={{ r: 0, c: 0 }} onSelect={() => {}} hideToolbar />,
    );

    // Baris 1 (anchor): menyerap tinggi baris 2 → 24 + 24.
    const gutter1 = container.querySelector('[title="Pilih baris 1"]') as HTMLElement;
    expect((gutter1.parentElement as HTMLElement).style.minHeight).toBe("48px");
    // Baris 2 (tertutup): ditarik ke atas sebesar serapan → −24px.
    const gutter2 = container.querySelector('[title="Pilih baris 2"]') as HTMLElement;
    const outer2 = gutter2.parentElement!.parentElement as HTMLElement;
    expect(outer2.style.marginTop).toBe("-24px");
    // Baris 3 tidak ditarik (hanya baris tertutup PERTAMA).
    const gutter3 = container.querySelector('[title="Pilih baris 3"]') as HTMLElement;
    expect((gutter3.parentElement!.parentElement as HTMLElement).style.marginTop).toBe("");
  });

  it("sel non-anchor & gutter di baris anchor tidak ikut meregang", () => {
    const sheet = createSheet({ id: "m7", name: "S", cols: 2, rowHeights: { 0: 24, 1: 24 } });
    sheet.cells[cellKey(0, 0)] = { value: "G", rowSpan: 2 };
    const { container } = render(
      <SheetGrid sheet={sheet} onChange={() => {}} selected={{ r: 0, c: 0 }} onSelect={() => {}} hideToolbar />,
    );

    const gutter1 = container.querySelector('[title="Pilih baris 1"]') as HTMLElement;
    const kids = Array.from(gutter1.parentElement!.children) as HTMLElement[];
    // gutter (0), anchor A (1), sel B (2).
    expect(kids[0].style.alignSelf).toBe("flex-start");
    expect(kids[0].style.height).toBe("24px");
    expect(kids[2].style.alignSelf).toBe("flex-start");
    expect(kids[2].style.height).toBe("24px");
    // Anchor tetap default (ikut meregang mengisi baris yang tumbuh).
    expect(kids[1].style.alignSelf).toBe("");
  });

  it("klik pada area tertutup memilih sel jangkarnya (bukan sel kosong baru)", () => {
    const ref = createRef<SheetGridHandle>();
    const onSelect = vi.fn();
    const sheet = createSheet({ id: "m8", name: "S", cols: 2, rowHeights: { 0: 24, 1: 24 } });
    sheet.cells[cellKey(0, 0)] = { value: "G", rowSpan: 2 };
    const { container } = render(
      <SheetGrid ref={ref} sheet={sheet} onChange={() => {}} selected={{ r: 0, c: 0 }} onSelect={onSelect} hideToolbar />,
    );

    const gutter2 = container.querySelector('[title="Pilih baris 2"]') as HTMLElement;
    const slot = Array.from(gutter2.parentElement!.children)[1] as HTMLElement;
    fireEvent.mouseDown(slot);
    expect(onSelect).toHaveBeenCalledWith({ r: 0, c: 0 });
  });
});
