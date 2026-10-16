# Cetak format baru per modul (print-kit)

Panduan praktis menambah "Cetak → PDF/Excel" untuk modul lain tanpa
menyalin ulang kode presensi. Semua peralatan bersama ada di
`lib/print-kit.ts`; presensi adalah contoh penerapan lengkap
(`lib/presensi-excel.ts` + `app/(dashboard)/presensi/_components/laporan-presensi-tab.tsx`).

## Langkah

### 1. Daftarkan template (admin)

Admin → Laporan → format cetak (`/admin/laporan-format`): buat record
`report_templates` untuk modul baru (`module` = slug modul, mis. `tabungan`),
pilih kertas (A4/F4) dan orientasi. Record ini yang dibaca
`resolveModuleTemplate` lewat `GET /api/reports/templates/default/<module>`.

### 2. Desain .xlsx (template)

- Isi variabel `{{...}}` yang dikenali. Daftar lengkap & deskripsi per modul:
  halaman admin **Kamus Variabel** (`/admin/kamus-variabel`), sumber kode di
  `lib/config/report-variables.ts` (satu-satunya sistem kamus; katalog Report
  Builder lama sudah dibongkar 2026-10-16).
- Untuk tabel berbaris: sediakan SATU baris contoh berisi variabel baris
  (`{{no}}`, `{{nama}}`, …) — fill function mereplikasinya per data.
- Jangan set ukuran kertas/margin di template: form admin + print-kit yang
  menentukan (kode kertas ECMA-376 + fit kolom + margin 10mm + centering).
- Simpan di admin (folder privat `uploads/templates/…`) — jangan hardcode path.

### 3. Tulis fill function modul

```ts
import { applyPrintPageSetup } from "@/lib/print-kit";

// … setelah mengisi sel dari template (substitusi {{…}}, replikasi baris):
applyPrintPageSetup(ws, {
  paperSize: input.paperSize, // "A4" | "F4" | "LEGAL"
  orientation: input.orientation, // "landscape" | "portrait"
});
```

Jangan menulis `pageSetup` sendiri — `applyPrintPageSetup` yang menjamin
fit kolom (`fitToHeight=0`), margin 10mm, dan centering.

### 4. Pasang menu Cetak di UI

```ts
import {
  resolveModuleTemplate,
  convertXlsxToPdf,
  downloadPdf,
} from "@/lib/print-kit";

const { url, paperSize, orientation } = await resolveModuleTemplate(
  "tabungan",
  {
    apiBase: process.env.NEXT_PUBLIC_API_URL || "",
    fallbackUrl: "/templates/tabungan-bawaan.xlsx", // opsional
  },
);
// … fetch url → ExcelJS load → fill (termasuk applyPrintPageSetup) → writeBuffer
const result = await convertXlsxToPdf([buffer], "laporan-tabungan.pdf");
downloadPdf(result, "laporan-tabungan.pdf");
```

- Multi-kelas/periode: kirim banyak buffer — backend menggabungkan dengan qpdf.
- Endpoint konversi dipakai apa adanya lintas modul
  (`POST /api/presensi/pdf/libreoffice`) — namanya "presensi" karena sejarah,
  isinya netral (soffice + qpdf).
- Export Excel per modul tetap memakai exceljs masing-masing (unduh langsung,
  tanpa server). Saat LO sibuk/gagal, arahkan user ke export Excel/CSV.

### 5. Verifikasi sebelum rilis

```bash
# unit + verifikasi PDF nyata (otomatis skip bila soffice/template absen):
npx vitest run lib/print-kit.test.ts lib/template-pdf-verify.test.ts

# manual, terima path .xlsx apa pun (lokal atau container dev):
scripts/verify-template-pdf.sh /tmp/daftar-hadir-murid.xlsx
scripts/verify-template-pdf.sh --dev /tmp/daftar-hadir-murid.xlsx
```

Yang diverifikasi: ukuran halaman (MediaBox/pdfinfo, F4 landscape
330,2×215,9mm ±2mm) dan jumlah halaman (kelas kecil 1, kelas besar ≥2).

## Jebakan yang sudah diketahui (jangan diulang)

- **Jangan `fitToHeight=1`** — memaksa satu halaman → skala 43–50%, teks
  tak terbaca. Fit kolom saja (`fitToHeight=0`); tinggi natural.
- **Margin & centering serahkan ke kit** — margin bawaan template WPS
  membuang tempat; tanpa `horizontalCentered` konten mepet kiri karena
  lebar kolom LO ≠ px exceljs.
- **Jangan hardcode `@page`** di modul — ukuran kertas hanya dari kit
  (`printAreaPx`/`pageCss` untuk jalur HTML browser, `applyPrintPageSetup`
  untuk xlsx→PDF).
- **Wrapper cetak browser jangan `display:inline-block`** — strut baseline
  membuat blank page ekstra saat margin sempit; pakai `display:block`.
- **Lebar kolom exceljs ≠ konversi LibreOffice** — jangan menghitung skala
  sendiri; fit-kolom otomatis menetralkan.
- **Jangan `row.getCell(c)` tanpa batas kolom nyata** — membuat sel hantu
  yang melebarkan render (insiden phantom columns 2026-10-08); selalu
  `min(ws.columnCount, batas)`.
- **Path privat jangan di-HEAD-probe** — endpoint `/api/files/*` hanya GET;
  HEAD 405 → fallback diam-diam ke template lama.

## Pagination & blok tanda tangan (print-kit)

- Tandai blok TTD di template dengan dua marker di sel mana pun:
  `{{ttd_mulai}}` (baris pertama blok) dan `{{ttd_selesai}}` (baris terakhir).
  Marker dikosongkan saat fill, tidak tampil di hasil.
- Modul yang punya tabel baris data memanggil `applyPagination` (lewat fill),
  dengan `dataStartRow`, `dataEndRow`, `keepRows`, dan posisi TTD.
- `keepRows` = jumlah baris data terakhir yang ikut pindah ke halaman TTD;
  `0` = otomatis (hanya blok TTD yang pindah bila tidak muat).
- Margin dan `keepRows` diatur per modul di pengaturan cetak; disimpan di
  tabel `print_settings` (endpoint `/api/print-settings/:module`).
