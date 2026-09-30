# Riset: Tata Letak (Layout) EditorStudio DocStation — Usulan Susunan Tiga Kolom

> **Status dokumen:** LAPORAN RISET / USULAN (read-only).
> **Tidak ada kode produksi yang diubah.** Seluruh isi di bawah adalah hasil pembacaan kode dan
> **usulan**; setiap "rencana implementasi" bersifat rekomendasi, bukan perubahan yang sudah
> dilakukan. Satu-satunya file yang ditulis pada task ini adalah laporan ini
> (`docs/docstation-research-layout.md`).

---

## 1. Ringkasan

Komponen `EditorStudio` (`app/(dashboard)/docstation/_components/editor-studio.tsx`) saat ini
menyusun seluruh UI editor sebagai **tumpukan vertikal** (`flex-col`): Toolbar di atas, indikator
sibuk, PageStrip, lalu CanvasOverlay, dan terakhir bilah aksi (footer) di bawah. Akibatnya pada
layar lebar sekalipun, kanvas pratinjau (bagian terpenting) hanya mendapat sebagian kecil tinggi
viewport yang tersisa setelah toolbar — yang sangat tinggi karena memuat tab grup alat
(Transform/Bersihkan/Ketajaman/Binarisasi/Penyesuaian/Anotasi/Multi) — dan strip thumbnail harus
digulir horizontal di antara toolbar dan kanvas.

Kebijakan pengguna sudah ditetapkan: susunan harus **KIRI = daftar scan (page-strip/thumbnail),
TENGAH = preview kanvas, KANAN = panel toolbar/kontrol edit**. Laporan ini memetakan kondisi
sekarang, mengusulkan struktur `grid` tiga kolom (`240px 1fr 320px`) berikut opsi resizable,
perilaku responsif `< md` (drawer/tab bawah), interaksi dengan keyboard crop dan zoom-scroll, serta
rencana implementasi terperinci dengan risiko/regresi yang harus diantisipasi. **Semua bersifat
usulan dan belum diterapkan.**

---

## 2. Temuan (dengan bukti `file:baris`)

### T2.1 Kontainer utama bertumpuk atas→bawah (`flex-col`), bukan grid

Bukti: `editor-studio.tsx:501`

```tsx
<div className="flex flex-1 flex-col gap-3">
```

Semua anak kontainer dirender berurutan sebagai blok vertikal: `<EditorToolbar />`,
indikator `doc.busy`, `<PageStrip />`, `<CanvasOverlay />`, dan bilah aksi. Tidak ada
`display: grid`/`grid-template-columns` di mana pun pada komponen ini. Tinggi total = jumlah tinggi
semua anak, sehingga kanvas hanya mendapat sisa ruang yang tidak proporsional.

### T2.2 Toolbar dan PageStrip berada di atas kanvas

Bukti: `editor-studio.tsx:502-562` — `<EditorToolbar {…} />` dirender lebih dulu (baris 502), lalu
blok sibuk (baris 564-573), lalu `<PageStrip {…} />` (baris 575-584), baru `<CanvasOverlay {…} />`
(baris 586-600). Jadi dua elemen "kontrol" (toolbar dan strip) memakan ruang atas sebelum kanvas
muncul.

Toolbar sendiri sangat tinggi: `EditorToolbar` membungkus `TabsList` + `TabsContent` dalam
`space-y-3` (`editor-toolbar.tsx:120`), ditambah baris aksi utama dengan tombol "Perbaiki Otomatis"
(`editor-toolbar.tsx:124-153`) dan 7 tab (`editor-toolbar.tsx:158-182`). Di desktop, ini adalah blok
terbesar di atas kanvas.

### T2.3 Kanvas di tengah tetapi berbagi ruang vertikal dengan elemen lain

Bukti: `canvas-overlay.tsx:344-350`

```tsx
className =
  "relative flex min-h-[420px] flex-1 items-start justify-center overflow-auto rounded-2xl border border-border bg-muted/30 p-3";
```

Kanvas memang punya `flex-1` dan `overflow-auto`, tetapi karena berada dalam kolom vertikal bersama
toolbar raksasa + strip, `flex-1` hanya membuatnya mengambil sisa tinggi yang sempit. `min-h-[420px]`
membuat tinggi minimum kaku sehingga ruang scroll internal kanvas (untuk zoom) dapat memaksa halaman
keseluruhan ikut menggulir bila viewport lebih pendek.

### T2.4 Footer/aksi di bawah kanvas

Bukti: `editor-studio.tsx:602-619` — bilah berisi jumlah halaman, tombol "Unduh PDF"
(`handleExportPdf`) dan "Lanjut Cetak" (`onProceed`) di `.flex flex-wrap items-center
justify-between`. Aksi ini juga bagian dari kolom vertikal, bukan panel kanan.

### T2.5 Bagaimana keyboard crop dipasang (fokus di kanvas overlay)

Bukti: `canvas-overlay.tsx:279-329` — `handleKeyDown` menangani `ArrowLeft/Right/Up/Down`,
`Shift+panah` (step 20), dan `Enter` untuk menerapkan crop. Sesuai desain, fokus harus berada pada
`<canvas>` overlay agar handler ini aktif.

Bukti pemasangan fokus: `canvas-overlay.tsx:399`

```tsx
tabIndex={cropMode && !busy ? 0 : -1}
```

Dan handler `onKeyDown={handleKeyDown}` pada `canvas-overlay.tsx:413`. Overlay juga memberi label
`role="application"` dan `aria-label` yang menjelaskan kontrol panah (`canvas-overlay.tsx:400-406`).
Artinya: overlay baru bisa menerima fokus keyboard bila `cropMode === true` dan tidak sibuk. Handler
ini dipasang **scope-local** (bukan `window`/`document`), jadi aman selama fokus tidak dipindah ke
elemen interaktif lain (lihat risiko T4.4).

### T2.6 Bagaimana zoom-scroll dipasang (kanvas punya overflow sendiri)

Bukti: `canvas-overlay.tsx:333-342` — ukuran tata letak gambar ikut zoom (`baseSize * displayScale *
zoom`), sehingga parent ber-`overflow-auto` membesar dan area scroll internal kanvas yang menangani
pan/scroll. Zoom diubah dari toolbar `onZoomChange` (`editor-toolbar.tsx:398-408`, tombol
ZoomIn/ZoomOut/Reset). Penghitungan `displayScale` mengikuti lebar container
(`canvas-overlay.tsx:107-116`), sehingga bila kolom kanvas (tengah) berubah lebar, `displayScale`
harus dihitung ulang — ini titik sensitif saat migrasi ke grid (lihat T4.2).

### T2.7 Bagaimana busy overlay dipasang

Ada dua mekanisme berbeda:

1. **Inline bar di EditorStudio** — `editor-studio.tsx:564-573`: `<div role="status" aria-live=
"polite">` dengan spinner + `doc.busyLabel`, dirender hanya bila `doc.busy`.
2. **Kunci interaksi kanvas** — `canvas-overlay.tsx:409` (`pointerEvents: busy ? "none" : …`) dan
   pada `handlePointerDown` ada guard `if (!page || busy) return;` (`canvas-overlay.tsx:180`), serta
   overlay `tabIndex` menjadi `-1` saat `busy` (`canvas-overlay.tsx:399`).
3. **Overlay modal lain** ada di orkestrator (`docstation-app.tsx:301-340`): `AlertDialog` untuk
   konfirmasi saat proses berjalan, dan `InlineProgress` (`inline-progress.tsx`) untuk progres scan.

Catatan: saat ini **tidak ada** `AlertDialog`/overlay busy khusus yang menutup area editor saat
`doc.busy`; indikatornya hanya bar inline. Ini relevan untuk usulan T3.6.

### T2.8 `SavePanel` dan `ScanConfigPanel` adalah panel halaman penuh terpisah

Bukti: `save-panel.tsx:255` (`<section className="mx-auto w-full max-w-xl space-y-6 py-4">`) dan
`scan-config-panel.tsx:46` (`<section className="mx-auto w-full max-w-2xl space-y-6 py-4">`).
Keduanya **bukan** bagian `EditorStudio` saat ini; `SavePanel` dirender pada langkah 4
(`docstation-app.tsx:262-274`), terpisah dari editor (langkah 3). Jadi usulan menaruh "kontrol edit +
aksi simpan" di kolom kanan perlu keputusan desain (lihat T3.3).

---

## 3. Opsi solusi + rekomendasi

> Semua di bawah adalah **usulan**.

### T3.1 Struktur grid tiga kolom (rekomendasi utama)

Ganti kontainer `flex flex-1 flex-col gap-3` (`editor-studio.tsx:501`) menjadi grid tiga kolom:

```
grid
  grid-template-columns: 240px 1fr 320px   (desktop ≥ lg)
  grid-template-rows: minmax(0, 1fr)       (tinggi penuh, kanvas yang scroll)
  gap: 0.75rem
  min-height: 0                            (WAJIB agar anak boleh scroll)
```

- **Kiri** = `PageStrip` (kolom thumbnail vertikal, `overflow-y: auto`).
- **Tengah** = `CanvasOverlay` (kanvas + area scroll internal; `overflow: auto`, `min-height: 0`).
- **Kanan** = panel kontrol: `EditorToolbar` (versi vertikal) + aksi simpan (`Unduh PDF` / `Lanjut
Cetak`).

Kunci agar tidak jebol: setiap sel grid butuh `min-width: 0; min-height: 0` (Tailwind `min-w-0
min-h-0`); tanpa itu, konten kanvas yang besar akan memaksa kolom membesar dan merusak grid.

### T3.2 Lebar kolom kiri/kanan + opsi resizable

- Default: **240px** (kiri, muat 1 thumbnail `w-20` + margin) dan **320px** (kanan, muat slider +
  tombol). Ini konsisten dengan `h-24 w-20` thumbnail (`page-strip.tsx:66`).
- Opsi resizable: gunakan `grid-template-columns` yang dikendalikan state (mis.
  `var(--left) 1fr var(--right)`), lalu pemisah drag (`react-resizable-panels` bila tersedia, atau
  handle `pointerdown` manual). Simpan lebar di `localStorage`. Batasi: kiri 160–360px, kanan
  280–440px.
- Opsi collapse: tombol lipat per panel; bila dilipat, kolom menjadi ~0 dan grid pakai
  `grid-template-columns: auto 1fr 0` (atau `display:none` pada sel).

### T3.3 Isi kolom kanan

Usulan tata letak kanan (vertikal, `overflow-y: auto`):

1. **Toolbar vertikal** — `EditorToolbar` diubah agar `TabsList` tersusun vertikal
   (mis. `flex-col` + ikon di kiri label) atau tetap tab horizontal tetapi `TabsContent` menjadi
   panel yang menggulir. Alternatif: accordion grup alat.
2. **Kontrol edit** — slider (kecerahan/kontras/gamma, kekuatan pembersihan/ketajaman) yang saat ini
   sudah ada di `TabsContent` (`editor-toolbar.tsx:293-370`).
3. **Aksi simpan** — pindahkan bilah footer (`editor-studio.tsx:602-619`) ke bawah kolom kanan
   sebagai panel "Aksi": jumlah halaman, tombol "Unduh PDF" dan "Lanjut Cetak".

Catatan keputusan: `SavePanel` (langkah 4) saat ini mereplikasi sebagian aksi. Opsi "kolom kanan
berisi aksi simpan" bisa berarti (a) hanya menampilkan tombol navigasi ke langkah simpan, atau
(b) menyatukan seluruh `SavePanel` ke kolom kanan sebagai drawer. Rekomendasi: **(a)** untuk MVP
(minim risiko), (b) sebagai iterasi lanjutan bila ingin editor+simpan satu layar.

### T3.4 Perilaku responsif `< md`

- `< md` (mobile/tablet kecil): grid runtuh menjadi **satu kolom** — kanvas penuh, lalu kontrol
  diakses lewat **tab bawah** (`Tabs` dengan nilai "Halaman | Alat | Aksi") atau **drawer**
  (`Sheet`), bukan grid tiga kolom.
- `PageStrip` pada mobile: tetap horizontal scroll seperti sekarang (`page-strip.tsx:47` sudah
  `overflow-x-auto`), dipindah ke tab "Halaman".
- Rekomendasi konkret: pakai kelas `hidden lg:grid` untuk grid desktop + blok `lg:hidden` berisi
  versi tab/drawer, agar tidak ada duplikasi state (state tetap di `EditorStudio`).

### T3.5 Interaksi dengan keyboard crop (fokus tetap di kanvas)

- Handler keyboard crop bersifat scope-local pada overlay (`canvas-overlay.tsx:413`). Migrasi grid
  **tidak boleh** memindahkan fokus otomatis ke panel kanan saat `cropMode` aktif.
- Setelah menekan tombol "Crop manual" di toolbar kanan (`editor-studio.tsx:507-511`), fokus saat
  itu ada di tombol toolbar. Usulan: **pindahkan fokus programatik ke overlay** (`overlay.focus()`)
  saat `cropMode` diaktifkan, mis. lewat `useImperativeHandle` tambahan (`focusCanvas()`), agar
  `ArrowLeft/Right/Up/Down` + `Enter` langsung bekerja tanpa klik kanvas dulu.
- Saat `cropMode` aktif, `tabIndex` overlay menjadi 0 (`canvas-overlay.tsx:399`) — pertahankan
  perilaku ini; panel kanan sebaiknya tidak mencuri fokus.

### T3.6 Zoom scroll (kanvas punya overflow sendiri)

- Kanvas tengah harus menjadi **satu-satunya** area scroll utama: `overflow: auto`, `min-height: 0`,
  dan `min-width: 0` pada `<CanvasOverlay>` dan parent-nya. Jangan biarkan halaman ikut menggulir.
- `displayScale` dihitung dari `clientWidth` container (`canvas-overlay.tsx:110-114`). Setelah
  kolom kanan bertambah lebar, container kanvas menyempit → `render()` perlu dipanggil ulang saat
  layout berubah. Ini sudah otomatis lewat `onResize` (`canvas-overlay.tsx:139-143`) untuk resize
  window, tetapi **tidak** untuk resize panel (drag resizable) — perlu `ResizeObserver` bila opsi
  resizable (T3.2) diambil.

### T3.7 Busy AlertDialog/overlay — portal di atas grid

- Rekomendasi: tambahkan overlay sibuk untuk operasi berat (auto-pipeline semua halaman, warp,
  deskew) sebagai `AlertDialog`/`Dialog` (sudah tersedia `@/components/ui/alert-dialog`, dipakai di
  `docstation-app.tsx:301`). Konten dialog di-render lewat **portal** ke `document.body`, sehingga
  `position: fixed` tidak terkurung oleh `overflow`/stacking context grid. Ini menghindari masalah
  "overlay tertutup kolom kanan" (lihat T4.5).
- Alternatif ringan: pertahankan bar inline `role="status"` (`editor-studio.tsx:564-573`) sebagai
  indikator non-blocking + kunci interaksi kanvas (`pointerEvents: none`) — sudah ada. Rekomendasi:
  gunakan dialog hanya untuk operasi panjang; bar inline untuk operasi cepat.

---

## 4. RENCANA IMPLEMENTASI terperinci

> **Usulan saja.** Belum ada file ini yang diubah.

### T4.1 `editor-studio.tsx` — struktur grid

- Ganti wrapper `editor-studio.tsx:501`:
  - Dari: `<div className="flex flex-1 flex-col gap-3">`
  - Menjadi grid desktop: `<div className="grid flex-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_320px] min-h-0">`
    (opsional resizable: `lg:grid-cols-[var(--col-left)_minmax(0,1fr)_var(--col-right)]`).
- Urutkan tiga sel:
  1. `<aside className="min-h-0 min-w-0 overflow-y-auto">{<PageStrip …/>}</aside>` (kiri).
  2. `<main className="min-h-0 min-w-0">{<CanvasOverlay …/>}</main>` (tengah).
  3. `<aside className="min-h-0 min-w-0 overflow-y-auto space-y-3">{<EditorToolbar …/> + aksi}</aside>` (kanan).
- Pindahkan bilah aksi (`editor-studio.tsx:602-619`) ke dalam `aside` kanan.
- Pertahankan blok `doc.busy` (`editor-studio.tsx:564-573`) tetapi render di dalam sel kanan atau
  tengah (usulan: tengah, tepat di atas kanvas agar dekat konteks).
- Tambahkan cabang responsif: bungkus grid dengan `hidden lg:grid`, dan buat blok `lg:hidden` berisi
  `<Tabs>` (Halaman/Alat/Aksi) atau `Sheet` drawer yang merender komponen yang sama. **Jangan
  duplikasi state** — state `cropMode`, `tool`, `zoom`, dsb. tetap tinggal di `EditorStudio`.
- Panggil ulang `ctx.render()` (atau biarkan prop `zoom`/ukuran memicu) saat breakpoint berubah;
  sebaiknya tambahkan `ResizeObserver` pada container kanvas (lihat T4.5).
- Risiko: prop yang ada sekarang (`onProceed`, `doc`, `cv`) tidak berubah, jadi orkestrator
  (`docstation-app.tsx:245-255`) tidak perlu diubah — **kecuali** bila `SavePanel` disatukan (T3.3b).

### T4.2 `editor-toolbar.tsx` — jadi kolom vertikal bila kecil

- Komponen saat ini membungkus `space-y-3 rounded-2xl border … p-3` (`editor-toolbar.tsx:120`).
  Pertahankan struktur luar, tetapi:
  - `TabsList` (`editor-toolbar.tsx:158`): di kolom kanan sempit, ganti `overflow-x-auto` menjadi
    susunan vertikal (`flex-col` + `w-full`) atau tetap horizontal dengan teks disembunyikan
    (hanya ikon) di lebar < 320px. Opsi: `sm:flex-col`.
  - `TabsContent` (`editor-toolbar.tsx:187+`): pastikan slider (`className="w-40"` di beberapa
    tempat) tetap muat; ganti lebar tetap jadi `w-full`/`flex-1` agar tidak overflow kolom.
  - Baris "Perbaiki Otomatis" (`editor-toolbar.tsx:124-153`): di kolom sempit, susun tombol jadi
    `flex-col` atau grid 2 kolom.
- Tidak ada perubahan pada handler/`props`; ini murni layout. Risiko rendah.

### T4.3 `page-strip.tsx` — jadi kolom kiri scrollable

- Saat ini `<ul>` horizontal: `flex items-center gap-2 overflow-x-auto` (`page-strip.tsx:46-48`).
  Usulan: tambahkan prop/varian agar bisa vertikal (`flex-col`), muat 1 thumbnail per baris, dan
  `overflow-y-auto` di dalam.
- Item thumbnail (`page-strip.tsx:55-67`) tetap `h-24 w-20`; kontrol aksi overlay
  (`page-strip.tsx:87-124`) tetap muncul saat hover/fokus.
- Untuk mobile, pertahankan varian horizontal (dipakai di blok `lg:hidden`).
- Rekomendasi: tambahkan prop `orientation?: "horizontal" | "vertical"` (default horizontal) agar
  tidak memecah pemakaian lain.

### T4.4 `save-panel.tsx` — bagian kolom kanan (opsi)

- Bila memilih opsi (a) T3.3: **tidak ada perubahan** pada `save-panel.tsx`; hanya tombol "Lanjut
  Cetak"/"Unduh PDF" di kolom kanan yang memanggil `onProceed`/`handleExportPdf`.
- Bila memilih opsi (b): refactor `save-panel.tsx:255` dari `mx-auto max-w-xl` menjadi panel lebar
  kolom kanan (`w-full`), dan render di dalam `aside` kanan. Ini lebih berisiko (form arsip panjang,
  lihat T2.8) — rekomendasi: jangan untuk MVP.

### T4.5 `canvas-overlay.tsx` — penyesuaian ukuran

- Pastikan root container (`canvas-overlay.tsx:344`) memakai `h-full min-h-0` di dalam sel grid
  tengah, bukan `min-h-[420px] flex-1` saja, agar scroll internal bekerja tanpa mendorong halaman.
- `displayScale` (`canvas-overlay.tsx:107-116`) harus dihitung ulang saat lebar kolom tengah
  berubah. Tambahkan `ResizeObserver` pada `containerRef` (saat ini hanya `window` `resize` di
  `canvas-overlay.tsx:139-143`) bila panel resizable dipakai.
- Pertahankan `pointerEvents: busy ? "none"` (`canvas-overlay.tsx:409`) dan `tabIndex` kondisional
  (`canvas-overlay.tsx:399`). Tambahkan handler `focusCanvas()` lewat `useImperativeHandle`
  (`canvas-overlay.tsx:146-160`) untuk fokus programatik (T3.5).
- Region crop disimpan sebagai koordinat kanvas sumber (`handleApplyCrop`, `editor-studio.tsx:436`)
  dan ditampilkan lewat persen di overlay (`canvas-overlay.tsx:417-427`) — migrasi grid tidak boleh
  mengubah basis perhitungan (lihat T4.7).

### T4.6 `scan-config-panel.tsx` / `inline-progress.tsx`

- Tidak wajib berubah. `inline-progress.tsx` dipakai pada alur scan (langkah 2) di luar editor;
  biarkan. Bila ingin busy overlay portal (T3.7), komponen baru (mis. dialog) dirender di
  `EditorStudio`, bukan di kedua file ini. **Tidak** membuat file baru tanpa persetujuan.

### T4.7 Risiko / regresi

1. **Crop presisi bergeser.** `cropRegion` dalam koordinat kanvas overlay (label di
   `editor-studio.tsx:431-435`, dikonversi di `canvas-overlay.tsx:163-172`) dan ditampilkan sebagai
   persen (`canvas-overlay.tsx:417-427`). Bila ukuran/`displayScale` kanvas berubah akibat lebarnya
   kolom, region harus dihitung ulang. Mitigasi: hitung ulang `baseSize`/`displayScale` di
   `render()` dan pastikan `toCanvasPoint` memakai `getBoundingClientRect()` (sudah, `canvas-overlay.tsx:165-166`).
2. **Scroll terpotong.** Tanpa `min-h-0`/`min-w-0` pada sel grid, `overflow-auto` kanvas tidak aktif
   dan halaman ikut menggulir. Mitigasi: set `min-h-0 min-w-0` pada semua sel (T4.1).
3. **Keyboard shortcut bocor.** `handleKeyDown` crop hanya aktif bila overlay fokus
   (`canvas-overlay.tsx:399,413`). Setelah tombol toolbar diklik, fokus pindah ke toolbar; panah
   tidak akan mengenai overlay. Mitigasi: `focus()` programatik saat `cropMode` aktif (T3.5). Jangan
   memasang handler crop di `window`/`document` (akan bocor ke tombol lain).
4. **Layout jebol di mobile.** Grid tiga kolom di layar kecil akan menyempitkan kanvas. Mitigasi:
   breakpoint `lg:`, dan mode tab/drawer di `< md` (T3.4).
5. **Busy overlay tertutup kolom.** Bila overlay busy dirender non-portal di dalam sel kanan yang
   punya `overflow: auto` + stacking context, `position: fixed` bisa terkurung. Mitigasi: render
   busy dialog lewat portal (`AlertDialog`/`Dialog`, seperti `docstation-app.tsx:301`).
6. **Slider/tombol overflow di kolom kanan.** Lebar tetap (`w-40`, `w-32`, `w-9`) di
   `editor-toolbar.tsx` bisa melampaui 320px bersama ikon/label. Mitigasi: `flex-1`/`min-w-0` pada
   slider dan label `truncate`.
7. **Duplikasi render untuk responsif.** Versi desktop + mobile yang dirender bersamaan bisa
   menimbulkan dua `<canvas>` berukuran besar dan boros memori. Mitigasi: render kondisional dengan
   satu sumber state, dan hindari mount dua `CanvasOverlay` sekaligus.

---

## 5. Penegasan

Seluruh bagian 3 dan 4 **hanya usulan/rekomendasi**. Tidak ada satu pun file produksi yang diubah
pada task ini. Perubahan yang benar-benar dilakukan pada task ini hanyalah **penulisan laporan ini**
(`docs/docstation-research-layout.md`). Setiap implementasi harus diuji ulang, khususnya presisi
crop, scroll kanvas, dan aksesibilitas keyboard crop, sebelum dianggap selesai.
