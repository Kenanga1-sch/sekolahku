# Fix Margin: seimbang + konten di tengah (10mm, disetujui user)

## Temuan (terukur read-only, `pdftotext -bbox`)

- LibreOffice (`final-prod.pdf`, 936×612): kiri **7.6mm**, kanan **43mm**
  (konten natural LO ≈279,5mm left-aligned → "mepet kiri"), atas 5.4mm,
  bawah 6.7mm.
- Chromium/dialog (`full3.pdf`): kiri 5.3 / kanan 5.2 / atas 5.7 / bawah 4.7mm
  — seimbang tapi tipis (5mm).
- `pageMargins filled3.xlsx = 0.2in semua` ✓ (sudah sesuai fill sebelumnya);
  `<pageSetUpPr fitToPage="1"/>` ✓; kolom roundtrip identik; font default
  Calibri (→Carlito). Penyebab asimetri LO = `horizontalCentered` mati +
  konversi lebar kolom LO lebih sempit dari formula px exceljs.
- exceljs mendukung `pageSetup.horizontalCentered` (print-options-xform) ✓.

## Perubahan (nilai: margin 10mm — user pilih "Eksekusi (10mm)")

1. `lib/presensi-excel.ts` — blok pageSetup fill:
   - `margins`: `0.2 → 0.4` inch (≈10mm) semua sisi (header/footer tetap 0.1);
   - tambah `horizontalCentered: true` → LO/Excel menengahkan → sisi ink LO
     ≈(330.2−279.5)/2 ≈ **25,4mm sama besar** kiri/kanan.
2. `lib/worksheet-print.ts`:
   - `pageCss`: `opts.marginMm ?? 5` → `?? 10`;
   - `printAreaPx`: `opts.marginMm ?? 5` → `?? 10` (fitWidthPx 1209→1171 utk F4).
3. `app/(dashboard)/presensi/_components/laporan-presensi-tab.tsx`:
   - `PrintPage` `pageCss({…, marginMm: 5})` → hilangkan argumen (ikut default 10).
4. Test:
   - `lib/presensi-excel.test.ts`: margins `0.2 → 0.4` + tambah
     `horizontalCentered === true`;
   - `lib/worksheet-print.test.ts`: printAreaPx A4 landscape
     `[1085,756] → [1047,717]`; F4 landscape `[1209,775] → [1171,737]`;
     (uji "margin memperkecil" & fitWidth dgn nilai eksplisit tetap berlaku).

## Verifikasi (fase eksekusi)

1. vitest penuh + eslint + tsc.
2. Regenerate artefak (template asli, 40 + 10 siswa):
   - LO di container prod → ukur bbox: sisi kiri≈kanan≈25mm, atas/bawah≈10mm,
     936×612; 40 siswa → 2 halaman; 10 siswa → 1 halaman;
   - Chromium → bbox: 10mm simetris semua sisi, 935×609; jumlah halaman sama.
3. Push `selfhost main` → pantau pipeline → prod sehat.
4. Verifikasi prod ulang (konversi LO + ukur bbox) → lapor angka ke user.

## Catatan

- Lebar tabel antar mesin masih beda (LO ~279mm centered vs Chromium ~310mm
  penuh) — dua-duanya simetris. Opaoni susulan bila user minta identik:
  margin-X Chromium 25mm atau lebar kolom font-aware.
- Margin vertikal multi-halaman: atas = margin, bawah = sisa (wajar).
