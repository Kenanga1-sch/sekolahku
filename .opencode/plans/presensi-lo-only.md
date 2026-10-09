# Presensi: LO-only — buang Chromium & dialog cetak

## Keputusan user (diskusi 2026-10-08 malam)

- PDF **hanya LibreOffice** (paling presisi); buang Chromium & dialog cetak.
- PrintPage (artefak cetak halaman / Ctrl+P / Pratinjau) **dipertahankan**.
- Endpoint chromium backend **dihapus total**.
- Label menu: **"PDF"** (tanpa nama engine).
- Export Excel & CSV **tetap**.

## Dampak

- Image −237 MiB (chromium) → CI lebih cepat, image ~1.2GB.
- Satu jalur PDF → tak ada lagi pekerjaan parity antar mesin.
- Geometry LO+Excel TIDAK berubah (fit-kolom/margin/centering ada di
  `fillPresensiWorksheet` — jalur LO/xlsx, bukan HTML).

## Penghapusan / perubahan per file

### Backend (Go)

**`go-backend/internal/handlers/pdf_handler.go`**

- Hapus: field `chromiumSem`, konstanta `chromiumTimeout`/`maxHTMLBodyBytes`,
  `unsafeHTMLPattern`+`unsafeHTML`, `chromiumPDFRequest`,
  seluruh seksi `PrintHTMLChromium` (baris ±143-240).
- `NewPDFHandler`: hanya `sofficeSem`.
- Pesan `ensureBinary`: "…gunakan pilihan PDF (dialog cetak)" →
  "…silakan gunakan export Excel sebagai gantinya".
- Bersihkan import yang jadi tak terpakai (`encoding/json`, `regexp` bila
  tidak dipakai bagian lain — ikuti `go vet`).
- Komentar header: satu engine (LibreOffice).

**`go-backend/cmd/api/routes.go:677`** — hapus
`guruGroup.POST("/presensi/pdf/chromium", h.PDF.PrintHTMLChromium)`.

**`go-backend/internal/handlers/pdf_handler_test.go`** — hapus `chromiumStub`

- 4 test chromium (`TestPrintHTMLChromiumMissingBinary|Validation|
RejectsScript|Success`); sisakan LO + sanitize + execWithTimeout.

### Frontend

**`app/(dashboard)/presensi/_components/laporan-presensi-tab.tsx`**

- Hapus: `handlePdfChromium` (±635-665), `handleCetakPdf` (±612-633),
  `handlePrint` (baris 370, hanya dipakai catch dialog), state
  `exportingPdf`; `exportingPdfServer` disederhanakan →
  `boolean exportingPdf` (LO saja) + tombol spinner tunggal.
- `buildPrintDocs`: kembalikan `{ buffers, title }` saja — buang `sections`,
  `extractPrintImages`, `printAreaPx`/`fitWidthPx`, `worksheetToHtml`,
  import `printLib`, dan `opts` (hanya dipakai jalur HTML).
- Menu Cetak▾: **"PDF"** → `handlePdfLibreOffice` (rename `handlePdf`),
  Excel, CSV. (Label loading "Menyiapkan PDF…".)
- Import baris 30 `pageCss, printAreaPx` TETAP (dipakai PrintPage).

**`lib/worksheet-print.ts`** — sisakan hanya geometry PrintPage:

- Keep: `WorksheetPrintOptions`, `PAPER_MM`, `printAreaPx`, `pageCss` (~85 baris).
- Hapus: `WorksheetRenderOptions`, `EMU_PER_PX`, `escapeHtml`, `argbToHex`,
  `cellText`, `cellStyleCss`, interface Excel*, `PrintImage`,
  `extractPrintImages`, `worksheetToHtml`, `buildPrintDocument`,
  `openPrintWindow`, `joinPageSections` (±450 → ~85 baris).

**`lib/worksheet-print.test.ts`** — sisakan describe `pageCss` + `printAreaPx`;
hapus describe lain (escapeHtml, argbToHex, cellText, cellStyleCss,
worksheetToHtml×3, extractPrintImages, joinPageSections, buildPrintDocument).

**`lib/_e2e-template.test.ts`** — hapus import `extractPrintImages,
worksheetToHtml` + blok render/gambar (baris ±86-90 dan assert html
setelahnya); sisakan assert fill (baris Jumlah/merge/kop/tanda tangan/pageSetup).

### Infra

**`Dockerfile`** — hapus `chromium` dari `apk add`; perbarui komentar mesin PDF
(only libreoffice-calc/writer + qpdf; font Carlito/alias tetap).
**`scripts/deploy.sh:168`** — komentar "chromium + libreoffice" → "libreoffice"
(kosmetik, jaga kebenaran dokumen).

## Perilaku baru

- Menu Cetak▾: `PDF` (selalu LibreOffice), `Excel`, `CSV`.
- PDF gagal/sibuk → toast pesan server + saran Excel (tanpa fallback dialog).
- Ctrl+P halaman laporan → PrintPage (F4, margin 10mm) tetap berfungsi.

## Verifikasi

1. `go vet ./... && go test ./...` (handler LO lulus; chromium test hilang).
2. `npx tsc --noEmit`, `npm run lint`, `npx vitest run` penuh.
3. Push → pantau pipeline → `DEPLOY [prod] BERHASIL` + sehat.
4. Smoke prod: `POST /api/presensi/pdf/chromium` → **404**;
   `POST /api/presensi/pdf/libreoffice` → 401 (tanpa sesi, route hidup);
   konversi LO container → 2 halaman 936×612 (regresi nol perubahan jalur LO);
   ukur size image turun.

## Risiko

- Perubahan murni destruktif/tidak ada perubahan alur LO → risiko rendah;
  tsc/go vet menangkap sisa referensi simbol terhapus.
- Kehilangan fallback PDF browser (sudah disetujui; Excel cadangan).
