"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Printer, FolderDown, RefreshCw, Settings2, ImageIcon, Save, RotateCcw, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCetakKartu } from "./use-cetak-kartu";
import { KartuPreview } from "./kartu-preview";
import { buildPrintPages, getOffset } from "./print-layout";

const COLUMN_LABELS = ["kiri", "kanan"];

export default function CetakKartuPage() {
  const {
    loading, downloading, cards, cardsPerRow, setCardsPerRow, cardType, setCardType,
    showPhoto, setShowPhoto, showNIS, setShowNIS, showBackSide, setShowBackSide,
    printMode, setPrintMode, flipEdge, setFlipEdge,
    adjust, setOffset, saveAdjust, resetAdjust,
    schoolName, schoolAddress, schoolLogo, printRef,
    downloadCard, downloadAllCards, handlePrint, setCardRef, router,
  } = useCetakKartu();

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const pages = buildPrintPages({ cards, cardsPerRow: Number(cardsPerRow), mode: printMode, showBackSide });
  const columns = Array.from({ length: Math.max(1, Number(cardsPerRow)) }, (_, i) => i);

  return (
    <>
      {/* Screen UI - Hidden when printing */}
      <div className="space-y-6 print:hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Cetak Kartu Peserta Didik</h1>
              <p className="text-muted-foreground text-sm">{cards.length} data siswa siap dicetak</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button variant="outline" onClick={downloadAllCards} className="gap-2" disabled={downloading}>
              <FolderDown className="h-4 w-4" />{downloading ? "Mengunduh..." : "Unduh Semua (PNG)"}
            </Button>
            <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white transition-all shadow-sm">
              <Printer className="h-4 w-4" />Cetak / Simpan PDF
            </Button>
          </div>
        </div>

        {/* PDF Hint */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 text-sm text-blue-700 dark:text-blue-300 shadow-sm">
          <ImageIcon className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Tips Cetak:</strong> Untuk menyimpan sebagai PDF, pilih opsi <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded font-mono text-xs">&quot;Save as PDF&quot;</code> atau <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded font-mono text-xs">&quot;Microsoft Print to PDF&quot;</code> pada dialog cetak.
          </span>
        </div>

        {/* Settings */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
              <Settings2 className="h-5 w-5 text-violet-500" />Pengaturan Cetak
            </CardTitle>
            <CardDescription className="text-xs">Isi kartu dan tata letak lembar sebelum diunduh atau dicetak</CardDescription>
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
              {cards.length} siswa · {printMode === "duplex" && showBackSide ? "mode duplex, halaman depan dan belakang" : showBackSide ? "sisi depan dan belakang" : "sisi depan saja"}{printMode === "duplex" && showBackSide ? ` · balik sisi ${flipEdge === "long" ? "panjang" : "pendek"}` : ""}
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Kolom kiri: isi kartu */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Isi Kartu</p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tipe Kartu</Label>
                  <Select value={cardType} onValueChange={(v) => setCardType(v as "pelajar" | "nisn" | "kip")}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pelajar">Kartu Pelajar</SelectItem>
                      <SelectItem value="nisn">Kartu NISN</SelectItem>
                      <SelectItem value="kip">Kartu KIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3 py-2 dark:border-zinc-800/70">
                  <Label htmlFor="showPhoto" className="cursor-pointer text-sm">Tampilkan Foto</Label>
                  <Switch checked={showPhoto} onCheckedChange={setShowPhoto} id="showPhoto" />
                </div>
                {cardType === "pelajar" && (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3 py-2 dark:border-zinc-800/70">
                    <Label htmlFor="showNIS" className="cursor-pointer text-sm">Tampilkan NIS</Label>
                    <Switch checked={showNIS} onCheckedChange={setShowNIS} id="showNIS" />
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3 py-2 dark:border-zinc-800/70">
                  <Label htmlFor="showBackSide" className="cursor-pointer text-sm">Tampilkan Sisi Belakang</Label>
                  <Switch checked={showBackSide} onCheckedChange={setShowBackSide} id="showBackSide" />
                </div>
              </div>

              {/* Kolom kanan: tata letak lembar */}
              <div className="space-y-3 sm:border-l sm:border-slate-200 sm:pl-8 sm:dark:border-zinc-800">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Tata Letak Lembar</p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Kartu per Baris</Label>
                  <Select value={cardsPerRow} onValueChange={setCardsPerRow}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Kartu</SelectItem>
                      <SelectItem value="2">2 Kartu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mode Cetak</Label>
                  <Select value={printMode} onValueChange={(v) => setPrintMode(v as "combined" | "duplex")}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="combined">Gabungan</SelectItem>
                      <SelectItem value="duplex">Duplex (depan-belakang)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {printMode === "duplex" && showBackSide && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Balik Kertas</Label>
                    <Select value={flipEdge} onValueChange={(v) => setFlipEdge(v as "long" | "short")}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="long">Sisi panjang</SelectItem>
                        <SelectItem value="short">Sisi pendek</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Penyesuaian Posisi (kartu terpisah — kalibrasi printer) */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                  <Crosshair className="h-5 w-5 text-violet-500" />Penyesuaian Posisi (mm)
                </CardTitle>
                <CardDescription className="text-xs">
                  Geser posisi kartu di kertas per sisi & kolom · Mode {printMode === "duplex" ? "Duplex" : "Gabungan"}
                </CardDescription>
              </div>
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" className="gap-1 h-8 px-2.5 text-xs" onClick={resetAdjust}>
                  <RotateCcw className="h-3 w-3" />Reset
                </Button>
                <Button type="button" size="sm" className="gap-1 h-8 px-2.5 text-xs" onClick={saveAdjust}>
                  <Save className="h-3 w-3" />Simpan
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-3">
            <div className="rounded-lg border border-slate-200 dark:border-zinc-800 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400">
                    <th className="px-2 py-1.5 text-left font-semibold">Sisi</th>
                    {columns.map((col) => (
                      <th key={col} className="px-2 py-1.5 text-left font-semibold">
                        Kolom {columns.length > 1 ? COLUMN_LABELS[col] ?? col + 1 : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(["front", "back"] as const)
                    .filter((side) => side === "front" || showBackSide)
                    .map((side) => (
                      <tr key={side} className="border-b border-slate-200/70 dark:border-zinc-800/70 last:border-0">
                        <td className="px-2 py-1.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {side === "front" ? "Depan" : "Belakang"}
                        </td>
                        {columns.map((col) => (
                          <td key={col} className="px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">X</span>
                              <MmInput value={getOffset(adjust, printMode, side, col).x} onCommit={(v) => setOffset(printMode, side, col, "x", v)} label={`${side === "front" ? "Depan" : "Belakang"} kolom ${col + 1} sumbu X`} />
                              <span className="text-slate-400">Y</span>
                              <MmInput value={getOffset(adjust, printMode, side, col).y} onCommit={(v) => setOffset(printMode, side, col, "y", v)} label={`${side === "front" ? "Depan" : "Belakang"} kolom ${col + 1} sumbu Y`} />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cetak uji, ubah angka lalu cetak ulang. Klik <strong>Simpan</strong> agar nilai tersimpan di browser ini dan tidak berubah saat halaman dimuat ulang.
            </p>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Pratinjau Kartu</CardTitle>
            <CardDescription className="text-xs">{showBackSide ? "Halaman depan & belakang" : "Halaman depan kartu saja"}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {cards.map((student) => (
                <div key={student.id} className="space-y-2 border-b pb-6 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{student.fullName}</span>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadCard(student.id, student.fullName)}>
                      <ImageIcon className="h-3.5 w-3.5" />Unduh PNG
                    </Button>
                  </div>
                  <div ref={(el) => setCardRef(student.id, el)} className="inline-flex gap-1.5">
                    <KartuPreview student={student} schoolName={schoolName} schoolAddress={schoolAddress} schoolLogo={schoolLogo} showPhoto={showPhoto} showNIS={showNIS} cardType={cardType} showBackSide={showBackSide} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Print Layout */}
      <div className="hidden print:block" ref={printRef}>
        {createPortal(
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 7mm; }

              /* Kerangka dashboard (sidebar/header/main) ikut ter-render karena
                 window.print() mencetak seluruh dokumen. Netralkan rantai
                 wrapper + <main> agar padding (pt-2/pt-4), gap, flex-1, dan
                 overflow tidak menggeser blok cetak dari margin @page — sumber
                 utama margin atas halaman kedua yang tidak konsisten. */
              body > div:not([class*="print:hidden"]),
              body > div > div:not([class*="print:hidden"]),
              body > div > div > div:not([class*="print:hidden"]),
              main {
                display: block !important;
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                gap: 0 !important;
              }

              html, body { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; background: #fff !important; }
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              .student-card { break-inside: avoid; page-break-inside: avoid; }

              .card-print-page {
                box-sizing: border-box;
                width: 100%;
                padding: 0;
                margin: 0;
                display: grid;
                grid-template-rows: repeat(4, 54mm);
                grid-auto-rows: 54mm;
                align-content: start;
                gap: 6mm;
                break-inside: avoid-page;
                page-break-inside: avoid;
              }
              /* Pemecahan pakai break-before pada halaman ke-2 dan seterusnya.
                 break-after di halaman terakhir menyisakan halaman kosong. */
              .card-print-page + .card-print-page {
                break-before: page;
                page-break-before: always;
              }
              .card-print-page > * {
                height: 54mm;
                overflow: hidden;
              }
              /* Kalibrasi posisi (offset mm) dipasang inline per sel kartu
                 (translate pada anak, bukan blok halaman) — transform pada
                 blok halaman yang dipecah break merusak pagination & margin
                 halaman berikutnya. Lihat print-layout.ts. */
            }
          `}</style>,
          document.head
        )}
        <div className="block">
          {pages.map((page) => (
            <div key={page.key} className="card-print-page" style={{ gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))` }}>
              {page.cells.map((cell) => {
                const offset = getOffset(adjust, printMode, cell.side, cell.col);
                return (
                  <div
                    key={cell.key}
                    className="flex break-inside-avoid page-break-inside-avoid"
                    style={{ transform: `translate(${offset.x}mm, ${offset.y}mm)` }}
                  >
                    <KartuPreview student={cell.student} schoolName={schoolName} schoolAddress={schoolAddress} schoolLogo={schoolLogo} showPhoto={showPhoto} showNIS={showNIS} cardType={cardType} showBackSide={showBackSide} printSide={cell.side} forPrint />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** Input nilai mm langsung (bukan slider). State teks terpisah agar angka
 *  parsial seperti "-" atau "2," saat diketik tidak dipaksa balik ke nilai lama;
 *  sinkronisasi dari luar (mis. tombol Reset) dilakukan saat render, bukan di
 *  effect, mengikuti pola "adjusting state when props change" dari React. */
function MmInput({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const [raw, setRaw] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setRaw(String(value));
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!Number.isNaN(parsed)) onCommit(parsed);
      }}
      onBlur={() => {
        const parsed = parseFloat(raw);
        if (Number.isNaN(parsed)) {
          setRaw(String(value));
          onCommit(value);
        } else if (parsed !== value) {
          setRaw(String(parsed));
          onCommit(parsed);
        }
      }}
      className="w-16 h-7 px-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}