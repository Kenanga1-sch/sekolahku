# Riset Perilaku Protokol eSCL pada ADF — Loop `NextDocument` DocStation

Tanggal: riset statis (tanpa menjalankan runtime, tanpa perangkat fisik)
Cakupan utama:

- `lib/docstation/api.ts` — fungsi `requestScan` (loop `NextDocument` ADF hingga `ADF_MAX_PAGES`)
- `app/(dashboard)/docstation/_hooks/use-docstation.ts` — hook orkestrasi `scan()` / `addImageBlobs()`
- `lib/docstation/state.ts` — model halaman (konteks pelaporan jumlah lembar)
- Konteks pendukung: `go-backend/internal/handlers/docstation_handler.go` (proxy eSCL), `docs/docstation-audit-engine.md`, `docs/docstation-audit-frontend.md`

> **Catatan kepatuhan:** Dokumen ini adalah **laporan riset read-only**. **Tidak ada satu baris pun kode
> produksi yang diubah.** Yang ditulis hanya file ini (`docs/docstation-research-adf.md`). Semua usulan
> perbaikan di bagian (3) dan (4) bersifat _rekomendasi_ dan belum diterapkan.

---

## (1) Ringkasan

DocStation memakai eSCL (Mopria/AirScan) melalui proxy Go di `/api/docstation/escl/*`. Untuk ADF,
klien membuat satu `ScanJob` (`POST .../escl/ScanJobs`), lalu **berulang memanggil
`.../eSCL/ScanJobs/<id>/NextDocument` sampai gagal** (`if (!docResp.ok) break`) atau sampai kosong
(`blob.size === 0`), dibatasi `ADF_MAX_PAGES = 50`.

Masalahnya, loop ini **buta terhadap protokol**: ia tidak pernah membaca status job, tidak pernah
memberi jeda antar `NextDocument`, dan tidak pernah membedakan "kertas habis" (normal, akhir dokumen)
dari "printer belum siap / masih memproses / error sementara" — padahal kedua kondisi itu **sama-sama
menghasilkan respons non-2xx**. Akibatnya:

- **Pemindaian bisa berhenti prematur** (kertas terlewat) bila `NextDocument` membalas 5xx/503 saat
  job masih `Processing`, karena `break` pertama langsung mengakhiri dokumen.
- **Tidak ada deteksi jumlah kertas sebenarnya.** Jumlah lembar = jumlah respons 2xx yang sukses;
  tidak ada sumber kebenaran lain.
- **Tidak ada pelaporan "berhasil X lembar".** UI (`docstation-app.tsx`) hanya menampilkan
  `toast.error`/sukses generik; jumlah lembar yang berhasil tak pernah disurfaced ke operator, sehingga
  bila ADF "menelan" separuh tumpukan tanpa error, pengguna tidak menyadarinya sampai melihat hasil.
- **Perilaku Canon vs Epson berbeda** dan saat ini tidak diakomodasi: firmware Canon (mis. seri G7000)
  dan Epson (mis. L6270) memakai header `JobState`/semantik `NextDocument` yang sedikit berbeda
  (kapan `404`/`406`, berapa lama `Processing`). Tanpa pembedaan vendor, satu strategi tidak cukup.

**Kesimpulan singkat:** loop saat ini adalah "tembak `NextDocument` sampai gagal". Ia kebetulan bekerja
di sebagian unit, tetapi rapuh terhadap perbedaan firmware dan tidak memberi kepastian jumlah lembar.
Diperlukan: **(a)** polling status job dengan interval + timeout, **(b)** jeda minimum antar
`NextDocument`, **(c)** cara deteksi jumlah kertas sebenarnya (status 404/406 + adapter per-vendor),
dan **(d)** pelaporan "berhasil X lembar" ke pengguna.

---

## (2) Temuan (dengan bukti file:baris)

Semua nomor baris mengacu pada isi repo saat riset (`/home/chitchat/sekolahku`).

### T1 — Loop `NextDocument` tanpa retry, tanpa polling status, tanpa jeda

- **Lokasi:** `lib/docstation/api.ts:145-163` (blok ADF di dalam `requestScan`).
- **Bukti kode:**

  ```ts
  // api.ts:144-163
  const blobs: Blob[] = [];
  try {
    if (source === "adf") {
      let pageNum = 1;
      while (pageNum <= ADF_MAX_PAGES) {
        signal?.throwIfAborted();
        onProgress?.(`Memindai lembar ADF ke-${pageNum}…`, Math.min(90, 45 + pageNum * 10));
        const nextDocPath = `${jobPath.replace(/\/$/, "")}/NextDocument`;
        const docResp = await fetch(nextDocPath, {
          credentials: "include",
          headers: { "x-printer-ip": printerIp },
          signal,
        });
        if (!docResp.ok) break;          // ← break buta: 404 (habis) & 503 (sibuk) diperlakukan sama
        const blob = await docResp.blob();
        if (!blob || blob.size === 0) break;
        blobs.push(blob);
        pageNum++;
      }
    }
  ```

- **Analisis:** Tidak ada `await sleep(...)`/`setTimeout` antar iterasi. Tidak ada pemanggilan endpoint
  status job (mis. `GET .../ScanJobs/<id>` atau `.../ScanJobs/<id>/NextDocument` HEAD) untuk menunggu
  job `Processing → Completed`. Tidak ada retry/backoff. Satu `!docResp.ok` langsung `break`,
  sehingga respons transien (`503 Service Unavailable`, `409`, timeout jaringan antar hop proxy)
  **dianggap akhir dokumen** dan sisa tumpukan ADF hilang tanpa peringatan.
- **Dampak:** Kehilangan halaman secara senyap (silent data loss) pada scanner yang lambat, saat WiFi
  tidak stabil, atau saat firmware butuh waktu "menghisap" lembar berikutnya (beberapa Epson/Cannon
  memerlukan 1–3 detik antar `NextDocument`, dan membalas `503`/`406` bila dipanggil terlalu cepat).

### T2 — Ketiadaan deteksi jumlah kertas sebenarnya

- **Lokasi:** `lib/docstation/api.ts:159-160` (`break` pada blob kosong) dan `lib/docstation/api.ts:182-184`
  (error bila `blobs.length === 0`).
- **Bukti kode:**

  ```ts
  // api.ts:182-184
  if (blobs.length === 0) {
    throw new Error("Tidak ada lembaran kertas yang terdeteksi di scanner");
  }
  ```

- **Analisis:** Satu-satunya sinyal "jumlah kertas" adalah banyaknya respons yang sukses. Tidak ada
  pembacaan `<scan:JobState>` / `<pwg:JobState>` dari dokumen status, tidak ada pemanfaatan kode HTTP
  eSCL yang bermakna: pada ADF yang jujur, **`404 Not Found` pada `NextDocument` = dokumen habis
  (akhir wajar)**, sedangkan **`406 Not Acceptable`/`503`** bisa berarti "tray kosong" _atau_
  "job belum siap". Tanpa memisahkan kedua kode ini, kita tidak tahu apakah scanner benar-benar habis
  atau berhenti karena gangguan.
- **Dampak:** Tidak mungkin melaporkan jumlah lembar yang benar, dan tidak mungkin mendeteksi kondisi
  "ADF kosong sejak awal" vs "berhenti di tengah". Pesan "Tidak ada lembaran kertas yang terdeteksi"
  juga menyesatkan bila sebenarnya 1–2 lembar sudah terunduh lalu berhenti karena `503`.

### T3 — Tidak ada pelaporan jumlah lembar berhasil

- **Lokasi:** `app/(dashboard)/docstation/_hooks/use-docstation.ts:130-152` (`addImageBlobs`),
  `use-docstation.ts:190-227` (`scan`).
- **Bukti kode:**

  ```ts
  // use-docstation.ts:130-152 (ringkas)
  const addImageBlobs = useCallback(
    async (blobs, namePrefix = "Halaman", options = {}) => {
      const engine = stateRef.current!;
      for (const blob of blobs) {
        const { image, url } = await createImageFromBlob(blob);
        if (options.skipBlank && isProbablyBlank(image)) {
          URL.revokeObjectURL(url);
          continue;
        }
        const page = createEnginePage(
          image,
          url,
          `${namePrefix} ${engine.pages.length + 1}`,
        );
        engine.pages.push(page);
        engine.activeId = page.id;
      }
      syncPages();
    },
    [syncPages],
  );
  ```

  ```ts
  // use-docstation.ts:208-224 (ringkas)
  const blobs = await requestScan({ /* ... */ signal: aborter.signal });
  await addImageBlobs(blobs, "Scan", { skipBlank: config.skipBlank });
  ```

- **Analisis:** `addImageBlobs` mengembalikan `Promise<void>`, tidak menghitung berapa yang
  ditambahkan vs dilewati (skip-blank). `scan()` tidak mengembalikan `{ pageCount, skipped }` dan tidak
  memanggil `toast.success("Berhasil memindai X lembar")`. Tidak ada field di `EnginePage`/`EngineState`
  (`lib/docstation/state.ts:34-56`) untuk melacak asal/urutan pemindaian.
- **Dampak:** Operator tidak tahu berapa lembar yang benar-benar masuk ke sesi edit. Jika `skipBlank`
  membuang halaman, tidak ada umpan balik. Ini diperparah oleh T1/T2: bila loop berhenti prematur,
  pengguna melihat "sukses" dengan halaman lebih sedikit tanpa sadar ada yang hilang.

### T4 — Tidak ada adaptasi per-vendor (Canon vs Epson)

- **Lokasi:** `lib/docstation/api.ts:145-163` (loop tunggal untuk semua printer);
  konteks vendor: `go-backend/internal/handlers/docstation_handler.go:112-137` (default printer
  `Canon G7000 Series` & `Epson L6270`, flag `Secure`).
- **Bukti konteks:**

  ```go
  // docstation_handler.go:113-116
  defaults := []DocStationPrinter{
      {IP: "192.168.10.131", Name: "Canon G7000 Series (LAN)", Secure: false},
      {IP: "192.168.10.140", Name: "Epson L6270 Series (Wi-Fi)", Secure: true},
  }
  ```

- **Analisis:** Klien memiliki `printerIp` (string) tetapi tidak melempar nama/vendor ke `requestScan`,
  sehingga loop memakai satu strategi untuk Canon (http, LAN) dan Epson (https, Wi-Fi). Padahal proxy
  sendiri sudah membedakan perlakuan: `clearStuckESCLJobs` hanya dipanggil untuk printer `secure`
  (`docstation_handler.go:365-369`). Artinya backend mengakui perilaku vendor berbeda, tetapi klien
  tidak ikut menyesuaikan strategi `NextDocument` (jeda, retry, interpretasi kode).
- **Dampak:** Pada Epson yang butuh jeda lebih panjang antar `NextDocument`, loop terburu-buru
  menghasilkan `503`/gagal dini; pada Canon yang membalas `404` saat habis, tidak ada masalah. Satu
  bug sulit direproduksi karena hanya muncul pada satu vendor.

### T5 — `ADF_MAX_PAGES` keras, tanpa penanda "batas tercapai"

- **Lokasi:** `lib/docstation/api.ts:82-83` (`ADF_MAX_PAGES = 50`), `api.ts:147` (`while (pageNum <= ADF_MAX_PAGES)`).
- **Bukti kode:**

  ```ts
  // api.ts:82-83
  /** Batas lembar ADF per sekali scan agar tak OOM di perangkat lemah. */
  export const ADF_MAX_PAGES = 50;
  ```

- **Analisis:** Saat `pageNum` mencapai 50 loop keluar lewat kondisi, bukan lewat sinyal "selesai".
  Tidak ada perbedaan perilaku antara "selesai di lembar 50 karena habis" dan "dipotong paksa di lembar
  50 karena batas". Tidak ada peringatan "batas 50 lembar tercapai, sisanya tidak dipindai".
- **Dampak:** Untuk tumpukan >50 lembar, sisa kertas dibiarkan di ADF tanpa memberi tahu operator bahwa
  tumpukan belum habis — kegagalan senyap lain yang serumpun dengan T1/T2.

### T6 — Proxy eSCL memakai timeout 90 dtk tunggal & `clearStuck` hanya pada `secure`

- **Lokasi:** `go-backend/internal/handlers/docstation_handler.go:126-135` (klien 90 dtk),
  `:332-441` (`ProxyESCL`), `:365-369` (gate `secure`).
- **Analisis konteks (bukan bug klien, tetapi mempengaruhi strategi):** Karena proxy memakai
  `httpClient` 90 dtk dan tidak mempropagasi context, sebuah `NextDocument` yang menggantung bisa
  menahan UI cukup lama; dan `clearStuckESCLJobs` (yang membersihkan job macet) hanya dijalankan untuk
  printer `secure`/Epson. Ini memperkuat kebutuhan **timeout per-request di sisi klien** dan strategi
  per-vendor.
- **Dampak:** Klien tidak punya timeout sendiri; bila proxy menggantung, `scanning` tetap `true` sampai
  lapisan jaringan memutus. (Lihat juga `docs/docstation-audit-backend.md` temuan #3.)

---

## (3) Opsi solusi + rekomendasi

### 3.1 Strategi polling status job (interval + timeout)

Opsi:

- **Opsi A — polling murni `NextDocument` dengan retry: tidak direkomendasikan sebagai satu-satunya
  mekanisme.** `NextDocument` bersifat _blocking_ di banyak firmware, sehingga retry tanpa henti bisa
  memperburuk (mengantre permintaan di ADF).
- **Opsi B — polling `GET .../ScanJobs/<id>` (status) lalu `NextDocument` ketika siap (direkomendasikan).**
  Langkah:
  1. Setelah `POST ScanJobs`, bila `Location`/jobPath tersedia, **poll status** `GET jobPath` dengan
     interval awal **500 ms**, backoff ×1.5 hingga maksimum **2 s**, dan **timeout total per halaman
     ~30 s** (dapat dikonfigurasi).
  2. Polling berhenti ketika job mencapai status terminal. Perhatikan header `JobState`
     (nilai lazim: `Processing`, `Completed`, `Canceled`, `Aborted`, `Pending`) baik di header respons
     maupun di body XML (`<scan:JobState>` / `<pwg:JobState>`).
  3. Ketika job **siap** untuk halaman berikutnya, panggil `NextDocument`.
  - Catatan penting: sejumlah firmware tidak mengekspos `JobState` yang dapat diandalkan lewat `GET`.
    Untuk unit semacam itu, gunakan **fallback** "retry `NextDocument` dengan jeda + klasifikasi kode".
- **Opsi C — hybrid (rekomendasi final).** Coba `GET status`; bila 404/405/tidak didukung, jatuh ke
  mode `NextDocument`-with-backoff. Selalu terapkan timeout total agar tak menggantung.

**Rekomendasi:** implementasi **Opsi C** dengan parameter:
`POLL_INTERVAL_MS = 500` (backoff ke `2000`), `PER_PAGE_TIMEOUT_MS = 30000`, `JOB_TOTAL_TIMEOUT_MS = 600000`.

### 3.2 Jeda minimum antar `NextDocument`

Opsi:

- **Jeda adaptif berbasis hasil:** mulai **300 ms**; bila respons terakhir non-2xx sementara (mis. 503),
  naikkan jeda berlipat (500 ms → 1 s → 2 s) dengan batas maksimum.
- **Jeda tetap per-vendor:** Canon (LAN) mungkin cukup **200–400 ms**, Epson (Wi-Fi) **800–1500 ms**.

**Rekomendasi:** jeda adaptif `MIN_NEXT_DOC_DELAY_MS = 300` sebagai default, dinaikkan oleh backoff saat
menerima 5xx; plus **override per-vendor** (lihat 3.3). Jeda ini **wajib** agar tidak menabrak
"device busy" di firmware yang butuh waktu menarik lembar.

### 3.3 Cara mendeteksi jumlah kertas sebenarnya (deteksi akhir dokumen yang benar)

Opsi:

- **Opsi A — klasifikasi kode HTTP pada `NextDocument` (rekomendasi utama).**
  - `200` → ada lembar; tambahkan blob.
  - `404 Not Found` → **akhir dokumen wajar** (tray habis). Untuk eSCL, ini sinyal baku "tidak ada
    dokumen berikutnya". → berhenti tanpa error.
  - `406 Not Acceptable` → **kandidat "tray kosong" pada sebagian firmware** (khususnya beberapa Epson).
    Perlakukan sebagai akhir dokumen **setelah** dikonfirmasi status job `Completed`, atau sebagai
    "tray kosong" bila job memang tidak punya halaman lagi.
  - `409 Conflict` → job belum siap; **retry** dengan jeda.
  - `503 Service Unavailable` → device sibuk/masih memproses; **retry** dengan backoff (bukan akhir).
  - `>=500` lain → retry terbatas, lalu error eksplisit.
- **Opsi B — baca `JobState`/`JobStateReasons` + atribut ADF.**
  - Bila body/`GET status` memberi `JobState=Completed` **dan** `NextDocument` mengembalikan `404`,
    itu akhir dokumen. Bila `JobState=Toolong`/`Aborted`/`Canceled`, itu berhenti abnormal → error.
  - Beberapa perangkat mengekspos atribut `AdfState`/`ScannerAdfState` (`Empty`, `Loaded`,
    `ScannerAdfEmpty`) — bila tersedia, pakai untuk memastikan tray benar-benar kosong.
- **Opsi C — adapter khusus per-vendor.** Bila perilaku benar-benar berbeda dan tak bisa disatukan:
  buat tabel/strategy `esclVendorProfile(vendor)` yang memetakan:
  `{ adfEndStatuses: number[], busyStatuses: number[], minDelayMs: number, supportsStatusPoll: boolean }`,
  lalu pilih profil dari nama printer (proxy sudah mengirim nama via `/printers`).

**Rekomendasi:** **Opsi A sebagai inti + Opsi C sebagai lapisan konfigurasi**, dengan Opsi B sebagai
penguat bila firmware mendukung. Deteksi vendor dari nama printer (mis. mengandung "Epson"/"Canon")
yang sudah ada di konfigurasi backend (`docstation_handler.go:112-137`); teruskan `vendor` ke
`requestScan`.

### 3.4 Cara melaporkan "berhasil X lembar" ke pengguna

Opsi:

- Kembalikan `ScanResult` dari `requestScan`/`scan()`: `{ scanned: number, skippedBlank: number,
reachedLimit: boolean, aborted: boolean }`.
- `addImageBlobs` mengembalikan `{ added, skipped }`.
- Tampilkan `toast` ringkas: **"Berhasil memindai X lembar (Y dilewati sebagai kosong)."** dan, bila
  `reachedLimit`, tambahkan **"Batas 50 lembar tercapai — sisanya belum dipindai."**
- Bila `aborted` (pengguna batalkan via `cancelScan`), tampilkan **"Pemindaian dibatalkan; X lembar
  sudah tersimpan."** (saat ini `use-docstation.ts:210-212` hanya `return` tanpa pesan).

**Rekomendasi:** implementasi varian pertama (return value + toast informatif), karena inilah satu-satunya
cara operator mempercayai hasil ADF tanpa menghitung manual.

---

## (4) RENCANA IMPLEMENTASI terperinci

> Rencana ini **belum dijalankan**. Tidak ada kode produksi yang diubah pada riset ini.

### 4.1 File yang akan diubah (usulan)

1. **`lib/docstation/api.ts`** — inti perubahan: helper `pollJob`, klasifikasi kode, jeda/backoff,
   profil vendor, `ScanResult` sebagai nilai balik.
2. **`lib/docstation/state.ts`** — tambah metadata opsional pada model (mis. `page.source`,
   `page.index`) bila diperlukan untuk urutan/pelaporan; minimal tambah tipe `ScanOutcome` (murni tipe,
   tanpa efek samping DOM).
3. **`app/(dashboard)/docstation/_hooks/use-docstation.ts`** — `addImageBlobs` mengembalikan
   `{ added, skipped }`; `scan()` mengembalikan `ScanOutcome` dan meneruskan pesan ringkas ke pemanggil.
4. **Pesan UI singkat** — `_components/docstation-app.tsx` (handler `onScan`/`toast`) dan/atau
   `_components/scan-config-panel.tsx` (label progres). Teks usulan:
   - sukses: `Berhasil memindai X lembar` (opsional `· Y dilewati kosong`)
   - batas: `Batas 50 lembar tercapai — sisanya belum dipindai`
   - batal: `Pemindaian dibatalkan; X lembar sudah tersimpan`
   - gagal: `Pemindaian gagal di lembar ke-N: <penyebab>`

### 4.2 Perubahan konkret di `lib/docstation/api.ts`

- **Tambah helper `pollJob(jobPath, { signal, printerIp, intervalMs, timeoutMs })`** yang:
  - memanggil `GET jobPath` dengan header `x-printer-ip`;
  - mengurai `JobState` dari header (`JobState`) dan/atau XML body (`<scan:JobState>`/`<pwg:JobState>`);
  - mengembalikan `{ state, httpStatus }`;
  - berhenti lebih awal bila state ∈ {`Completed`, `Aborted`, `Canceled`} atau timeout.
- **Tambah helper `classifyNextDocument(httpStatus)`** → `"page" | "end" | "busy" | "fatal"`, dengan
  pemetaan: `200→page`, `404→end`, `406→end` (atau `busy` pada profil vendor tertentu),
  `409/503→busy`, lainnya `>=500→busy` (retry terbatas) / `4xx lain→fatal`.
- **Konfigurasi retry/backoff** sebagai konstanta bernama:
  `MIN_NEXT_DOC_DELAY_MS = 300`, `MAX_NEXT_DOC_DELAY_MS = 2000`, `NEXT_DOC_MAX_RETRY = 5`,
  `POLL_INTERVAL_MS = 500`, `POLL_BACKOFF = 1.5`, `PER_PAGE_TIMEOUT_MS = 30000`,
  `JOB_TOTAL_TIMEOUT_MS = 600000`.
- **Profil vendor:** `interface EsclVendorProfile { busyStatuses: number[]; endStatuses: number[]; minDelayMs: number; supportsStatusPoll: boolean }`
  dan fungsi `resolveVendorProfile(vendor?: string): EsclVendorProfile`. Default Canon/Epson/tak dikenal.
- **Loop baru ADF** (menggantikan `api.ts:145-163`):
  1. set jeda awal dari profil;
  2. (opsional) `pollJob` sampai siap;
  3. tunggu `minDelayMs` (jeda minimum);
  4. panggil `NextDocument`; klasifikasikan;
  5. `page` → push blob, tambah `scanned++`, reset backoff;
     `busy` → naikkan backoff, retry (hingga `NEXT_DOC_MAX_RETRY`), bila habis → **hentikan dengan tanda
     `stoppedEarly` dan pesan jelas** (bukan sukses senyap);
     `end` → break normal;
     `fatal` → throw dengan nomor lembar;
  6. bila `pageNum > ADF_MAX_PAGES` → set `reachedLimit = true`, break.
- **Timeout per-request** di setiap `fetch` (`NextDocument`, `pollJob`) memakai
  `AbortController` internal yang digabung dengan `req.signal` (mis. via `AbortSignal.any([...])`
  atau `setTimeout` yang memanggil `abort`), agar tidak bergantung pada timeout 90 dtk proxy.
- **`ScanResult`**: ubah tanda tangan `requestScan` menjadi
  `Promise<{ blobs: Blob[]; scanned: number; stoppedEarly: boolean; reachedLimit: boolean; reason?: string }>`
  (atau tambahkan tipe baru `ScanOutcome`) — perlu penyesuaian tipe pemanggil.
- **Batas maksimal lembar yang realistis**: pertimbangkan menurunkan default menjadi **30** atau
  menjadikannya konfigurasi UI (`scan-config-panel`) dengan peringatan eksplisit, karena 50 lembar
  pada resolusi tinggi mudah menghabiskan memori (lihat `docs/docstation-audit-engine.md` temuan OOM).

### 4.3 Perubahan konkret di `use-docstation.ts` & UI

- `addImageBlobs` (saat ini `use-docstation.ts:130-152`) mengembalikan `{ added: number; skipped: number }`
  alih-alih `void` (perubahan tipe kecil, pemanggil lain di-update).
- `scan` (saat ini `use-docstation.ts:190-227`) mengembalikan `ScanOutcome`; pada jalur
  `AbortError` (baris 210-212) tetap `return` tetapi sertakan `scanned` yang sudah terkumpul.
- `docstation-app.tsx` (handler scan) menampilkan `toast` sesuai 4.1 (sukses/batas/batal/gagal),
  termasuk jumlah lembar.
- (Opsional) `scan-config-panel.tsx`: tampilkan progres "lembar ke-N" yang sudah ada melalui
  `onProgress`, plus indikator `Menyelesaikan…` saat polling status.

### 4.4 Risiko / regresi

- **Job menggantung.** Bila `pollJob` menunggu state yang tak pernah datang (firmware tidak melaporkan
  `Completed`), loop bisa menahan UI sampai `JOB_TOTAL_TIMEOUT_MS`. Mitigasi: timeout keras + selalu
  `DELETE` job di `finally` (sudah ada di `api.ts:167-175`, pertahankan), dan jangan bergantung mutlak
  pada `pollJob` (selalu ada jalur fallback `NextDocument`).
- **Scanner tetap sibuk.** Bila kita berhenti prematur tanpa `DELETE` job, scanner tetap `Processing`
  dan `ScanJobs` berikutnya bisa `503`. Mitigasi: pastikan `finally` menghapus job **sebelum** melempar
  error; dan catatan bahwa backend hanya membersihkan stuck job untuk printer `secure`
  (`docstation_handler.go:365-369`) — vendor non-secure yang macet tidak dibersihkan otomatis.
- **Duplikasi halaman.** Retry `NextDocument` yang **sebenarnya berhasil** tetapi responsnya
  terputus dapat memindai ulang? Tidak — eSCL menarik lembar berikutnya saat `NextDocument` dipanggil;
  namun **retry setelah error jaringan** bisa memicu satu lembar dilewati (bila perangkat sudah
  menarik lembar tapi respons hilang) atau sebaliknya. Mitigasi: idempotensi tidak tersedia di eSCL;
  batasi retry pada kode yang aman (`409/503`), jangan retry pada koneksi terputus tanpa membedakan
  status, dan dokumentasikan trade-off.
- **Batas 50 terlampaui.** Menambah retry dapat memperpanjang waktu hingga mendekati batas; pastikan
  `reachedLimit` dikomunikasikan dan sisa tumpukan dijelaskan (T5). Pertimbangkan turunkan default.
- **Beda firmware.** Profil Canon vs Epson hanyalah heuristik; unit baru/versi firmware lain bisa
  berperilaku berbeda. Mitigasi: profil _data-driven_ (mudah ditambah), logging kode status
  per-`NextDocument` untuk diagnosis lapangan, dan diagnostik "mode kompatibilitas" di UI.
- **Regresi tipe.** Mengubah tanda tangan `requestScan`/`addImageBlobs` menyentuh pemanggil
  (`use-docstation.ts`, `docstation-app.tsx`). Perlu update serentak dan uji scan Platen (tanpa ADF)
  agar tidak ikut rusak.
- **Tes.** Tambahkan tes unit untuk `classifyNextDocument` dan `resolveVendorProfile` (murni fungsi),
  serta tes loop dengan `fetch` ter-mock yang mensimulasikan 200→200→503→200→404.

---

## Kesimpulan

Loop `NextDocument` di `lib/docstation/api.ts:145-163` adalah titik paling rapuh dalam alur ADF
DocStation: ia memperlakukan **semua** respons non-2xx sebagai akhir dokumen, tidak pernah memberi jeda,
tidak mempol status job, tidak mengenali perbedaan Canon/Epson, dan tidak pernah melaporkan berapa
lembar yang benar-benar berhasil. Rencana di atas menambahkan polling status + backoff, jeda minimum,
klasifikasi kode akhir-dokumen (404/406) dan sibuk (409/503), profil vendor, serta pelaporan
"berhasil X lembar" — dengan risiko yang diidentifikasi eksplisit.

**Ditegaskan kembali: riset ini READ-ONLY. Tidak ada kode produksi yang diubah.** Hanya dokumen ini
(`docs/docstation-research-adf.md`) yang ditulis.
