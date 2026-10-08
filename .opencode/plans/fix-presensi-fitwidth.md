# Fix Pagination Cetak: ganti "fit 1 halaman" → "fit kolom saja"

## Temuan (sudah diverifikasi read-only)

1. **Yang memaksa bukan LibreOffice — kode kita.** `fillPresensiWorksheet`
   (lib/presensi-excel.ts:442-448) menulis `fitToPage:true, fitToWidth:1,
fitToHeight:1` ke file hasil fill → Excel & LibreOffice membacanya sebagai
   "Fit to 1×1 page". Template ASLI tidak punya fit (sheetPr kosong, pageSetup
   hanya paperSize=149 + orientation=landscape) → perilaku native Excel = 100%.
2. **Margin template ikut mengalir** lewat spread `...(wsPS.pageSetup||{})`:
   `pageMargins left/right=0.75in (19mm), top/bottom=1in (25.4mm)` — default
   WPS, bukan desain sadar. Akibatnya area cetak LO cuma 292×165mm →
   `fitToHeight=1` memaksa skala ≈ **0.50** di LO (lebih kecil dari jalur HTML
   yang pakai margin 5mm → 0.6185). Tiga mesin pakai margin berbeda.
3. Angka natural (isian 40 siswa): konten ≈322×331mm; dgn margin 5mm area cetak
   F4 landscape = 320×205mm → tanpa fit kolom, kolom terpotong; dengan
   `fitToWidth=1, fitToHeight=0` → skala **≈99.3%** (nyaris 100%), baris/kelas
   ≈26 siswa per halaman → kelas 40 = **2 halaman F4**, kelas ≤25 = 1 halaman.
4. exceljs mendukung `printTitlesRow`, tapi user memilih **tanpa** ulang kop.

## Keputusan user

- "Jika perlu penyesuaian → **fit kolom saja**" (fitToWidth=1, fitToHeight=0).
- Tanpa pengulangan baris kop di halaman lanjutan.

## Perubahan

### 1. `lib/presensi-excel.ts` — blok pageSetup (± baris 438-449)

```ts
wsPS.pageSetup = {
  ...(wsPS.pageSetup || {}),
  paperSize: paperCode,
  orientation: <sama seperti sekarang>,
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,      // ← HAPUS paksaan 1 halaman; tinggi natural (multi-halaman)
  margins: {           // ← samakan dgn jalur HTML (5mm); margin WPS 19/25.4mm
    top: 0.2, right: 0.2, bottom: 0.2, left: 0.2,  // satuan exceljs = INCH
    header: 0.1, footer: 0.1,
  },                   //   memaksa skala ~0.50 & membuang tempat
};
```

Catatan: margin 5mm = konsisten dengan `pageCss(marginMm:5)` Chromium/dialog →
ketiga mesin identik; tanpa ini "fit kolom" di LO tetap skala ~0.91 + halaman
lebih banyak. (Kalau user ternyata ingin margin template dipertahankan, tinggal
hapus blok `margins`.)

### 2. `lib/worksheet-print.ts` — ganti mekanisme fit di HTML

- Ganti opsi render `fitPagePx?: [w,h]` (satu-halaman, transform:scale) dengan
  `fitWidthPx?: number`:
  - `scale = min(1, fitWidthPx / naturalW)`;
  - **lebar kolom colgroup dikalikan scale** (bulatkan, koreksi kolom terakhir
    agar jumlah = fitWidthPx) → naturalW pas selebar area cetak;
  - **tanpa wrapper transform** → tabel mengalir natural & bisa pecah halaman
    di browser/Chromium (transform+overflow:hidden hanya menggambar di hal.1);
  - tinggi tak diklamp → mengalir ke halaman 2+; `.page-section` tetap memisah
    kelas; `td{overflow:hidden}` BASE_CSS menjaga sel tetap rapi bila teks
    melebihi kolom pada skala <1.
- `worksheetToHtml` pakai opsi baru; hapus cabang fit-to-page lama.
- `printAreaPx` tetap (dipakai utk lebar &tinggi PrintPage).

### 3. `app/(dashboard)/presensi/_components/laporan-presensi-tab.tsx`

- `buildPrintDocs`: `fitPagePx: printLib.printAreaPx(...)` →
  `fitWidthPx: printLib.printAreaPx(...)[0]` (hanya lebar).
- (Export Excel & PrintPage tidak diubah — sudah mengikuti keputusan lewat fill.)

### 4. Test

- `lib/presensi-excel.test.ts:281-283`: `fitToHeight` → `0`; tambah assert
  `margins.left === 0.2`.
- `lib/worksheet-print.test.ts` "fit-to-page (replikasi fitToPage Excel)":
  tulis ulang jadi "fit-width": kolom dikalikan (width:1209px utk kasus uji),
  **tidak ada** `transform:scale`, lebar akhir = fitWidthPx, content tinggi
  bebas. Uji juga kasus naturalW < fitWidthPx → tanpa penskalaan.
- Uji e2e (`_e2e-template.test.ts`) memakai paperSize A4 — pastikan tetap lulus.

## Verifikasi (fase eksekusi)

1. Unit: vitest penuh + eslint + tsc + go test (tidak ada perubahan Go).
2. Repro lokal (template asli, 40 siswa):
   - fill → `filled3.xlsx` → **soffice di container prod** → pdfinfo:
     **2 halaman 936×612 pts**, teks ~100% (bandingkan pdftotext vs sebelumnya),
     kolom `%` utuh, hal.2 lanjutan baris siswa tanpa kop;
   - `full3.html` (fitWidth) → chromium → pdfinfo **2 halaman 935×609 pts**,
     colgroup sum = 1209px, TANPA `transform:scale`,
     `pdfimages` ≥2 gambar per kelas (logo+TTD ada — yang di halaman 2 wajib
     muncul; bila abs-pos gambar terpotong di halaman lanjutan → fallback:
     render `<img>` sebagai elemen aliran berbasis baris, catat di sini);
   - kelas kecil (10 siswa) → 1 halaman (uji singkat).
3. Push `selfhost main` → pantau pipeline → `DEPLOY [prod] BERHASIL` + sehat.
4. Verifikasi prod: konversi LO via container (argumen handler) → 2 halaman;
   minta user cek UI (menu Cetak → ketiga jalur).

## Risiko / catatan

- Tabel multi-halaman: baris `rowspan` merge (mis. Jumlah/TTD) yang terbelah
  batas halaman — browser menampilkan `jrowspan` di dua halaman; perlu dicek
  visual, bila mengganggu → beri `page-break-inside:avoid` pada baris (sudah
  default utk `tr` di Chromium).
- Gambar absolut (logo/TTD) di halaman lanjutan — diverifikasi via `pdfimages`.
- Export Excel berubah perilaku (fit width multi-halaman) = sesuai keinginan.
- PrintPage (fallback Ctrl+P) TIDAK diubah (masih 1 halaman per kelas dengan
  font adaptif) — hanya fallback bila template tak ada.
