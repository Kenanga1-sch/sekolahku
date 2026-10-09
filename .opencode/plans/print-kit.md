# Print Kit: peralatan cetak bersama agar format baru modul lain mudah

## Keputusan user (diskusi)

- Sasaran: **kit umum + presensi dijadikan contoh**; inventaris/tabungan (grid
  runner) tidak diutak-atik dulu.
- Bentuk: **fungsi util murni** (bukan hook React).
- Verifikasi: **test vitest skipIf (soffice/template ada) + skrip manual**.
- Urutan eksekusi: **setelah** rencana LO-only (kode sudah bersih).

## Masalah yang dipecahkan

"Cara cetak yang benar" (fit kolom, margin 10mm, centering, kode kertas,
variabel {{}}) hari ini terkunci di dalam kode presensi — modul lain harus
meniru & rawan mengulang bug yang sama (7 insiden 2026-10-08).

## Desain kit — `lib/print-kit.ts` (baru)

Fungsi util murni, tanpa dependensi React:

1. `resolveModuleTemplate(module: string, opts?: { fetchFn?; apiBase?; fallbackUrl?: string })`
   → `{ url, paperSize, orientation, fromDefault }`
   - Umumkan logika `resolvePresensiTemplateUrl` (GET
     `/api/reports/templates/default/<module>`, normalisasi path privat
     `/api/files/…`, fallback opsional).
   - `presensi-excel.ts:resolvePresensiTemplateUrl` di-refactor menjadi
     pembungkus tipis (fallback PRESENSI_TEMPLATE_PATH) → test lama tetap lulus.

2. `PAPER_SIZE_CODES` (pindah dari presensi-excel) + `applyPrintPageSetup(ws, { paperSize, orientation })`
   - Blok pageSetup tervalidasi: paperSize kode ECMA-376, orientasi,
     `fitToPage/fitToWidth=1/fitToHeight=0`, margins 10mm (0.4in),
     `horizontalCentered: true`.
   - presensi-excel memanggil kit (import dari print-kit; kit TIDAK import
     presensi-excel → tanpa siklus).

3. `convertXlsxToPdf(buffers: ArrayBuffer[], filename: string, apiBase?: string)`
   → `Promise<{ blob: Blob; filename: string }>`
   - Boilerplate FormData → POST `/api/presensi/pdf/libreoffice` → cek resp →
     blob (diambil dari handlePdfLibreOffice; endpoint lama dipakai apa adanya,
     cukup dipakai lintas modul — dicatat di panduan).

4. `downloadPdf(result, fallbackName)` — anchor download (diambil dari
   downloadPdfBlob).

Catatan: export-Excel per modul tetap memakai exceljs masing-masing; kit bisa
menambah helper kecil `saveWorkbookBuffer(wb, name)` bila berguna — keputusan
saat implementasi (opsional, jangan dipaksakan).

## Contoh penerapan: presensi (refactor, perilaku nol berubah)

- `fillPresensiWorksheet`: ganti blok pageSetup inline →
  `applyPrintPageSetup(ws, { paperSize, orientation })`; `PAPER_SIZE_CODES`
  diimpor dari kit (re-export lama dipertahankan bila test mengimpor).
- `laporan-presensi-tab.tsx` (`buildPrintDocs` + `handlePdf` pasca LO-only):
  pakai `resolveModuleTemplate("presensi", { fallbackUrl })`,
  `convertXlsxToPdf`, `downloadPdf`.
- Semua test presensi harus lulus tanpa perubahan perilaku.

## Verifikasi otomatis

1. `lib/print-kit.test.ts` — unit: applyPrintPageSetup (mock ws: assert
   fitToHeight=0, margins0.4, horizontalCentered), convertXlsxToPdf (fetch
   mock), resolveModuleTemplate (fetch mock).
2. `lib/template-pdf-verify.test.ts` — **skipIf** `!sofficeAtauContainer`
   dan template asli tak ada:
   - fill template nyata (40 + 10 siswa) → tulis xlsx sementara →
     `soffice --headless --convert-to pdf` (env HOME/UserInstallation sementara,
     timeout) → parse PDF murni JS (regex MediaBox → ukuran mm ±2mm,
     jumlah /Type /Page) → assert F4 landscape + 2 halaman (40) / 1 (10).
   - Bila `pdfinfo` tersedia → assert tambahan; bila tidak → cukup MediaBox.
   - Pola sama dengan `_e2e-template` (skip bila lingkungan tak punya binary).
3. `scripts/verify-template-pdf.sh` — skrip manual/dev & pasca-deploy:
   terima path xlsx → convert (lokal atau `podman exec sekolahku-dev`) →
   `pdfinfo` hasil. Dipakai saat mengubah template/modul.

## Dokumentasi

`docs/cetak-format-baru.md` (bahasa Indonesia, langkah praktis):

1. Buat record template (admin → laporan-format): module, kertas (A4/F4),
   orientasi.
2. Desain .xlsx: token {{…}} yang dikenali, baris contoh untuk tabel ({{no}},
   {{nama}}, {{tgl_n}}), jangan set ukuran kertas sendiri (form admin +
   kit yang menentukan).
3. Tulis fill fn modul: mapping baris khas modul + panggil
   `applyPrintPageSetup`.
4. Pasang menu Cetak: `resolveModuleTemplate` → fill → `convertXlsxToPdf`
   → `downloadPdf`; multi kelas → kirim banyak buffer (backend merge qpdf).
5. Jalankan verifikasi: `npx vitest run lib/template-pdf-verify.test.ts`
   atau skrip.
6. Jebakan yang sudah diketahui (catatan insiden): jangan `fitToHeight=1`;
   margin/centering serahkan ke kit; jangan hardcode `@page` di modul;
   wrapper cetak jangan `display:inline-block`; lebar kolom exceljs ≠
   konversi LibreOffice (otomatis netral dengan fit-kolom).

## File yang disentuh (estimasi)

- Baru: `lib/print-kit.ts`, `lib/print-kit.test.ts`,
  `lib/template-pdf-verify.test.ts`, `scripts/verify-template-pdf.sh`,
  `docs/cetak-format-baru.md`.
- Ubah (refactor, nol perilaku): `lib/presensi-excel.ts`,
  `app/(dashboard)/presensi/_components/laporan-presensi-tab.tsx`,
  test terkait bila perlu penyesuaian import.

## Urutan eksekusi

1. Rencana **LO-only** (sudah disetujui) → push & deploy.
2. Rencana **ini** di atas kode bersih → push & deploy.
3. Lapor hasil + contoh penerapan presensi sebelum/sesudah (identik).

## Risiko

- Refactor presensi = pindah kode, bukan ubah perilaku → guard test lama.
- Test PDF butuh soffice → skip otomatis di lingkungan tanpa binary (CI
  tetap hijau); kepastian penuh di dev/container.
