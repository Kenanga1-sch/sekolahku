# Audit Kematangan UI Cloud Storage (Next.js) & API Client

**Tanggal audit:** 2026-09-29
**Mode:** read-only. Tidak ada kode produksi yang diubah.
**Cakupan berkas:**

- `app/(dashboard)/cloud-storage/page.tsx`
- `app/(dashboard)/cloud-storage/_components/cloud-storage-app.tsx`
- `app/(dashboard)/cloud-storage/_components/file-preview-dialog.tsx`
- `app/(dashboard)/cloud-storage/_components/folder-picker-dialog.tsx`
- `app/(dashboard)/cloud-storage/_components/text-editor-dialog.tsx`
- `app/(dashboard)/cloud-storage/_components/use-rubber-band.ts`
- `lib/cloudstorage/api.ts`

**Aspek yang dinilai:** state management, error/loading, aksesibilitas, validasi upload,
penanganan tipe berkas, dan kualitas API client (error handling, retry, timeout, tipe).

---

## 1. Ringkasan Eksekutif

UI cloud storage cukup matang secara fitur (navigasi folder, breadcrumb, pencarian, sortir/filter,
trash, share, drag & drop, rubber-band selection, editor teks, pemilih folder). Namun kematangannya
tidak merata: lapisan presentasi solid, sementara lapisan ketahanan (resiliensi jaringan,
aksesibilitas, validasi) masih pada tingkat prototipe.

Temuan paling menonjol:

1. `lib/cloudstorage/api.ts` tidak memiliki retry, tidak memiliki timeout, dan tidak memiliki tipe
   error domain. Setiap kegagalan jaringan/timeout memunculkan `TypeError` mentah ke `toast`, dan
   tidak ada pembatalan (AbortController) kecuali pada `uploadFileWithProgress`.
2. Tidak ada validasi upload sisi klien (ukuran terhadap `max_upload_size`, ekstensi/tipe) meskipun
   konfigurasi `max_upload_size` sudah tersedia di `config`.
3. Aksesibilitas lemah: tombol-tombol ikon tanpa `aria-label`, layout grid/list tidak memakai
   semantik list/grid, tidak ada navigasi keyboard untuk seleksi.
4. Race condition state: `loadFiles`/`loadTrash` yang berjalan lambat dapat menimpa hasil pencarian
   atau view yang lebih baru; tidak ada pembatalan berbasis request.
5. Penanganan error tidak konsisten: sebagian menelan error tanpa jejak (`catch {}`), sebagian
   menampilkan pesan backend apa adanya, dan tidak ada pembedaan 401/403/4xx/5xx.

Skor kematangan kasar per area:

| Area                                  | Status          | Catatan singkat                                                            |
| ------------------------------------- | --------------- | -------------------------------------------------------------------------- |
| State management                      | Sedang          | Banyak `useState` tersebar; tanpa reducer/context; rawan race antar effect |
| Error handling                        | Perlu perbaikan | Sebagian `catch {}` menelan error; pesan mentah; tanpa tipe error domain   |
| Loading state                         | Sedang          | Ada skeleton & spinner, tetapi beberapa aksi pakai satu `busy` tunggal     |
| Aksesibilitas                         | Rendah          | Tombol ikon tanpa label; seleksi hanya mouse                               |
| Validasi upload                       | Rendah          | Tidak ada cek ukuran/tipe di klien; `max_upload_size` tidak dipakai        |
| Penanganan tipe berkas                | Sedang          | `fileKind` berbasis MIME dasar; edge case (SVG, HEIC) tidak tertangani     |
| API client (error/retry/timeout/tipe) | Rendah          | Tanpa retry, tanpa timeout, tanpa tipe `CloudApiError`                     |

---

## 2. Temuan Bertingkat

Legenda: **KRITIS** (kebenaran/kehilangan data), **TINGGI** (keandalan/keamanan/UX kritis),
**SEDANG** (perawatan/performa), **RENDAH** (kebersihan).

---

### KRITIS

#### K-1. API client tanpa timeout - request dapat menggantung tanpa batas

Seluruh pemanggilan `fetch` di `lib/cloudstorage/api.ts` tidak diberi `signal` maupun pembungkus
timeout. `fetch` browser tidak memiliki timeout default, sehingga operasi yang lambat (backend
sibuk atau koneksi putus di tengah) akan menggantung selamanya. Karena banyak aksi UI men-set
`busy`/`loading` dan baru melepasnya di `finally`, UI bisa terkunci permanen.

Bukti:

- `lib/cloudstorage/api.ts:92` - `fetchConfig` tanpa `signal`.
- `lib/cloudstorage/api.ts:100` - `fetchUsage` tanpa `signal`.
- `lib/cloudstorage/api.ts:106` - `listFiles` tanpa `signal`.
- `lib/cloudstorage/api.ts:117-118` - `listFiles2` tanpa `signal`.
- `lib/cloudstorage/api.ts:243` - `downloadZip` (fetch + blob) tanpa `signal`.
- Hotspot UI: `cloud-storage-app.tsx:206-224` (`loadFiles`) membungkus dengan `try/finally`
  `setLoading(false)`; bila `fetch` menggantung, `finally` tidak pernah dijalankan.

Rekomendasi:

- Tambahkan helper `withTimeout`/`fetchJSON` terpusat yang menyertakan `AbortSignal.timeout(ms)`
  (atau `AbortController` manual), dan gabungkan dengan `signal` pemanggil.
- Klasifikasikan `AbortError` sebagai error khusus ("Waktu permintaan habis").

#### K-2. Tidak ada retry untuk operasi idempoten - kegagalan sementara langsung gagal

Tidak ada satu pun strategi retry/backoff di client. `listFiles`, `listFiles2`, `fetchUsage`,
`fetchConfig`, `fetchTextContent`, `listTrash`, `searchFiles`, `fetchSharedInfo` (semua GET
idempoten) langsung melempar error pada kegagalan jaringan pertama. UI terasa rapuh pada koneksi
seluler/flaky.

Bukti:

- `lib/cloudstorage/api.ts:106-111` - `listFiles` sekali coba.
- `lib/cloudstorage/api.ts:117-126` - `listFiles2` sekali coba.
- `lib/cloudstorage/api.ts:145` - `fetchTextContent` sekali coba.
- Konsumsi UI tanpa retry: `cloud-storage-app.tsx:208-223`, `cloud-storage-app.tsx:227-236`.

Rekomendasi:

- Buat helper `request<T>` dengan opsi `retries` (default 0 untuk mutasi, 2-3 untuk GET idempoten),
  backoff eksponensial + jitter, hanya retry pada `TypeError` jaringan / 5xx / 429.
- Hormati `Retry-After` untuk 429 bila backend mengirimnya.

#### K-3. `parseError` dapat melempar `TypeError` yang membingungkan (bukan error domain)

`parseError` memanggil `await res.json().catch(() => null)` lalu menyusun `new Error(...)`. Bila
respons bukan JSON (mis. HTML halaman error proxy/502), `data` menjadi `null` dan pesan fallback
dipakai - OK. Namun bila jaringan gagal sebelum respons (`fetch` reject), pemanggil menerima
`TypeError: Failed to fetch` mentah, bukan error bertipe yang dapat dibedakan UI.

Bukti:

- `lib/cloudstorage/api.ts:70-75` - `parseError` hanya menangani jalur "respons diterima".
- `lib/cloudstorage/api.ts:93` - `await fetch(...)` di `fetchConfig`; reject jaringan tidak dibungkus.
- UI menampilkan `e instanceof Error ? e.message : "..."` (mis. `cloud-storage-app.tsx:218`).

Rekomendasi:

- Definisikan kelas `CloudApiError extends Error` dengan `status?: number`, `code?: string`,
  `kind: "network" | "timeout" | "http" | "parse"`.
- Bungkus setiap `fetch` dengan `try/catch` yang memetakan `TypeError`/`AbortError` ke `CloudApiError`.
- Ganti pengecekan `e instanceof Error` di UI dengan helper `messageForError(e)` yang memetakan
  `kind` ke pesan bahasa Indonesia.

#### K-4. Upload tanpa `AbortController` nyata di UI - unggahan tak dapat dibatalkan

`uploadFileWithProgress` menerima `signal` opsional, tetapi UI tidak pernah membuat atau meneruskan
`AbortSignal`, sehingga tidak ada cara membatalkan unggahan yang macet/berjalan lama. Lebih jauh,
`signal.addEventListener("abort", ...)` dipasan tanpa `{ once: true }` sehingga listener menumpuk
bila `signal` dipakai ulang.

Bukti:

- `lib/cloudstorage/api.ts:305-347` - `uploadFileWithProgress` menerima `signal?`.
- `lib/cloudstorage/api.ts:341-343` - `signal.addEventListener("abort", () => xhr.abort());` (tanpa `once`).
- `cloud-storage-app.tsx:274` - pemanggilan `cloud.uploadFileWithProgress(arr[i], parentId, cb)` tanpa argumen `signal`.

Rekomendasi:

- Simpan `AbortController` per batch unggahan dan sediakan tombol "Batal" pada kartu progres.
- Gunakan `{ once: true }` pada listener abort dan bersihkan listener saat `signal` tidak dipakai,
  serta pastikan `xhr.onload`/`onerror`/`onabort` saling meniadakan (hanya satu settle).

---

### TINGGI

#### T-1. Tanpa validasi upload di klien (ukuran & tipe)

`doUpload` mengunggah berkas apa pun tanpa memeriksa `config.max_upload_size` maupun jenis berkas.
`max_upload_size` yang sudah dimuat dari backend tidak pernah dipakai, sehingga pengguna bisa
menunggu lama hanya untuk mendapat penolakan dari server.

Bukti:

- `cloud-storage-app.tsx:262-291` - `doUpload` mengiterasi `arr` tanpa cek ukuran/tipe.
- `cloud-storage-app.tsx:185` - `const [config, setConfig] = useState<cloud.CloudConfig | null>(null);`
  (dimuat di `cloud-storage-app.tsx:241`, hanya `.enabled` yang dipakai di `doUpload:266`).
- `lib/cloudstorage/api.ts:30-33` - `CloudConfig` sudah membawa `max_upload_size`.
- `cloud-storage-app.tsx:591` - `<input type="file" multiple hidden ...>` tanpa `accept`.

Rekomendasi:

- Sebelum unggah, tolak berkas dengan `file.size > config.max_upload_size` dan tampilkan pesan
  jelas + nama berkas.
- Tambahkan `accept` pada `<input type="file">` bila ada kebijakan tipe; validasi tetap dilakukan
  ulang server-side (klien bukan batas keamanan).
- Kaitkan total ukuran batch dengan sisa kuota (`usage` sudah ada tetapi tidak dipakai untuk ini).

#### T-2. Aksesibilitas: tombol-tombol ikon tanpa nama aksesibel

Banyak `Button`/`<button>` hanya berisi ikon tanpa `aria-label`. `title` pada sebagian tombol
membantu tooltip mouse, tetapi tidak diumumkan andal oleh screen reader.

Bukti:

- `cloud-storage-app.tsx:547-572` - tombol layout grid/list (hanya ikon; `title` ada, tanpa `aria-label`).
- `cloud-storage-app.tsx:700-712` - tombol bintang di daftar (hanya `title`, tanpa `aria-label`).
- `cloud-storage-app.tsx:753-764` - tombol bintang di grid.
- `cloud-storage-app.tsx:866-901` - bilah aksi multi-pilih: tombol ZIP/Salin/Potong/Pindah/Hapus/Batal
  mengandalkan `title`, bukan `aria-label`.
- `cloud-storage-app.tsx:1148-1162` - `RowMenu` `DropdownMenuTrigger` tanpa `aria-label`.
- `cloud-storage-app.tsx:679-685` - checkbox item tanpa label yang mengait ke nama berkas.

Rekomendasi:

- Tambahkan `aria-label` eksplisit pada setiap tombol ikon (mis. `aria-label="Tandai favorit"`).
- Untuk checkbox item, bungkus dengan `<label>` atau set `aria-label={"Pilih " + f.name}`.
- Pertahankan `title` untuk tooltip, tetapi jangan andalkan sebagai satu-satunya nama.

#### T-3. Aksesibilitas: item berkas tidak dapat dioperasikan keyboard

Pembukaan folder/pratinjau bergantung pada `onClick` di `Card`/`div` (`cloud-storage-app.tsx:712`,
`:777`). Elemen ini bukan elemen interaktif semantik, tidak fokusable, dan tidak merespons
Enter/Space. Seleksi area (rubber-band) murni berbasis mouse, sehingga pengguna keyboard/screen
reader tidak dapat menyeleksi banyak item.

Bukti:

- `cloud-storage-app.tsx:695-714` - baris daftar: `div` dengan `onClick`, tanpa `role="button"`/`tabIndex`.
- `cloud-storage-app.tsx:753-786` - kartu grid: sama.
- `use-rubber-band.ts:39-52` - hanya `onMouseDown`, tidak ada padanan keyboard.
- `cloud-storage-app.tsx:829-836` - pemanggilan hook tanpa dukungan keyboard.

Rekomendasi:

- Jadikan item sebagai `<button>`/`<a>` atau beri `role="button"`, `tabIndex={0}`, `onKeyDown`
  (Enter/Space).
- Sediakan "Pilih semua" (mis. Ctrl/Cmd+A dalam container) sebagai alternatif keyboard untuk rubber-band.
- Pertimbangkan `aria-selected` pada item terpilih dan `role="listbox"/"option"` atau `role="grid"`.

#### T-4. Race condition pada pemuatan data vs pencarian/perpindahan view

`loadFiles`/`loadTrash` dipanggil dari beberapa `useEffect`/handler. Bila respons yang lebih lama
tiba setelah respons yang lebih baru (pengguna berpindah folder/pencarian cepat), hasil lama
menimpa hasil baru. Tidak ada penanda request-id atau `AbortController` untuk membatalkan yang usang.

Bukti:

- `cloud-storage-app.tsx:206-224` - `loadFiles` men-`setFiles` tanpa cek staleness.
- `cloud-storage-app.tsx:227-236` - `loadTrash` serupa.
- `cloud-storage-app.tsx:244-249` - effect memicu `loadFiles`/`loadTrash` pada perubahan `view`/`cwd`.
- `cloud-storage-app.tsx:252-263` - pencarian debounce men-`setSearchResults` tanpa membatalkan request lama.
- `cloud-storage-app.tsx:294-296` - `doUpload` memanggil `loadFiles(parentId)` di akhir, dapat balapan
  dengan navigasi pengguna.

Rekomendasi:

- Simpan `AbortController` per pemuatan dan batalkan yang sebelumnya; atau gunakan penomoran request
  (`requestIdRef`) dan abaikan respons jika bukan yang terbaru.
- Untuk pencarian, batalkan fetch lama pada cleanup dan gunakan `signal`.

#### T-5. Handler async fire-and-forget tanpa penanganan konsisten

Beberapa handler `async` dipakai langsung sebagai `onClick` (mis. `cloud-storage-app.tsx:402-411`,
`:459-476`, `cloud-storage-app.tsx:595-605`) tanpa `void`/`catch` eksplisit di titik pemanggilan.
Sebagian besar memang menangkap error di dalam, tetapi pola tidak konsisten. `doPaste`
(`cloud-storage-app.tsx:361-380`) memanggil `loadFiles(cwd)` di `finally` tanpa `await`.

Bukti:

- `cloud-storage-app.tsx:361-380` - `doPaste` `finally { setBusy(false); loadFiles(cwd); }`.
- `cloud-storage-app.tsx:375` - `loadFiles(cwd)` tanpa `void`/`await`.

Rekomendasi:

- Standarkan pemanggilan `void loadFiles(...)` untuk fire-and-forget yang sudah menjaga error
  internal, atau `await` penuh.
- Tambahkan ESLint rule `@typescript-eslint/no-floating-promises` bila belum ada.

#### T-6. Pratinjau dokumen (`kind === "doc"`) memuat teks mentah ke iframe tanpa sandbox

`FilePreviewDialog` me-render `kind === "doc"` sebagai `<iframe src={url}>`. Berkas `text/html`
termasuk kategori `doc` (`fileKind` mengembalikan `doc` untuk semua `text/*`). Iframe tanpa atribut
`sandbox` akan mengeksekusi skrip di dalam HTML yang diunggah pada origin aplikasi (same-origin),
sehingga berpotensi menjadi vektor XSS tersimpan bila isi berkas tidak sepenuhnya tepercaya.

Bukti:

- `file-preview-dialog.tsx:58-60` - `{kind === "doc" && <iframe src={url} .../>}` tanpa `sandbox`.
- `lib/cloudstorage/api.ts:363-366` - `fileKind` memetakan `m.startsWith("text/")` ke `"doc"`,
  termasuk `text/html`.

Rekomendasi:

- Tambahkan `sandbox=""` (atau kombinasi `sandbox="allow-same-origin"` minimal yang diperlukan)
  pada iframe, atau khusus untuk `text/html` tampilkan sebagai teks (beri label "Pratinjau teks")
  alih-alih me-render HTML.
- Sajikan berkas dari origin terpisah / `Content-Disposition: attachment` untuk tipe berisiko.

---

### SEDANG

#### S-1. State management terfragmentasi (banyak `useState` tanpa reducer)

`CloudStorageApp` mengelola ~20 potong state independen (`view`, `cwd`, `crumbs`, `files`, `trash`,
`loading`, `usage`, `config`, `selected`, `clipboard`, `search`, `searchResults`, `layout`, `sort`,
`typeFilter`, `uploads`, `busy`, `drag`, `dragOverFolder`, `dropUploadActive`) plus state dialog.
Tidak ada pengelompokan/reducer, sehingga transisi state terkait (ganti view harus reset `cwd`,
`search`, `selected`) tersebar dan mudah tidak sinkron.

Bukti:

- `cloud-storage-app.tsx:167-199` - blok deklarasi state.
- `cloud-storage-app.tsx:244-249` - reset `selected` dan pemuatan tersembunyi di dalam effect.
- `cloud-storage-app.tsx:522-529` - handler ganti view yang mengubah beberapa state sekaligus manual.

Rekomendasi:

- Kelompokkan state terkait (mis. `useReducer` untuk navigasi `{view, cwd, crumbs, search}` dan
  untuk seleksi `{selected, lastClickedId, anchorId}`).
- Ekstrak hook `useCloudFiles` yang membungkus pemuatan, pembatalan, dan error.

#### S-2. `busy` global menghambat paralelisme dan memberi umpan balik kabur

Satu boolean `busy` dipakai untuk aksi yang berbeda (paste, ZIP, rotate, move/copy lewat picker).
Menyalakan `busy` pada satu aksi tidak secara eksplisit menonaktifkan tombol yang seharusnya, dan
beberapa aksi yang sebenarnya bisa paralel ikut terhambat. Selain itu, `busy` tidak menggerakkan
indikator pada tombol yang memicunya di semua kasus.

Bukti:

- `cloud-storage-app.tsx:200` - `const [busy, setBusy] = useState(false);`
- `cloud-storage-app.tsx:361-380` (`doPaste`), `:429-441` (`downloadZipSelected`),
  `:443-457` (`handleRotate`) semua memakai `busy` yang sama.
- `cloud-storage-app.tsx:471` dan `:595-605` - tombol yang `disabled={busy}` untuk aksi berbeda.

Rekomendasi:

- Ganti menjadi himpunan aksi yang sedang berjalan (`Set<string>` atau peraksi `pending`), agar
  status tombol presisi dan aksi independen tidak saling memblokir.

#### S-3. `downloadZip`/mutasi tidak melindungi diri dari klik ganda

`downloadZipSelected` dan `handleRotate` menyetel `busy`, tetapi `RowMenu` untuk "Putar" dan item
menu lainnya tidak memeriksa `busy`, sehingga pengguna dapat memicu aksi berulang cepat. Untuk
`handleShare` tidak ada guard sama sekali.

Bukti:

- `cloud-storage-app.tsx:384-392` - `handleShare` tanpa guard `busy`/in-flight.
- `cloud-storage-app.tsx:1155-1160` - item menu tidak `disabled` saat `busy`.

Rekomendasi:

- Bungkus aksi mutasi dengan guard idempotensi (ignore bila sudah in-flight) dan nonaktifkan item
  menu terkait saat `busy`.

#### S-4. Penanganan tipe berkas: `fileKind` tidak membedakan `text/html`, `text/csv`, dan Office

`fileKind` memetakan seluruh `text/*` (termasuk `text/html`, `text/csv`) ke `doc`, sehingga HTML
dipratinjau sebagai dokumen (lihat T-6) dan CSV tidak diberi pratinjau tabel. `isEditableText` dan
`fileKind` adalah dua sumber logika tipe terpisah yang bisa divergen.

Bukti:

- `lib/cloudstorage/api.ts:363-366` - `fileKind` hanya membedakan image/video/audio/pdf/doc/other.
- `lib/cloudstorage/api.ts:325-337` - `isEditableText` dengan daftar ekstensi terpisah.

Rekomendasi:

- Satukan klasifikasi (satu fungsi `classify(file)` mengembalikan `{kind, editable, previewMode}`)
  agar konsisten dan mudah diuji.
- Tangani tipe berisiko khusus (html, svg) secara eksplisit.

#### S-5. Kuota ditampilkan menyesatkan (baseline hard-coded 5 GiB, label "tanpa batas")

Bilah pemakaian memakai `baseline = 5 * 1024 * 1024 * 1024` yang di-hard-code, sementara teks
menyatakan "tanpa batas kuota". Ini memberi persentase yang tidak memiliki dasar kebenaran dan
berpotensi membingungkan.

Bukti:

- `cloud-storage-app.tsx:838-844` - `usedPercent` dengan `baseline` hard-coded.
- `cloud-storage-app.tsx:493` - teks "Pemakaian penyimpanan (tanpa batas kuota)".

Rekomendasi:

- Hilangkan batas persen bila memang tanpa kuota, atau ambil `quota_bytes` dari `/usage` bila backend
  menyediakannya. Jangan tampilkan `Progress` yang seolah indikator kuota.

#### S-6. `transfer` drag tidak membersihkan `drag` bila `dragEnd` tidak terjadi

State `drag` di-set pada `startDrag` dan dibersihkan pada `onDragEnd`. Pada beberapa browser/skenario
(drag keluar jendela, drop di luar), `dragend` bisa tidak memicu handler sehingga `drag`/`dragOverFolder`
menjadi "lengket" dan men-supresi drop-upload (`onAreaDragOver`/`onAreaDrop` early-return saat `drag`).

Bukti:

- `cloud-storage-app.tsx:335-341` - `startDrag` meng-set `drag`.
- `cloud-storage-app.tsx:298-300` - `onAreaDrop` `if (drag) return;`.
- `cloud-storage-app.tsx:303-309` - `onAreaDragOver` `if (drag) return;`.

Rekomendasi:

- Tambahkan pembersihan cadangan (mis. listener global `dragend`/`drop` pada window) atau reset
  `drag` saat `onAreaDrop`/`onAreaDragLeave` tingkat area.

#### S-7. Layout grid/list tanpa semantik struktur

Daftar berkas dirender sebagai `div` bersarang (bukan `<ul>/<li>`), header tabel daftar memakai `div`
dengan kelas `grid` tanpa `role="row"/"columnheader"`. Screen reader tidak mendapat struktur kolom.

Bukti:

- `cloud-storage-app.tsx:651-666` - header daftar memakai `div` + `grid`.
- `cloud-storage-app.tsx:667-746` - baris daftar memakai `div`, bukan `role="row"`.
- `cloud-storage-app.tsx:748-793` - grid kartu memakai `div` tanpa `role="list"`/`item`.

Rekomendasi:

- Gunakan `<table>` semantik untuk tampilan daftar, atau `role="grid"` dengan `role="row"`/`"gridcell"`.
- Untuk tampilan kartu, gunakan `role="list"` + `role="listitem"` pada tiap kartu.

#### S-8. `folder-picker-dialog` menelan error tanpa umpan balik

`load` di `FolderPickerDialog` melakukan `catch { setFolders([]); }` tanpa `toast`, sehingga kegagalan
jaringan tampil seolah-olah folder kosong ("Tidak ada subfolder di sini"), menyesatkan pengguna.

Bukti:

- `folder-picker-dialog.tsx:41-50` - `load` dengan `catch { setFolders([]); }`.
- `folder-picker-dialog.tsx:86-88` - pesan "Tidak ada subfolder di sini." untuk kedua kondisi
  (kosong sebenarnya vs gagal memuat).

Rekomendasi:

- Bedakan state error dari state kosong (`error: boolean`), tampilkan pesan gagal + tombol "Coba lagi".

---

### RENDAH

#### R-1. `TextEditorDialog` tanpa peringatan perubahan belum disimpan (unsaved changes)

Menutup dialog editor (Esc/klik luar/tombol Batal) langsung memanggil `onClose` tanpa konfirmasi bila
ada perubahan belum disimpan. Pengguna dapat kehilangan tulisan secara tak sengaja.

Bukti:

- `text-editor-dialog.tsx:96-98` - `<Dialog open onOpenChange={(o) => !o && onClose()}>`.
- `text-editor-dialog.tsx:63-81` - `handleSave` tanpa pelacakan `dirty`.

Rekomendasi:

- Lacak `dirty = content !== initialContent` dan minta konfirmasi sebelum menutup, atau simpan draf ke
  `localStorage` sebagai pemulihan.

#### R-2. `TextEditorDialog` tidak memvalidasi nama catatan baru

Untuk catatan baru, `name.trim()` bisa kosong dan tetap dikirim ke `createNote`, bergantung pada
validasi server. Tidak ada juga umpan balik inline (mis. pesan di bawah input).

Bukti:

- `text-editor-dialog.tsx:68` - `cloud.createNote(name.trim(), content, parentId)`.
- `text-editor-dialog.tsx:104-110` - input nama tanpa validasi/`required`.

Rekomendasi:

- Blokir simpan bila `isNew && !name.trim()`, tampilkan pesan inline, dan nonaktifkan tombol Simpan.

#### R-3. Dialog "Folder Baru"/"Ganti Nama" mengizinkan nilai kosong dan tanpa trim feedback

`handleCreateFolder` mengembalikan lebih awal bila nama kosong tanpa memberi tahu pengguna, dan
`handleRename` mengirim `renameValue.trim()` yang bisa kosong.

Bukti:

- `cloud-storage-app.tsx:344-358` - `handleCreateFolder` `if (!name) return;` (senyap).
- `cloud-storage-app.tsx:360-371` - `handleRename` tanpa cek kosong.

Rekomendasi:

- Nonaktifkan tombol aksi saat input kosong dan beri pesan inline bila kosong.

#### R-4. `FilePreviewDialog` tidak menangani kegagalan muat media

`img`/`video`/`audio`/`iframe` tanpa `onError`; bila endpoint unduh gagal (mis. 404/403), pengguna
melihat area kosong tanpa penjelasan.

Bukti:

- `file-preview-dialog.tsx:39-42` - `<img src={url} ...>` tanpa `onError`.
- `file-preview-dialog.tsx:43-57` - `video`/`audio`/`iframe` tanpa fallback.

Rekomendasi:

- Tambahkan `onError` pada setiap elemen media untuk menampilkan pesan "Gagal memuat pratinjau" +
  tombol Unduh.

#### R-5. `use-rubber-band` men-set state pada setiap `mousemove` dan mendata ulang DOM tiap frame

`handleMove` memanggil `setRect` dan `onSelect` (yang men-`setSelected`) pada setiap event `mousemove`
tanpa throttle/`requestAnimationFrame`, dan `querySelectorAll` dijalankan ulang tiap gerakan. Untuk
folder besar ini memicu banyak render.

Bukti:

- `use-rubber-band.ts:54-86` - `handleMove` tanpa throttle, `querySelectorAll` tiap panggilan.
- `use-rubber-band.ts:80` - `onSelect(hits)` tiap gerakan.

Rekomendasi:

- Throttle dengan `requestAnimationFrame`, cache daftar bounding box saat `mousedown` (posisi item
  tidak berubah selama drag), dan panggil `onSelect` hanya bila himpunan `hits` benar-benar berubah.

#### R-6. `page.tsx` hanya membungkus komponen tanpa boundary error/Suspense

`CloudStoragePage` me-render `CloudStorageApp` langsung, tanpa `error.tsx`/`loading.tsx` khusus rute
atau `ErrorBoundary`, sehingga error render akan jatuh ke boundary terdekat (global).

Bukti:

- `page.tsx:11-13` - `return <CloudStorageApp />;`

Rekomendasi:

- Tambahkan `app/(dashboard)/cloud-storage/error.tsx` dan `loading.tsx` untuk UX kegagalan/muat rute
  yang lebih baik.

#### R-7. Duplikasi kode: dua jalur pemilihan folder dan dua jalur move/copy

Logika move/copy terduplikasi di `dropOnFolder` (`cloud-storage-app.tsx:335-358`), `doPaste`
(`:361-380`), dan callback `onPick` dari picker (`:1000-1030`). Risiko divergensi pesan/penanganan error.

Bukti:

- `cloud-storage-app.tsx:335-358` vs `:361-380` vs `:1000-1030` - pola `copyFiles`/`moveFiles` +
  `loadFiles`/`loadUsage` berulang.

Rekomendasi:

- Ekstrak helper `transferItems(ids, targetId, mode)` yang menangani toast, reload, `busy`, dan error.

#### R-8. `formatBytes` tidak menangani nilai tak hingga/NaN dan unit di luar TB

`formatBytes` memakai `Math.log` dan indeks unit tanpa clamp; nilai `NaN`/`Infinity` atau byte sangat
besar (>TB) akan menghasilkan `undefined`/unit di luar daftar.

Bukti:

- `lib/cloudstorage/api.ts:369-375` - `Math.floor(Math.log(bytes) / Math.log(1024))` tanpa clamp.

Rekomendasi:

- Guard `!Number.isFinite(bytes)` dan clamp indeks unit ke panjang array.

#### R-9. `filenameFromDisposition` tidak menangani `filename*=UTF-8''...`

Regex hanya menangkap `filename="..."`; variasi RFC 5987 (`filename*=`) tidak ditangani, sehingga
nama unduhan ZIP bisa jatuh ke fallback untuk server yang memakai bentuk itu.

Bukti:

- `lib/cloudstorage/api.ts:252-256` - `filenameFromDisposition`.

Rekomendasi:

- Tangani `filename*=` (decode RFC 5987) sebelum fallback ke `filename=`.

#### R-10. `getCSRFToken` mengandalkan cookie `csrf_token` tanpa jalur fallback gagal-cepat

Bila cookie `csrf_token` absen (mis. karena waktu/tilaman), `mutationHeaders` mengirim permintaan
mutasi tanpa header CSRF, yang akan gagal 403 di server tanpa pesan yang menggiring ke perbaikan.

Bukti:

- `lib/cloudstorage/api.ts:55-63` - `getCSRFToken` mengembalikan `null` bila tidak ada.
- `lib/cloudstorage/api.ts:65-69` - `mutationHeaders` hanya menambahkan header bila `csrf` ada.

Rekomendasi:

- Deteksi 403 khusus CSRF dan tampilkan pesan pemulihan (muat ulang halaman), atau ganti pola
  "double-submit" dengan endpoint bootstrap token.

---

## 3. Analisis Tipe & Validasi Respons

API client mendeklarasikan interface (`CloudFile`, `CloudUsage`, `CloudConfig`, `ListFilesParams`,
`SharedInfo`, dst.) dengan baik di `lib/cloudstorage/api.ts:11-51`, namun hasil `res.json()`
**di-cast implisit** ke tipe tersebut tanpa validasi runtime (`res.json()` bertipe `any`). Bila
backend mengubah/mengirim field tak terduga (mis. `size` sebagai string, `is_folder` hilang), UI
akan gagal di tempat tak terduga (mis. `file.size > config.max_upload_size`, `f.path.split`).

Bukti:

- `lib/cloudstorage/api.ts:108` - `return res.json();` untuk `CloudFile[]` tanpa validasi.
- `lib/cloudstorage/api.ts:210` - `return res.json();` untuk `CloudFile`.
- `cloud-storage-app.tsx:789` - `f.path.split(" / ")` mengasumsikan `path` ada berbentuk string
  (bertipe opsional di `CloudFile`, `lib/cloudstorage/api.ts:16`).

Rekomendasi:

- Gunakan validasi runtime (zod/valibot) pada batas API, atau minimal coercion eksplisit untuk field
  yang dipakai UI (`name`, `size`, `is_folder`, `mime_type`).
- Jadikan `path` non-opsional atau beri default `""` di client.

---

## 4. Analisis Cakupan Test

Tidak ditemukan berkas test untuk komponen UI cloud storage maupun untuk `lib/cloudstorage/api.ts`
(tidak ada `*.test.tsx`/`*.test.ts` di `_components/`). Konsekuensinya aspek yang paling rawan
regresi — pemetaan error, validasi upload, logika `fileKind`/`isEditableText`, dan hook
rubber-band — tidak terlindungi.

Rekomendasi test (prioritas):

1. `lib/cloudstorage/api`: uji pemetaan `CloudApiError` (network/timeout/http/parse), retry GET pada
   5xx/429, timeout dengan `AbortSignal`, dan `filenameFromDisposition` (termasuk `filename*=`).
2. `fileKind`/`isEditableText`: tabel kasus MIME + ekstensi, termasuk `text/html`, `text/csv`, SVG,
   tanpa ekstensi, dan `is_folder`.
3. `cloud-storage-app`: validasi upload (tolak > `max_upload_size`), race condition pemuatan
   (respons lama diabaikan), dan guard in-flight.
4. `TextEditorDialog`: cegah tutup saat `dirty`, validasi nama catatan baru.
5. `use-rubber-band`: hitung irisan benar (edge kasus item sebagian beririsan), tanpa `mousemove`
   berlebih.

---

## 5. Rekomendasi Prioritas (Urutan Aksi)

1. **Perkuat API client (K-1/K-2/K-3/K-4)** — tambah timeout berbasis `AbortSignal`, retry untuk
   GET idempoten, dan tipe `CloudApiError` terpusat; teruskan signal dari UI. Ini memperbaiki kelas
   bug terbesar sekaligus.
2. **Validasi upload (T-1)** — pakai `config.max_upload_size`, tolak lebih awal, sediakan pembatalan.
3. **Keamanan pratinjau (T-6)** — tambahkan `sandbox` pada iframe dan ubah penanganan `text/html`.
4. **Race condition (T-4)** — pembatalan/penomoran request untuk pemuatan & pencarian.
5. **Aksesibilitas (T-2/T-3/S-7)** — `aria-label`, item fokusable + keyboard, semantik grid/list.
6. **State & DRY (S-1/S-2/R-7)** — reducer untuk navigasi/seleksi, pending per-aksi, helper transfer.
7. **Kebersihan (R-1..R-10)** — unsaved-changes, validasi nama, fallback media, performa rubber-band.

---

## 6. Catatan Metodologi

- Temuan berbasis pembacaan statis sumber; tidak ada eksekusi build/test (tidak tersedia tool shell
  pada sesi ini).
- Nomor baris disajikan sebagai referensi pendekatan; verifikasi ulang dengan `grep -n` sebelum
  mengeksekusi perbaikan.
- Tidak ada kode produksi yang diubah. Dokumen ini murni analisis.
