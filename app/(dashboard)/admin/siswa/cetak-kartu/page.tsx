"use client";

import { createPortal } from "react-dom";
import { ArrowLeft, Printer, FolderDown, RefreshCw, Settings2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCetakKartu } from "./use-cetak-kartu";
import { KartuPreview } from "./kartu-preview";

export default function CetakKartuPage() {
  const {
    loading, downloading, cards, cardsPerRow, setCardsPerRow, cardType, setCardType,
    showPhoto, setShowPhoto, showNIS, setShowNIS, showBackSide, setShowBackSide,
    printMode, setPrintMode, flipEdge, setFlipEdge, backOffsetMm, setBackOffsetMm,
    schoolName, schoolAddress, schoolLogo, printRef,
    downloadCard, downloadAllCards, handlePrint, setCardRef, router,
  } = useCetakKartu();

  const cardsPerPage = Math.max(1, Number(cardsPerRow) * 4);
  const cardBatches = Array.from({ length: Math.ceil(cards.length / cardsPerPage) }, (_, index) => cards.slice(index * cardsPerPage, (index + 1) * cardsPerPage));

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

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
            <CardDescription className="text-xs">Sesuaikan tipe kartu, tata letak, dan detail sebelum diunduh atau dicetak</CardDescription>
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
            {cards.length} siswa · {printMode === "duplex" && showBackSide ? "mode duplex, halaman depan dan belakang" : showBackSide ? "sisi depan dan belakang" : "sisi depan saja"}{printMode === "duplex" && showBackSide ? ` · balik sisi ${flipEdge === "long" ? "panjang" : "pendek"}` : ""}
          </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-5 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tipe Kartu</Label>
                <Select value={cardType} onValueChange={(v: any) => setCardType(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pelajar">Kartu Pelajar</SelectItem>
                    <SelectItem value="nisn">Kartu NISN</SelectItem>
                    <SelectItem value="kip">Kartu KIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Kartu per Baris</Label>
                <Select value={cardsPerRow} onValueChange={setCardsPerRow}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Kartu</SelectItem>
                    <SelectItem value="2">2 Kartu</SelectItem>
                    <SelectItem value="3">3 Kartu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 py-2"><Switch checked={showPhoto} onCheckedChange={setShowPhoto} id="showPhoto" /><Label htmlFor="showPhoto" className="cursor-pointer text-sm">Tampilkan Foto</Label></div>
              {cardType === "pelajar" && (
                <div className="flex items-center gap-3 py-2"><Switch checked={showNIS} onCheckedChange={setShowNIS} id="showNIS" /><Label htmlFor="showNIS" className="cursor-pointer text-sm">Tampilkan NIS</Label></div>
              )}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mode Cetak</Label>
                <Select value={printMode} onValueChange={(v) => setPrintMode(v as "combined" | "duplex")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="combined">Gabungan</SelectItem>
                    <SelectItem value="duplex">Duplex (depan-belakang)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 py-2"><Switch checked={showBackSide} onCheckedChange={setShowBackSide} id="showBackSide" /><Label htmlFor="showBackSide" className="cursor-pointer text-sm">Tampilkan Sisi Belakang</Label></div>
              {printMode === "duplex" && showBackSide && (
                <div className="space-y-2">
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
              {printMode === "duplex" && showBackSide && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Penyesuaian Sisi Belakang (kalibrasi): {backOffsetMm}mm
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={0.5}
                    value={backOffsetMm}
                    onChange={(e) => setBackOffsetMm(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Cetak uji, lalu geser sampai kartu belakang tepat di belakang kartu depan.
                  </p>
                </div>
              )}
            </div>
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
              /* Geser seluruh isi halaman depan 2mm ke kiri (0,2 cm). Dipakai
                 margin-left pada blok halaman, bukan transform — transform pada
                 halaman yang dipecah break merusak pagination & margin halaman
                 berikutnya. */
              .card-print-page-front { margin-left: -2mm; }
              /* Halaman belakang: geser isi kartu (bukan blok halaman) sebesar
                 offset hasil kalibrasi. Saat dicetak long-edge, driver printer
                 mencerminkan posisi, sehingga kartu belakang perlu digeser agar
                 jatuh tepat di belakang kartu depan. transform tidak mengubah
                 layout/lebar, jadi aman terhadap pagination & margin. */
              .card-print-page-back > * { transform: translateX(${backOffsetMm}mm); }
            }
          `}</style>,
          document.head
        )}
        <div className="block">
          {printMode === "duplex" ? (
            <>
              {cardBatches.map((batch, batchIndex) => (
                <div key={`front-${batchIndex}`} className="card-print-page card-print-page-front" style={{ gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))` }}>
                  {batch.map((student) => <div key={student.id} className="flex break-inside-avoid page-break-inside-avoid"><KartuPreview student={student} schoolName={schoolName} schoolAddress={schoolAddress} schoolLogo={schoolLogo} showPhoto={showPhoto} showNIS={showNIS} cardType={cardType} showBackSide={showBackSide} printSide="front" forPrint /></div>)}
                </div>
              ))}
              {showBackSide && cardBatches.map((batch, batchIndex) => (
                <div key={`back-${batchIndex}`} className="card-print-page card-print-page-back" style={{ gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))` }}>
                  {batch.map((student) => <div key={student.id} className="flex break-inside-avoid page-break-inside-avoid"><KartuPreview student={student} schoolName={schoolName} schoolAddress={schoolAddress} schoolLogo={schoolLogo} showPhoto={showPhoto} showNIS={showNIS} cardType={cardType} showBackSide={showBackSide} printSide="back" forPrint /></div>)}
                </div>
              ))}
            </>
          ) : (
            cards.reduce<(typeof cards)[]>((batches, card, index) => {
              const current = Math.floor(index / cardsPerPage);
              if (!batches[current]) batches[current] = [];
              batches[current].push(card);
              return batches;
            }, []).map((batch, batchIndex) => (
              <div key={`page-${batchIndex}`} className="card-print-page card-print-page-front" style={{ gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))` }}>
                {batch.map((student) => <div key={student.id} className="flex gap-1.5 break-inside-avoid page-break-inside-avoid"><KartuPreview student={student} schoolName={schoolName} schoolAddress={schoolAddress} schoolLogo={schoolLogo} showPhoto={showPhoto} showNIS={showNIS} cardType={cardType} showBackSide={showBackSide} forPrint /></div>)}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}