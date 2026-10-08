# Fix PDF Presensi — Chromium Busuk, LibreOffice Gagal/Sibuk, Dialog Cetak Busuk

## Status saat ini (belum ada perubahan kode)

- Zombie `soffice.bin` PID 167 di container prod **sudah dibunuh** (mitigasi darurat, disetujui user).
  Bukti kebocoran semaphore: request pertama `/api/presensi/pdf/libreoffice` (17:14) baru selesai
  **`500, latency 1j1m57d`** saat zombie dibunuh — handler menunggu pipe stdout selama 1 jam.
  Endpoint LO kini menerima request lagi, TAPI masih akan hang lagi sampai fix di-deploy.
- User menyetujui **eksekusi penuh** (repro, kill zombie, edit kode, deploy).

## Diagnosis (terbukti)

### A. LibreOffice — 2 bug berlapis

1. **Hang di container**: `soffice.bin` (anak dari wrapper `soffice`, PPid jadi 1 / orphan,
   `futex_wait_queue`, CPU 0:00 sejak start) menggantung sejak awal konversi pertama (17:14).
2. **Kebocoran handler permanen** (`go-backend/internal/handlers/pdf_handler.go`):
   - `execWithTimeout` memakai `exec.CommandContext` + `CombinedOutput()`:
     timeout 90s membunuh hanya proses **induk** wrapper → `soffice.bin` orphan tetap hidup
     dan **memegang pipe stdout/stderr** → `CombinedOutput`/`Wait` tidak pernah kembali
     → `defer cleanup()` + `defer <-h.sofficeSem` tidak pernah jalan → semaphore bocor selamanya.
   - Tidak ada logging error konversi ke server log (error hanya ke client; request pertama
     tak pernah muncul di log karena handler tak pernah selesai).
   - Gejala user: percobaan-1 toast "Konversi PDF gagal" (Cloudflare timeout, non-JSON),
     percobaan berikut **503 "Mesin PDF (libreoffice) sedang sibuk"** (log 18:03–18:04 ✓).
3. Penyebab `soffice.bin` futex-hang **belum diketahui** — perlu repro langsung di container.

### B. Chromium — frontend kirim HTML setengah jadi

- `handlePdfChromium` (laporan-presensi-tab.tsx:635) mengirim
  `joinPageSections(sections)` = **fragment mentah** `<div class="page-section"><table class="ws">…`
  tanpa `<!doctype>` dan tanpa `<style>` → chromium server merender:
  - `@page` tidak ada → kertas **Letter portrait** (bukan F4 landscape 330×215mm)
  - `BASE_CSS` tidak ada → `table-layout:fixed`/`border-collapse`/`td overflow:hidden`/font Arial hilang
  - `.page-section { break-after: always }` tidak ada → page-break antar kelas hilang
  - padatan fit-scale (wrapper `width:Wpx;height:Hpx`) → konten mengecil di pojok kiri atas
- Cocok 100% dengan ciri user: "orientasi salah (harusnya landscape), tidak terformat,
  tidak ada tabel, diperkecil hanya mengisi pojok kiri atas".
- Backend komentar (pdf_handler.go:150) mengira "HTML sudah berisi @page" — tidak pernah.
- Catatan: `unsafeHTML()` lolos untuk dokumen lengkap (tidak ada `<script`/`on*=`, sudah dicek).

### C. Dialog cetak — struktur benar, perlu verifikasi visual

- `openPrintWindow` sudah benar (pageCss F4 + BASE_CSS + fit-scale); font dari browser user.
- "diperkecil pojok kiri atas" pada dialog = fit-scale replikasi `fitToPage` Excel
  (naturalH isi 40+ siswa > 775px → scale ~0.65) — perlu dilihat hasil render dulu
  sebelum memutuskan perlu perbaikan atau memang perilaku Excel.

### D. Font container (memengaruhi Chromium + LibreOffice, bukan dialog)

- `fc-match Calibri → Open Sans` (metrik beda), `Bookman Old Style → Open Sans`.
- Template asli memakai: Arial Narrow (sudah di-alias ✓), **Calibri (perlu Carlito)**,
  Times New Roman (→ Liberation Serif ✓), Bookman Old Style (fallback eksplisit).
- File template juga punya `paperSize="149"` (kode WPS) — auto-detect kita tak mengenali 149
  → meta F4 dipertahankan (benar); `fillPresensiWorksheet` menimpa pageSetup jadi kode 14
  sebelum kirim ke LibreOffice ✓ — tidak perlu diubah.

## Perubahan kode

### 1. `lib/worksheet-print.ts` — export `buildPrintDocument`

```ts
export function buildPrintDocument(html, opts = {}, title = "Cetak"): string {
  return (
    `<!doctype html><html lang="id"><head><meta charset="utf-8">` +
    `<title>${escapeHtml(title)}</title>` +
    `<style>${pageCss(opts)}${BASE_CSS}</style></head><body>${html}</body></html>`
  );
}
```

- Refactor `openPrintWindow` memakai helper ini (tanpa perubahan perilaku).

### 2. `app/(dashboard)/presensi/_components/laporan-presensi-tab.tsx` — `handlePdfChromium`

- Ambil `opts` dari `buildPrintDocs()` (sudah ada) + `title`.
- Ganti body kiriman:
  `html: printLib.buildPrintDocument(printLib.joinPageSections(sections), opts, title)`
  (bukan fragment mentah).

### 3. `go-backend/internal/handlers/pdf_handler.go` — perbaiki `execWithTimeout`

- `cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}` → timeout mematikan
  **seluruh process group** (`syscall.Kill(-pgid, SIGKILL)` via `cmd.Cancel` custom /
  context.AfterFunc), sehingga `soffice.bin` orphan ikut mati (tak ada zombie pemegang pipe).
- Set `cmd.WaitDelay = 5 * time.Second` (Go ≥1.20): bila proses keluar tapi pipe belum
  tutup, `Wait`/`CombinedOutput` dipaksa kembali → **semaphore tidak mungkin bocor lagi**.
- Logging error konversi ke server: `c.Logger().Errorf(...)` / log standar untuk
  "chromium/libreoffice gagal: <err>" (sekarang hilang tak berjejak).
- Pertahankan timeout 90s; pastikan `-env:UserInstallation` tetap di args.
- Cek `go.mod` Go version ≥1.20 untuk `WaitDelay` (kemungkinan besar ya).

### 4. `Dockerfile` — font

- Tambah paket: `font-carlito` (+ `font-caladea` bila tersedia di repo).
- Tambah file fontconfig `99-font-aliases.conf`:
  - `<alias><family>Calibri</family><prefer><family>Carlito</family></prefer></alias>`
  - `<alias><family>Bookman Old Style</family><prefer><family>Liberation Serif</family></prefer></alias>`
  - `<alias><family>Segoe UI</family>…` (opsional, jika dipakai template lain)
- `fc-cache -f` tetap di layer yang sama.

### 5. Test

- **TS**: `lib/worksheet-print.test.ts` — `buildPrintDocument` mengandung
  `<!doctype`, `@page { size: 330mm 215mm` (F4 landscape), `table.ws`, `page-section`.
- **Go**: test `execWithTimeout` dengan stub yang sengaja membocorkan pipe
  (anak proses memegang stdout setelah induk keluar) → pastikan kembali dalam
  `timeout+WaitDelay` dan tidak menggantung (regresi terhadap bug kebocoran).
- Existing tests tetap lulus.

## Reproduksi & bukti (sebelum/sesudah fix)

### R1 — Chromium (bukti bug + bukti fix)

1. Artefak via test vitest sementara (hapus setelah pakai) `lib/_repro-generate.test.ts`
   yang membaca `/tmp/daftar-hadir-murid.xlsx` (md5 = file prod `40--5-1791377701.xlsx` ✓)
   → `fillPresensiWorksheet` 40 siswa, oktober 2026, F4 landscape → tulis ke
   `/tmp/opencode/repro/`:
   - `frag.html` = `joinPageSections` **tanpa** wrapper (persis payload lama)
   - `full.html` = `buildPrintDocument(...)` (payload baru)
   - `filled.xlsx` = buffer hasil fill (untuk R2)
2. `chromium --headless --print-to-pdf` keduanya → `pdfinfo`:
   - frag: **612×792 pts (Letter portrait)** + pdftotext/PNG = berantakan
   - full: **935×609 pts (F4 landscape)** + PNG rapi
3. `pdftoppm -png -r 60` → lihat visual keduanya (Read file PNG).

### R2 — LibreOffice di container (cari penyebab hang)

1. `podman cp /tmp/opencode/repro/filled.xlsx sekolahku-prod:/tmp/filled.xlsx`
2. Jalankan dengan argumen + env **persis seperti handler** (HOME=/tmp/lo-test dst.),
   `timeout 90`, amati: selesai / hang. Buktikan juga peran kill-induk:
   uji versi dengan `sh -c '… & wait'` yang tak membunuh anak saat timeout.
3. Bila masih hang: loop varian env sampai sukses —
   `SAL_USE_VCLPLUGIN=svp`, `LANG=C.UTF-8 LC_ALL=C.UTF-8`, `--nologo --nofirststartwizard`,
   `SAL_DISABLE_JAVA=1` / `JAVA_HOME` kosong, dsb. Catat varian yang berhasil ke handler.
4. Verifikasi hasil PDF-nya: ukuran halaman = F4 landscape (936×612 pts), 1 halaman,
   teks lengkap.

### R3 — Dialog cetak (evaluasi visual)

- Render `full.html` (sama dengan isi jendela dialog) via chromium → PNG → nilai
  apakah "diperkecil pojok kiri atas" / "kop aneh" muncul juga; putuskan perbaikan
  hanya bila ada bug nyata (jangan ubah skala fit-to-page tanpa bukti).

## Urutan eksekusi

1. ✅ Kill zombie PID 167 (selesai) — bukti di log.
2. Repro R1 (frag vs full) — bukti Letter vs F4.
3. Repro R2 — temukan penyebab hang + varian env yang berhasil.
4. Edit kode: worksheet-print.ts → frontend → pdf_handler.go → Dockerfile.
5. Test unit baru + regresi (vitest penuh, go test penuh, eslint, tsc).
6. Push `selfhost main` (`setsid nohup git push selfhost main &`), pantau cicd.log
   sampai `DEPLOY [prod] BERHASIL` + `SEMUA SEHAT`.
7. Verifikasi prod:
   - POST chromium (perlu sesi admin) atau uji lewat UI → PDF 330×215mm & rapi;
     minimal: bukti internal R1 + pastikan route 401 tanpa sesi.
   - POST libreoffice → sukses <90s, tidak ada lagi 503 "sedang sibuk",
     tidak ada proses soffice yatim (`ps -ef | grep soffice` bersih setelah konversi),
     error (bila ada) muncul di `podman logs`.
   - Dialog cetak: minta user memverifikasi tampilan.
8. Laporkan hasil ke user.

## Risiko / catatan

- `WaitDelay` butuh Go ≥1.20 (cek go.mod).
- Perubahan `Setpgid` aman di container rootless (kill -pgid milik sendiri).
- Container PID1 (binary Go) tidak me-reap orphan — fix pgid+membunuh grup mencegah
  zombie baru; zombie lama (defunct 167) tidak memegang FD apa pun dan akan hilang
  saat redeploy.
- Jangan sentuh record template prod (meta F4/landscape sudah benar).
