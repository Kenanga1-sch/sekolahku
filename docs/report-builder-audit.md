# [ARSIP — HISTORIS] Audit Modul Report Builder ("Studio Format Laporan")

> **Status 2026-10-16: Modul ini SUDAH DIBONGKAR (commit 3bd9f0b).**
> Editor grid, mesin lib, runner, dan katalog builder dihapus dari repo.
> Satu-satunya metode pembuatan laporan kini template file .xlsx/.docx
> (Admin → Format Laporan). Dokumen ini dipertahankan sebagai arsip keputusan,
> bukan panduan aktif.

Tanggal audit: 2026-10-01
Repo: `/home/chitchat/sekolahku`
Mode: **READ-ONLY** — tidak ada kode produksi/konfigurasi/migrasi yang diubah. Bug hanya dilaporkan, tidak diperbaiki.

## Daftar Isi

- [Ringkasan Eksekutif](#ringkasan-eksekutif)
- [A. Peta File](#a-peta-file)
- [B. Pipeline Alur](#b-pipeline-alur)
- [C. Temuan](#c-temuan)
  - [Tinggi](#--tinggi)
  - [Sedang](#--sedang)
  - [Rendah](#--rendah)
  - [Utang Teknis & TODO](#utang-teknis--todo)
- [D. Peta Test Coverage](#d-peta-test-coverage)
- [E. Verifikasi Read-Only](#e-verifikasi-read-only)

---

## Ringkasan Eksekutif

Modul Report Builder adalah editor grid ala Excel (schema v3, cell-based) dengan
pipeline: **editor grid → serialisasi JSON → simpan ke `report_templates.layout_json`**
(Go/SQLite) → **deserialisasi → engine evaluasi v3 → paginate → render PDF**
(`@react-pdf/renderer` di browser).

Tiga gejala pengguna ditelusuri sampai akar kode:

1. **Tidak dapat menyimpan format.** Akar masalah utama ada di **ui/produk layer
   (frontend)**, bukan di handler/repo Go: (a) ada **DILARANG 512 KiB** di handler
   (`maxLayoutJSONBytes`, `report_template_handler.go:19`) yang menolak payload
   besar dengan pesan error, **tetapi** (b) `handleSaveTemplate` di
   `page.tsx` **menelan detail pesan error** lewat `catch {}` dan pesan generik,
   sehingga pengguna melihat "Gagal menyimpan template ke server" tanpa tahu
   penyebabnya. Selain itu ada **ketidakselarasan field**: `module` bisa `undefined`
   pada workbook lama sehingga tersimpan default, dan `printScale`/`datasets`/
   `conditionals`/`shapes`/`images` **tidak divalidasi** di sisi server. Tidak
   ditemukan bukti kegagalan DB/migrasi — kolom dan migrasi 000066–000070 konsisten.
2. **PDF border berantakan.** Akar masalah nyata: **ketebalan border pecahan
   (sub-pixel)** — `USER_BORDER_WIDTH_PT = 0.75 * 0.75 = 0.5625pt`
   (`report-pdf.tsx:103`), dan saat pagination baris melewati batas halaman,
   `renderRow` per baris **tidak menghitung ulang/menyegarkan border sisi atas/bawah**
   sehingga garis horizontal hilang/tumpang tindih di antara halaman; ditambah
   kliping kolom (`visibleColumnCount`) memotong border kanan tabel secara asimetris.
3. **UI ribbon & variabel.** `ReportRibbon` menerima **44 prop** dan re-render
   setiap perubahan `wb`/`currentCell`, tanpa `React.memo`; katalog variabel
   didefinisikan **duplikat** antara `report-variables.ts` dan `FORMULA_TEMPLATES`
   - `generalVars` di `page.tsx`, dan penyisipan variabel lewat
     `onInsertCellValue` **menimpa** isi sel alih-alih menyisipkan pada kursor.

---

## A. Peta File

| File                                                                                                                                                                                                                         | ± Baris                       | Peran                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(dashboard)/admin/laporan-builder/page.tsx`                                                                                                                                                                             | ~870                          | Halaman Studio: state workbook, undo/redo, simpan/muat template, dialog (data, find/replace, sort/filter, conditional), orkestrasi ribbon + grid + preview PDF. |
| `components/report-builder/sheet-grid.tsx`                                                                                                                                                                                   | ~1.240                        | Grid editor interaktif ala Excel: seleksi, edit sel, merge/split, fill-handle, clipboard TSV, resize kolom/baris, shape/image layer.                            |
| `components/report-builder/report-ribbon.tsx`                                                                                                                                                                                | ~1.010                        | Ribbon tab (Home/Insert/Variabel/Formula/Page Layout/Data/View) berisi seluruh kontrol; katalog variabel & template rumus.                                      |
| `components/report-builder/report-pdf-preview.tsx`                                                                                                                                                                           | ~250                          | Pratinjau PDF klien (pdf.js) + fingerprint input; dialog fullscreen & zoom.                                                                                     |
| `lib/report-engine-v3.ts`                                                                                                                                                                                                    | ~880                          | Engine evaluasi schema v3: deteksi zona ulang, rumus (recursive descent), circular detection, migrasi v1/v2→v3, serialisasi/deserialisasi.                      |
| `lib/report-sheet-ops.ts`                                                                                                                                                                                                    | ~480                          | Operasi grid murni: conditional matching, patch sel, deret fill-handle, geser referensi rumus, insert/delete rows/cols, fill span merge, clipboard TSV.         |
| `lib/report-variables.ts`                                                                                                                                                                                                    | ~260                          | Katalog variabel per modul (row/rekap) sebagai sumber kebenaran UI & validasi.                                                                                  |
| `lib/report-pdf.tsx`                                                                                                                                                                                                         | ~420                          | Renderer PDF (`@react-pdf/renderer`): border/merge/rowSpan, skala cetak, kliping kolom, header berulang, shape/image, footer.                                   |
| `lib/report-paginate.ts`                                                                                                                                                                                                     | ~240                          | Sumber kebenaran tinggi baris & batas halaman (dipakai editor & PDF); `paperContentSizePt`, `rowHeightPt`, `computePageBreaks`.                                 |
| `lib/report-parser.ts`                                                                                                                                                                                                       | ~145                          | Parser nilai sel → token (TEXT/SCALAR/LIST/FORMULA), `resolvePath`, alamat A1 ↔ koordinat, `parseRange`.                                                        |
| `lib/report-template-runner.ts`                                                                                                                                                                                              | ~150                          | Runner server-side: ambil template per kode/modul, isi dataset, render PDF, unduh blob.                                                                         |
| `lib/report-fonts.ts`                                                                                                                                                                                                        | ~120                          | Pemetaan font browser↔PDF + registrasi font tambahan (Arial/Bookman/Liberation).                                                                                |
| `lib/config/report-sheet.ts`                                                                                                                                                                                                 | ~330                          | Model schema v3: `SheetCell`, `ReportSheet`, `ReportWorkbook`, konstanta px↔pt, helper lebar kolom & hidden.                                                    |
| `lib/config/report-document.ts`                                                                                                                                                                                              | ~200                          | Model schema v2 (pages/rows/blocks) + preset density + `migrateReportDocument` (dipakai jalur migrasi v3).                                                      |
| `go-backend/internal/handlers/report_template_handler.go`                                                                                                                                                                    | ~250                          | Handler CRUD template; validasi `layout_json` (JSON valid + batas 512 KiB).                                                                                     |
| `go-backend/internal/repository/report_template_repo.go`                                                                                                                                                                     | ~170                          | Repo SQL CRUD ke tabel `report_templates`.                                                                                                                      |
| `go-backend/internal/models/report_template.go`                                                                                                                                                                              | ~45                           | Struct `ReportTemplate` + request Create/Update.                                                                                                                |
| `go-backend/cmd/api/routes.go`                                                                                                                                                                                               | (bagian report, ~line 720)    | Registrasi rute `/api/reports/templates*` (GET auth, mutation admin).                                                                                           |
| `go-backend/internal/db/migrations/000066..000070_report_templates*.up/down.sql`                                                                                                                                             | ~40                           | Tabel + seed template + kolom `module`.                                                                                                                         |
| Test: `report-engine-v3.test.ts`, `report-sheet-ops.test.ts`, `report-paginate.test.ts`, `report-parser.test.ts`, `report-variables.test.ts`, `report-template-runner.test.ts`, `report-pdf.test.tsx`, `sheet-grid.test.tsx` | ~300+250+110+55+45+50+400+350 | Unit/komponen test (rinci di bagian D).                                                                                                                         |

---

## B. Pipeline Alur

### 1. Editor grid (UI)

1. `ReportBuilderPage` menyimpan `ReportWorkbook` di state (`page.tsx`, `useState<ReportWorkbook>`); tiap edit lewat `updateWb` (snapshot undo 800 ms) atau `updateSheet`.
2. `SheetGrid` (`sheet-grid.tsx`) memanggil `onChange(nextSheet)` → `page.tsx:updateSheet` → `updateCell`/`updateSelection`/`patchCells`.
3. `computePageBreaks(activeSheet, wb, {dataset, global})` (`page.tsx`) → `report-paginate.ts:computePageBreaks` untuk menggambar garis batas kertas; `evaluateSheet` dipakai ulang agar ekspansi zona ulang terhitung.

### 2. Simpan template

4. Tombol **Save** di ribbon (`report-ribbon.tsx`, `onClick={props.onSave}`, sekitar baris 300) → `page.tsx:handleSaveTemplate`.
5. `serializeWorkbook(wb)` (`report-engine-v3.ts`) → `JSON.stringify(wb)` → `payload.layoutJson`.
6. `goPost`/`goPut` (`lib/api-client.ts`) → `POST /api/reports/templates` atau `PUT /api/reports/templates/:id`.
7. Rute (`routes.go`, bagian "Report Templates"): `adminGroup.POST/PUT` → `ReportTemplateHandler.Create/Update` → `validateLayoutJSON` → `ReportTemplateRepository.Create/Update` → `INSERT/UPDATE report_templates ... layout_json`.

### 3. Muat template

8. `goGet("/api/reports/templates/:id")` → `GetByID` → JSON → `deserializeWorkbook(tpl.layoutJson)` (`report-engine-v3.ts`) → `applyTemplateMeta` (page.tsx).

### 4. Engine v3 → runner → paginate → PDF

9. `evaluateSheet(sheet, ctx)` (`report-engine-v3.ts`): `detectRepeatRows` → `planRowExpansion(sheet, dataset.length)` → `buildOccupiedInput` → evaluasi rumus (`evalFormula`, circular via `visit`) → `cellMap`/`occupied`/`inputRowByOutput`.
10. `renderSheet(...)` (`report-pdf.tsx`): `printedColWidthsPt` × `printScaleOf` → `visibleColumnCount` (kliping) → `renderRow` per baris output → `rowHeightPt` (`report-paginate.ts`) untuk tinggi — sumber kebenaran sama dengan editor.
11. `ReportPdfDocument` (`report-pdf.tsx`) → `generateReportPdf` (`@react-pdf/renderer` `.toBlob()`).
12. `report-pdf-preview.tsx` mengambil blob, render via `pdf.js` (`loadPdfJs` di `lib/letter-pdf-vendor`); fingerprint = JSON `{workbook, school, dataset, datasets, global}`.
13. Runner server-side: `renderTemplatePdf`/`renderModuleReport` (`report-template-runner.ts`) → `fetchTemplateByCode`/`fetchTemplateByModule` → `generateReportPdf` → `downloadBlob`.

---

## C. Temuan

### 🔴 TINGGI

#### T1. Gejala 1 — Simpan format gagal senyap (`catch {}` + pesan generik) menyembunyikan penyebab sebenarnya

- **Lokasi:** `app/(dashboard)/admin/laporan-builder/page.tsx`, `handleSaveTemplate` (blok `try/catch` terakhir: `} catch { toast.error("Gagal menyimpan template ke server"); }`); `report-ribbon.tsx` tombol Save (`onClick={props.onSave}`).
- **Bukti:**
  ```ts
  // page.tsx — handleSaveTemplate
  if (selectedTplId) {
    const res: any = await goPut(`/api/reports/templates/${selectedTplId}`, payload);
    if (res?.success) toast.success("Template laporan berhasil diperbarui!");
    else toast.error(res?.error || "Gagal memperbarui template");
  } else {
    const res: any = await goPost("/api/reports/templates", payload);
    ...
  }
  } catch {
    toast.error("Gagal menyimpan template ke server"); // <- detail hilang
  }
  ```
  Handler server membalas pesan konkret (`validateLayoutJSON`):
  ```go
  // report_template_handler.go
  const maxLayoutJSONBytes = 512 * 1024
  if len(trimmed) > maxLayoutJSONBytes { return "layoutJson terlalu besar", false }
  if !json.Valid([]byte(trimmed)) { return "layoutJson bukan JSON yang valid", false }
  ```
  Ketika `goFetch` menerima HTTP non-2xx, ia melempar `Error(errorData.error)` (`api-client.ts`, blok `if (!res.ok)`), sehingga pesan "layoutJson terlalu besar" **masuk ke `catch` dan dibuang**.
- **Mengapa penting:** Pengguna hanya melihat "Gagal menyimpan template ke server" tanpa alasan. Gejala "tidak dapat menyimpan format" paling sering adalah (a) template terlalu besar (>512 KiB — sangat mungkin: setiap sel menyimpan objek penuh, dan ribbon di `page.tsx` menambah 5 baris `extraRows` default), atau (b) `reportCode` duplikat (`code UNIQUE` di migrasi `000066`) yang dijawab `500 failed to create report template: ... UNIQUE constraint failed` — juga hilang.
- **Dampak:** Kegagalan bersifat "senyap"; pengguna mengira editor rusak, padahal pesan server sudah spesifik.
- **Rekomendasi konkret:** Ubah `catch {}` menjadi `catch (err) { toast.error(err instanceof Error ? err.message : "Gagal menyimpan template"); }`. Pertimbangkan menaikkan `maxLayoutJSONBytes` (mis. 2 MiB) atau mengompres `layoutJson`. Tangani duplikat `code` di repo/handler sebagai `409 Conflict` dengan pesan "Kode template sudah dipakai".

#### T2. Gejala 1 — Payload save tidak menyertakan/menormalisasi field kritis; `module` bisa hilang

- **Lokasi:** `page.tsx` `handleSaveTemplate` (objek `payload`) vs `ReportTemplateRepository.Create/Update` (`report_template_repo.go`) dan `models/report_template.go`.
- **Bukti:**
  ```ts
  // page.tsx
  const payload = {
    code: wb.reportCode,
    name: wb.reportName,
    category: wb.category || "Umum",
    module: wb.module || "umum",
    description: `Template format ${wb.reportName}`,
    paperSize: wb.paperSize,
    orientation: wb.orientation,
    layoutJson: serializeWorkbook(wb),
    isDefault: false, // <-- isDefault SELALU false
  };
  ```
  `Update` repo **tidak meng-update kolom `code`** (query `UPDATE ... SET name=?...` tanpa `code`), sehingga mengubah kode di ribbon lalu Save (mode update) **tidak tersimpan** — `wb.reportCode` di UI berbeda dari DB, dan template lama tak bisa ditemukan lewat kode baru.
- **Mengapa penting:** (a) `isDefault` selalu `false` → runner `fetchTemplateByModule` (`report-template-runner.ts`) tak pernah menemukan template default pilihan admin (jatuh ke `list[0]`). (b) Perubahan `code` tidak persisten → template "hilang" dari pencarian kode di modul lain.
- **Dampak:** Modul pemanggil (Inventaris/Tabungan) bisa memakai format yang bukan pilihan admin; identitas template tidak konsisten antara UI dan DB.
- **Rekomendasi konkret:** Kirim dan dukung `isDefault` di UI (toggle), atau dokumentasikan bahwa default diatur di halaman lain. Tambahkan `code = ?` pada `UPDATE` repo (dengan penanganan `UNIQUE`), atau nonaktifkan field `reportCode` saat mode update (`selectedTplId` diisi).

#### T3. Gejala 2 — Border PDF berantakan: ketebalan sub-pixel + border horizontal hilang saat pecah halaman

- **Lokasi:** `lib/report-pdf.tsx` — `USER_BORDER_WIDTH_PT` (≈ baris 100–104), `borderStyle`/`cellBorderStyle`, dan `renderRow` (per-baris output); interaksi dengan `report-paginate.ts:computePageBreaks`.
- **Bukti:**
  ```ts
  // report-pdf.tsx
  /** Ketebalan border user dalam pt. Grid merender 0.75px @96dpi = 0.5625pt */
  const USER_BORDER_WIDTH_PT = 0.75 * 0.75; // = 0.5625
  ```
  Border per-sisi (`cellBorderStyle`) menetapkan `borderTopWidth`/`borderBottomWidth` = 0.5625. Renderer PDF membulatkan ini ke device space; pada printer/zoom tertentu garis 0.5pt bisa hilang atau "bergetar". Lebih penting: `renderRow(r, ...)` merender **satu baris output per `<View>`** dan tidak ada logika yang menggambar ulang border sisi atas pada **baris pertama tiap halaman** atau sisi bawah pada **baris terakhir tiap halaman**. Karena `Page` menerapkan `paddingTop/Bottom` margin, border bawah baris terakhir halaman dan border atas baris pertama halaman berikutnya tetap seperti di desain (bukan ditegaskan sebagai garis tabel), sehingga tampak "hilang/tidak rata" di persimpangan halaman. Kliping kolom (`visibleColumnCount`, `report-sheet.ts`) memotong kolom overflow → border kanan tabel di baris overflow jadi tak menggantung konsisten.
- **Mengapa penting:** Keluhan "PDF border berantakan" paling cocok dengan kombinasi ketebalan pecahan (0.5625pt, bukan kelipatan rapi) dan batas halaman yang tidak menegaskan ulang garis tabel.
- **Dampak:** Hasil cetak tampak tidak rapi pada tabel panjang yang melewati beberapa halaman; garis tabel "terpotong".
- **Rekomendasi konkret:** Bulatkan `USER_BORDER_WIDTH_PT` ke 0.5 atau 1 pt. Di `computePageBreaks` simpan baris pertama/terakhir output tiap halaman, lalu di `renderSheet` tambahkan `borderTopWidth` pada baris pertama halaman >1 (dan/atau garis tabel eksplisit di batas halaman). Pertimbangkan menggambar border tabel sebagai grid terpisah daripada mengandalkan `<View>` per baris.

#### T4. Gejala 3 — Ribbon re-render penuh + penyisipan variabel menimpa isi sel (bukan insert di kursor)

- **Lokasi:** `components/report-builder/report-ribbon.tsx` (fungsi `ReportRibbon`, ~44 prop; tidak di-`memo`), `page.tsx` `onInsertCellValue={(value) => updateCell({ value })}`; badge variabel memanggil `props.onInsertCellValue(token)`.
- **Bukti:**
  ```tsx
  // report-ribbon.tsx — badge variabel
  <Badge ... onClick={() => props.onInsertCellValue(token)}>{f.label} · {token}</Badge>
  ```
  ```tsx
  // page.tsx
  onInsertCellValue={(value) => updateCell({ value })}
  ```
  `updateCell` menulis `{ ...existing, value }` → **menimpa** seluruh isi sel. Tidak ada kursor/append. Selain itu, `ReportRibbon` menerima `wb` penuh (berubah setiap ketikan) sehingga **seluruh pohon tab** (7 `TabsContent`, ratusan tombol) re-render tiap keystroke.
- **Mengapa penting:** Admin ingin menyisipkan `{{laporan.periode}}` ke dalam teks yang sudah ada (mis. "Dicetak pada {{laporan.periode}}") — perilaku saat ini menghapus isi. Performa ribbon membuat mengetik terasa berat pada grid besar.
- **Dampak:** UX penyisipan variabel membingungkan; editor lag pada dokumen besar.
- **Rekomendasi konkret:** `onInsertCellValue` harus _append_ ke nilai sel aktif (atau sisipkan pada posisi kursor via `SheetGridHandle`), bukan mengganti. Bungkus `ReportRibbon` dengan `React.memo` dan pisahkan props yang sering berubah (`currentCell`, `wb`) dari yang stabil, atau pecah per-tab menjadi komponen terpisah.

### 🟠 SEDANG

#### S1. Gejala 2 — Editor & PDF bisa memakai `printScale` yang berbeda pada perhitungan lebar

- **Lokasi:** `page.tsx` `printWidthRatio` (memakai `paperContentSizePt(wb).contentWidthPt` TANPA `printScale`), `report-pdf.tsx` `visibleColumnCount(sheet, contentWidthPt / pscale)`, `report-paginate.ts:computePageBreaks` (memakai `contentWidthPt` mentah untuk `wrapCtx`, tetapi `rowHeightPt(..., pscale)` untuk tinggi).
- **Bukti:**
  ```ts
  // page.tsx
  const contentPt = paperContentSizePt(wb).contentWidthPt;
  const totalPt = totalColWidthPx(activeSheet) * PX_TO_PT;
  return contentPt > 0 ? totalPt / contentPt : 1; // tidak membagi pscale
  ```
  ```ts
  // report-pdf.tsx
  const visibleColCount = visibleColumnCount(sheet, contentWidthPt / pscale);
  ```
- **Mengapa penting:** Indikator "% lebar cetak" di ribbon dan garis batas kertas di editor tidak konsisten dengan PDF ketika `printScale ≠ 1`. `wrapCtx` pada paginate memakai lebar tanpa skala, sementara PDF menghitung wrap pada lebar × skala → tinggi baris wrap bisa berbeda antara editor dan PDF.
- **Dampak:** Batas halaman di editor "meleset" dari hasil cetak saat admin memakai Fit 1 Page.
- **Rekomendasi:** Terapkan `printScale` konsisten: gunakan `contentWidthPt / pscale` pada `printWidthRatio` dan pada `wrapCtx` di `computePageBreaks`/`computeRowOffsets` agar identik dengan render PDF.

#### S2. Gejala 1 — Serialisasi `layoutJson` tanpa normalisasi/validasi bentuk sel di server

- **Lokasi:** `serializeWorkbook` (`report-engine-v3.ts`: `return JSON.stringify(wb)`), `validateLayoutJSON` (`report_template_handler.go`).
- **Bukti:** Server hanya memeriksa `json.Valid` dan panjang; tidak memeriksa `schemaVersion`, jumlah sheet, atau bentuk `cells`. `deserializeWorkbook` di klien memang memvalidasi ketat (`Sel sheet v3 tidak valid`), tetapi objek yang tersimpan bisa saja JSON valid namun tidak dapat dimuat kembali (mis. `colWidths.length !== cols`, `cells` berisi key di luar `cols`).
- **Mengapa penting:** Template bisa "tersimpan sukses" tetapi gagal dimuat → pengguna menganggap save rusak.
- **Dampak:** Menyimpan format yang nantinya tak bisa dibuka (template "rusak").
- **Rekomendasi:** Validasi bentuk minimal di handler: parse dan cek `schemaVersion === 3`, `Array.isArray(sheets)`, dan setiap `cells` key dalam batas `cols`. Atau serialisasi di klien dengan normalisasi (buang sel di luar batas) sebelum kirim.

#### S3. Gejala 3 — Duplikasi logika katalog variabel

- **Lokasi:** `lib/report-variables.ts` (`REPORT_VARIABLE_MODULES`) vs `page.tsx` (`generalVars`) vs `report-ribbon.tsx` (`FORMULA_TEMPLATES`, `listVars` dari `datasetKeys`).
- **Bukti:** `generalVars` di `page.tsx` mendefinisikan ulang variabel yang sudah ada di modul "umum" (`sekolah.schoolName`, `principal.nama`, dll). `FORMULA_TEMPLATES` di ribbon menyimpan daftar rumus yang juga harus sinkron dengan implementasi `callFunction` di `report-engine-v3.ts` (SUM/AVG/COUNT/MIN/MAX/IF/CONCAT/ROUND/UPPER/LOWER/TRIM/COUNTA) — engine mendukung lebih banyak fungsi daripada yang ditampilkan.
- **Mengapa penting:** Perubahan katalog variabel/fungsi harus diedit di beberapa tempat; mudah drift.
- **Dampak:** Variabel/fungsi yang ditawarkan UI bisa tak sinkron dengan yang didukung engine.
- **Rekomendasi:** Jadikan `report-variables.ts` sumber tunggal (termasuk `generalVars`), dan turunkan `FORMULA_TEMPLATES` dari daftar fungsi engine (ekspor daftar fungsi dari `report-engine-v3.ts`).

#### S4. Gejala 3 — `varModule` state tidak tersinkron dengan `wb.module`

- **Lokasi:** `report-ribbon.tsx` — `const [varModule, setVarModule] = useState<string>(activeModule);` lalu `activeModule = wb.module || props.module || "umum"`.
- **Bukti:** `useState(activeModule)` hanya menginisialisasi sekali; ketika template dimuat (`wb.module` berubah setelah pilih template), `varModule` **tidak ikut berubah** — daftar variabel tetap menampilkan modul lama.
- **Mengapa penting:** Setelah memuat template Inventaris, tab Variabel bisa masih menampilkan variabel Tabungan.
- **Dampak:** Admin menyisipkan variabel dari modul yang salah.
- **Rekomendasi:** Tambahkan `useEffect(() => setVarModule(activeModule), [activeModule])` atau ubah `varModule` menjadi derived state dengan override eksplisit.

#### S5. Border "box" diperlakukan sama dengan "all" (semantik hilang)

- **Lokasi:** `report-pdf.tsx:borderStyle` — komentar & kode: `if (border === "all" || border === "box") { ... borderTop/Bottom/Left/Right ... }`. Ribbon (`report-ribbon.tsx`) menyediakan pilihan `Box Border`, tetapi model sel tidak menyimpan konteks blok sehingga tiap sel yang di-set "box" akan mendapat border keempat sisi.
- **Bukti:** `// "all" dan "box" sama di tingkat sel: model sel tidak menyimpan konteks blok, jadi "box" ... diterapkan di ribbon sebagai border per-sisi.`
- **Mengapa penting:** Pengguna memilih "Box Border" berharap hanya sisi luar blok; hasilnya semua sel ber-border.
- **Dampak:** Ekspektasi vs hasil tidak sesuai → tampak seperti bug border.
- **Rekomendasi:** Terapkan "box" berdasarkan tetangga seleksi (hitung sisi luar blok saat apply di grid/ops), atau hapus opsi "box" dari UI sampai didukung.

### 🟡 RENDAH

#### R1. `ReportRibbon` prop `effectiveScale`/`zoom`/`pageBreakPlan` bikin render mahal

- **Lokasi:** `report-ribbon.tsx` (`pageBreakPlan.pageCount`, `rowsPerPage[0]`), `sheet-grid.tsx` (`scale`/`effectiveScale`).
- **Bukti:** `onScaleChange` dipanggil di `useEffect` grid dan diteruskan ke ribbon → setiap kali skala berubah, ribbon re-render.
- **Mengapa penting:** Performa pada dokumen besar. `Mengapa penting/mengapa` rendah karena belum terbukti lag di ukuran tipikal.
- **Dampak:** Minor.
- **Rekomendasi:** Turunkan nilai skalar (`effectiveScale`) via memo/selector, hindari mengirim objek `pageBreakPlan` yang berubah identitasnya.

#### R2. `FUTURE_TOOLTIP`/tombol "Soon" (Excel/Word/HTML) disabled permanen

- **Lokasi:** `report-ribbon.tsx` (`FUTURE_TOOLTIP`, tiga `Button disabled` di tab View → Export).
- **Bukti:** `const FUTURE_TOOLTIP = "Segera: ekspor ini sedang disiapkan.";`
- **Mengapa penting:** Fitur yang dijanjikan belum ada; membingungkan pengguna.
- **Dampak:** Kosmetik/ekspektasi.
- **Rekomendasi:** Sembunyikan atau beri roadmap; jangan biarkan tombol mati permanen tanpa dokumentasi.

#### R3. `getReportBlockDefinition` diimpor tapi tak dipakai di engine

- **Lokasi:** `report-engine-v3.ts` (impor `getReportBlockDefinition` dari `./config/report-blocks`, baris sekitar 30; dan `normalizedColWidths` re-export).
- **Bukti:** `import { getReportBlockDefinition } from "./config/report-blocks";` — tidak ada pemakaian di body yang terbaca (hanya `migrateReportBlock`-related dari `report-blocks`).
- **Mengapa penting:** Dead import menandakan sisa refactor.
- **Dampak:** Kecil (bundler tree-shaking).
- **Rekomendasi:** Hapus impor tak terpakai setelah verifikasi lint/tsc.

#### R4. `void nextFn;`, `void editorInputR;`, `void widthProps;`, `void direction;` — kode "matikan lint" yang menyembunyikan variabel tak terpakai

- **Lokasi:** `report-engine-v3.ts` (`void nextFn;`, `void editorInputR;`), `report-pdf.tsx` (`void widthProps;`), `report-sheet-ops.ts` (`void direction;`).
- **Bukti:** pola `void x;` tersebar.
- **Mengapa penting:** Menandakan parameter/logika yang tak selesai dipakai.
- **Dampak:** Kebersihan kode.
- **Rekomendasi:** Hapus variabel & parameter yang memang tidak dipakai.

### Utang Teknis & TODO

- **File raksasa:** `sheet-grid.tsx` (~1.240 baris) dan `report-ribbon.tsx` (~1.010 baris) melampaui batas sehat; keduanya memadukan banyak concern (interaksi grid, clipboard, shape layer, tab ribbon). Rekomendasi: pecah `sheet-grid` menjadi hook (`use-grid-selection`, `use-fill-handle`, `use-clipboard`) + `ShapeLayer` (sudah terpisah) dan pecah ribbon per-tab.
- **`any` berlebih:** `page.tsx` memakai `templateList: any[]`, `dataset: Record<string, any>[]`, `res: any`; `report-template-runner.ts` `applyTemplateRecord(tpl: any)`. Rekomendasi: tipe `ReportTemplateRecord`.
- **Error handling lemah / catch kosong:** `page.tsx` `useEffect` pemuatan daftar template (`catch { /* ignore */ }`), `fetchTemplateByCode`/`fetchTemplateByModule` (`catch { return null; }`) menelan error tanpa logging. Rekomendasi: log via `lib/logger` dan bedakan "tidak ada template" dari "server error".
- **Komentar `ponytail:`:** `report-pdf.tsx` menyimpan catatan keterbatasan header berulang ("Bila kop sangat panjang sehingga header jatuh ke halaman >1, salinan fixed dapat menghasilkan header ganda. Perbaikan penuh = menyisipkan baris header per halaman di report-paginate."). Ini **utang desain yang terdokumentasi** — belum diselesaikan.
- **Duplikasi rumus tinggi baris:** `DEFAULT_TYPO` didefinisikan ulang di `report-paginate.ts` dan `report-pdf.tsx` (dan `report-document.ts`). Rekomendasi: satu sumber di `report-document.ts`.
- **`printScale` hanya di render:** `printScaleOf` diterapkan ke geometri PDF tetapi tidak ke `evaluateSheet`/pagar editor secara konsisten (lihat S1).
- **Reorder rute berisiko:** `routes.go` (bagian report) mendaftarkan `auth.GET("/reports/templates/:id", ...)` lalu `auth.GET("/reports/templates/code/:code", ...)`. Echo membedakan berdasarkan jumlah segmen sehingga aman hari ini, namun berada di urutan yang membingungkan; disarankan tempatkan rute statis (`code/:code`, `module/:module`) sebelum `:id` untuk kejelasan.

---

## D. Peta Test Coverage

| File test                                       | Menguji apa                                                                                                                                                                                                                                                                                                                    | Fungsi/modul rentan BELUM dites                                                                                                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/report-builder/sheet-grid.test.tsx` | `browserFontFamily`; fokus grid setelah Enter; Delete shape; lebar absolut (bukan %); kolom 0px hidden; `deleteLastRow` (−1/klik, floor 1, hapus data terakhir); insert di dalam data (+1); merge vertikal/horizontal; split dari sel tertutup; tolak merge yang menimpa; pull-up baris tertutup; klik area tertutup → anchor. | `copySelection`/`cutSelection`/`pasteClipboard` (clipboard OS), fill-handle `applyFill` (semua arah), `patchSelected` gaya, resize drag, context menu aksi, `freezeCols/freezeRows`, `onPaintFormat`, rename sheet, `insertColumnAt`/`duplicateColumnAt`/`deleteColumnAt`, `toggleHideRowAt`. |
| `lib/report-engine-v3.test.ts`                  | deteksi zona ulang, `planRowExpansion`, evaluasi list/scalar/rumus (SUM/AVG/COUNT/IF short-circuit/CONCAT/ROUND/UPPER), `{no}`, field hilang ≠ nomor baris, multi-dataset, circular detection, `#DIV0!`, migrasi v1/v2→v3, normalisasi shapes/images, tolak schema 4.                                                          | `evalFormula` untuk MIN/MAX/LOWER/TRIM/COUNTA (tak diuji), operator `%`/`^`, `parseIf` dengan 2 arg, `listValueForRecord` untuk `{ns.field}` vs path lama secara ambigu, `detectRepeatRows` interaksi `rowSpan`.                                                                              |
| `lib/report-sheet-ops.test.ts`                  | `extrapolateSeries` (angka, teks berangka, hari/bulan), `splitNumericPattern`, TSV, `extractBlock`/`extractVisualStyle`/`rebaseBlockFormula`, `normalizeBounds`, `patchCells`, `adjustFormulaRefs` (relatif/absolut/literal/REF), insert/delete row/col, `matchConditional`, `conditionalStyleFor`, `fillSpans` (segala arah). | `shiftA1`, `insertColumns` untuk `rowHeights` (tidak ada), `fillSpans` dengan `colSpan` > `sheet.cols` di horizontal.                                                                                                                                                                         |
| `lib/report-paginate.test.ts`                   | `paperContentSizePt` (portrait/landscape), `rowHeightPt` (font, explicit, wrap, newline, font terbesar), `computePageBreaks` (1 halaman, multi-halaman, ekspansi zona ulang, header ulang), `computeRowOffsets`.                                                                                                               | Pengaruh `printScale` pada `rowHeightPt`/`contentWidthPt` wrap (lihat S1), pagination dengan `rowSpan` merge vertikal melintasi batas halaman.                                                                                                                                                |
| `lib/report-parser.test.ts`                     | Teks/EMPTY, scalar `{{a.b}}`, list `{x}`/`{x.y}`, formula `=`; `resolvePath`; `a1ToAddress`/`addressToA1`; `parseRange` (single, range, cross-sheet, invalid).                                                                                                                                                                 | `parseCellValue` dengan spasi/trim aneh, formula `=` panjang tunggal (edge `=x`).                                                                                                                                                                                                             |
| `lib/report-variables.test.ts`                  | Unik modul, fallback `umum`, `findModuleByLabel`, `tokensForModule`, `datasetNamesForModule`.                                                                                                                                                                                                                                  | Validasi token terhadap engine/runner, konsistensi `generalVars` di `page.tsx`.                                                                                                                                                                                                               |
| `lib/report-template-runner.test.ts`            | `fetchTemplateByModule` memilih `isDefault`, fallback `list[0]`, null bila kosong.                                                                                                                                                                                                                                             | `fetchTemplateByCode`, `renderTemplatePdf`/`renderModuleReport` (jalur `generateReportPdf` di-mock), `schoolToLetterData`, `downloadBlob`.                                                                                                                                                    |
| `lib/report-pdf.test.tsx`                       | Fingerprint preview; `pdfFontFamily`; render font tambahan; header berulang tidak menimpa kop di halaman 1; perataan merge center; tabel lebih sempit dari kertas; skala cetak 50%; kliping kolom overflow; geometri merge vertikal (Δy baris).                                                                                | **Border** (ketebalan/posisi) sama sekali tidak diuji — padahal ini Gejala 2. Juga belum ada test untuk pagination multi-halaman nyata pada PDF (baris terpotong), shape/gambar, `cellBorderStyle` per-sisi.                                                                                  |

**Rekomendasi test prioritas** (untuk diterapkan terpisah, bukan bagian audit ini): tambah test PDF yang memverifikasi ketebalan & posisi border (Gejala 2), test `handleSaveTemplate` dengan mock `goPost` menolak payload besar (Gejala 1), dan test performa/append variabel (Gejala 3).

---

## E. Verifikasi Read-Only

Perintah verifikasi yang diminta: `npx tsc --noEmit` dan
`npx vitest run lib/report-*.test.ts components/report-builder/*.test.tsx`.

**Status:** TIDAK DAPAT DIJALANKAN dalam sesi ini.

Alasan objektif:

- Environment agen audit ini **tidak menyediakan shell/terminal** — daftar tool yang
  tersedia hanya operasi file (baca/tulis/edit/search) dan tidak ada tool eksekusi
  perintah. Karena itu `npx tsc`/`npx vitest` tidak mungkin dijalankan tanpa menyalahi
  tool yang diizinkan (dan dilarang memanggil tool bash/terminal bila tidak ada).
- Tidak ada dependency baru yang diinstal dan tidak ada commit (sesuai instruksi).

**Analisis statis (sebagai ganti):**

- Test discovery: `vitest.config.ts` → `include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"]`. Pola `lib/report-*.test.ts` cocok dengan 6 file di `lib/` (`report-engine-v3`, `report-sheet-ops`, `report-paginate`, `report-parser`, `report-variables`, `report-template-runner`) dan `lib/report-pdf.test.tsx` cocok via `report-*.test.tsx`. Pola `components/report-builder/*.test.tsx` cocok dengan `sheet-grid.test.tsx`. **Total 8 file test** diharapkan terpanggil (jumlah tes: ±95 berdasarkan `it(...)` yang dibaca).
- `tsc`: `tsconfig.json` mengecualikan `**/*.test.ts(x)` (`exclude`), sehingga `tsc --noEmit` menguji kode aplikasi (termasuk `report-*.ts`, `report-pdf.tsx`, `sheet-grid.tsx`, `report-ribbon.tsx`) tetapi tidak file test. Risiko tipe yang teramati: `page.tsx` memakai `any` (aman), `report-pdf.tsx` `style: Style` dari `@react-pdf/types` (perlu `@react-pdf/types` tersedia — sudah ada sebagai dependency transitif `@react-pdf/renderer`).
- Catatan: klaim pass/fail aktual TIDAK diklaim; harus dijalankan di lingkungan ber-shell.

**Tindakan yang diperlukan di CI/lokal:**

```
npx tsc --noEmit
npx vitest run lib/report-*.test.ts components/report-builder/*.test.tsx
```

Hasil (pass/fail, jumlah tes, error utama) harus dilampirkan setelah dijalankan di
lingkungan yang memiliki terminal.

---

### Catatan Penutup

- Audit ini **tidak mengubah satu pun file produksi**; hanya menulis `docs/report-builder-audit.md`.
- Temuan T1, T2, T3, T4 adalah hipotesis akar masalah yang dibuktikan dengan lokasi
  `file:baris` + cuplikan kode; verifikasi empiris (menjalankan tsc/vitest & mereproduksi
  gejala di UI) masih diperlukan di lingkungan ber-shell.
