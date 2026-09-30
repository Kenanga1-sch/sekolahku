# Audit Frontend DocStation

Audit kode frontend modul DocStation (`app/(dashboard)/docstation/**`) dari empat sudut saja:
(1) race condition state React, (2) memory leak, (3) aksesibilitas, (4) UX saat gagal/offline.

Cakupan file yang dibaca: `page.tsx`, seluruh `_components/*.tsx`
(canvas-overlay, docstation-app, editor-studio, editor-toolbar, inline-progress,
mode-picker, page-strip, print-options-panel, printer-status-badge, save-panel,
scan-config-panel, upload-panel, wizard-stepper, types), dan `_hooks/*`
(use-docstation.ts, use-opencv.ts, use-printer-status.ts), beserta pendukung
`lib/docstation/{api,canvas,state,vendor-loader}.ts` dan `cloud-storage/_components/folder-picker-dialog.tsx`.

Catatan: audit ini **tidak mengubah kode produksi apa pun**. Hanya dokumen ini yang ditulis.

## Ringkasan

- Ada **18 temuan**: 2 Critical, 6 High, 7 Medium, 3 Low.
- Masalah paling berbahaya bukan pada algoritma gambar, tetapi pada **penanganan lifecycle async**:
  `setState` setelah unmount pada polling printer dan pipeline auto-enhance, AbortController yang
  tidak pernah digosok ke proses PDF/worker, dan tidak adanya guard double-submit pada aksi cetak/simpan.
- **Deteksi offline praktis absen**: semua kegagalan jaringan (`TypeError: Failed to fetch`) diperlakukan
  identik dengan "printer offline" atau "ready", sehingga pengguna tak pernah tahu bedanya server mati,
  jaringan putus, atau printer memang tidur.
- **Aksesibilitas cukup di beberapa tempat tapi konsisten lemah di target sentuh** (banyak kontrol 16–40px),
  dan tidak ada fokus trap di dialog folder maupun pengumuman error yang terhubung ke kontrol.
- **Race lama OpenCV/worker** (INITIALIZED menukar hasil) sudah ditutup lewat korelasi `requestId`, tetapi
  jalur kegagalan `load()` justru menutupi error nyata dengan status `ready`.

## Temuan

### F1 — Critical — `setState` setelah unmount pada polling status printer

- **Lokasi**: `_hooks/use-printer-status.ts:22-40`
- **Bukti**:
  ```ts
  const refresh = useCallback(async () => {
    try {
      const data = await fetchStatus();
      setPrinters(data.printers);
      if (data.defaultPrinter) setDefaultPrinter(data.defaultPrinter);
    } catch {
      setPrinters((prev) => prev.map((p) => ({ ...p, online: false })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);
  ```
- **Dampak**: `clearInterval` hanya mencegah tick berikutnya. `fetchStatus()` yang **sedang berjalan**
  saat komponen unmount tetap akan resolve dan memanggil `setPrinters`/`setLoading` pada komponen yang
  sudah dilepas (React warning/memory retention). Karena tidak ada `AbortController`, request yang
  menggantung juga menahan closure hook. Pada jaringan lambat, ini berpotensi menumpuk banyak request
  yang resolve bersamaan dan saling menimpa (`setPrinters` order tidak dijamin).
- **Rekomendasi**: simpan `AbortController` per-refresh, batalkan di cleanup effect, dan guard dengan
  flag `mountedRef`. Teruskan `signal` ke `fetchStatus`.

### F2 — Critical — Pipeline auto-enhance massal tidak bisa dibatalkan dan menulis state setelah unmount

- **Lokasi**: `_components/editor-studio.tsx:262-286`
- **Bukti**:
  ```ts
  useEffect(() => {
    if (!autoEnhanceOnLoad || autoEnhancedRef.current) return;
    if (doc.pages.length === 0) return;
    autoEnhancedRef.current = true;
    (async () => {
      doc.setBusy(true, "Perbaikan otomatis semua halaman…");
      try {
        const ids = doc.stateRef.current.pages.map((p) => p.id);
        for (const id of ids) {
          await pipelinePage(id, "color");
        }
        toast.success("Perbaikan otomatis selesai untuk semua halaman");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Perbaikan otomatis gagal",
        );
      } finally {
        doc.setBusy(false);
        doc.selectPage(doc.stateRef.current.activeId ?? "");
      }
    })();
  }, [autoEnhanceOnLoad, doc.pages.length]);
  ```
- **Dampak**: Loop `for` sekuensial memproses hingga 50 halaman (batas ADF) tanpa `AbortSignal`.
  Jika pengguna pindah mode (`reset()` → `resetSession()` mengosongkan `engine.pages`) atau meninggalkan
  halaman saat pipeline berjalan, iterasi lanjut memanggil `applyImageDataForPage` dengan halaman yang
  sudah dihapus/di-unmount, lalu `setBusy(false)`, `toast.*`, dan `doc.selectPage(...)` menulis state pada
  komponen yang sudah lepas. Ini kombinasi race state + kerja sia-sia + potensi memori tak lepas.
- **Rekomendasi**: sediakan `AbortSignal`/flag `cancelledRef` yang dicek tiap iterasi; hentikan loop
  bila `autoEnhancedRef`/mount flag berubah; jangan panggil `setBusy`/`selectPage` setelah unmount.

### F3 — High — Tidak ada guard double-submit pada cetak & simpan

- **Lokasi**: `_components/docstation-app.tsx:257-292` (onPrint), `_components/print-options-panel.tsx:181-189`
- **Bukti**:
  ```tsx
  <Button onClick={onPrint} className="gap-2">
    <Printer className="h-4 w-4" />
    Cetak Sekarang
  </Button>
  ```
  ```tsx
  onPrint={async () => {
    try {
      if (readyToPrint && doc.pages.length > 0) {
        const printable = await buildPrintFiles();
        await doc.print(printable, printPrinterIp, printConfig.method);
        ...
  ```
- **Dampak**: `PrintOptionsPanel` tidak menerima prop `busy`, dan tombol tidak pernah disabled selama
  `onPrint` berjalan. `onPrint` merupakan async tanpa lock lokal; klik berulang (umum pada printer
  jaringan lambat) mengirim **pekerjaan cetak duplikat** karena `doc.print` melakukan loop
  `sendPrintFile` tanpa dedup. Di jaringan lambat operator bisa menekan tombol 3–5 kali.
- **Rekomendasi**: tambahkan state `submitting` di panel/orchestrator, disable tombol selama promise
  berjalan, dan guard idempotensi (mis. `if (printingRef.current) return`).

### F4 — High — `load()` OpenCV menelan semua error dan tetap menyatakan `ready`

- **Lokasi**: `_hooks/use-opencv.ts:183-196`
- **Bukti**:
  ```ts
  } catch {
    if (!cancelledRef.current) {
      // Gagal unduh OpenCV bukan fatal — pure-JS tetap jalan.
      setState((s) => ({ ...s, status: "ready" }));
    }
  } finally {
  ```
- **Dampak**: kegagalan unduh (404, CORS, offline) disamarkan sebagai `ready`. UI
  (`editor-toolbar.tsx` badge `CV_STATUS_LABEL`) menampilkan "OpenCV Aktif" padahal engine sebenarnya
  pure-JS, sehingga operator salah mendiagnosis kualitas hasil. Ini juga mencegah retry: karena `status`
  kini `ready`, `load()` berikutnya **langsung `return`** di baris `if (state.status === "ready") return;`
  dan tak pernah mencoba ulang. Saat offline, pengguna tidak dapat memicu ulang.
- **Rekomendasi**: perkenalkan status `error` sungguhan, tambahkan tombol "Coba lagi", dan jangan
  menandai `ready` bila ada kegagalan fetch yang bukan pembatalan.

### F5 — High — Deteksi offline tidak ada; semua kegagalan disamaratakan

- **Lokasi**: `_hooks/use-printer-status.ts:29-31`, `_components/printer-status-badge.tsx:11-31`
- **Bukti**:
  ```ts
  } catch {
    setPrinters((prev) => prev.map((p) => ({ ...p, online: false })));
  }
  ```
  ```tsx
  const anyOnline = onlineCount > 0;
  ...
  {anyOnline ? `${onlineCount} Printer Online` : "Printer Offline"}
  ```
- **Dampak**: `catch` tidak membedakan `TypeError: Failed to fetch` (server/browser offline) dari
  printer yang benar-benar offline. Badge akan menampilkan "Printer Offline" merah bahkan saat perangkat
  pengguna kehilangan koneksi (bukan printer). Tidak ada pemanfaatan `navigator.onLine` maupun
  listener `online`/`offline`. Operator mendapat informasi menyesatkan.
- **Rekomendasi**: bedakan status "offline (perangkat)" via `navigator.onLine` + event `online`/`offline`;
  tampilkan pesan berbeda ("Tidak ada koneksi internet/jaringan") dan tampilkan `loading` sebelum
  hasil pertama tiba (lihat F6).

### F6 — High — Badge printer menampilkan "Offline" sebelum pemuatan pertama selesai

- **Lokasi**: `_components/printer-status-badge.tsx:8-30`
- **Bukti**:
  ```tsx
  const onlineCount = printers.filter((p) => p.online).length;
  const anyOnline = onlineCount > 0;
  // ... dirender tanpa memperhatikan `loading`
  ```
- **Dampak**: `usePrinterStatus` menginisialisasi `printers = []` dan `loading = true`, tetapi badge
  tidak menerima `loading`. Pada mount, sebelum respons pertama, badge langsung menampilkan
  "Printer Offline" merah. Ini flash status salah yang meresahkan, dan bertentangan dengan nilai
  `loading` yang sudah tersedia di hook (tidak dimanfaatkan).
- **Rekomendasi**: kirim `loading` ke badge; render state netral ("Memeriksa printer…") hingga
  pemuatan pertama selesai.

### F7 — High — `resetSession` dipanggil pada pemilihan mode tanpa peringatan (kehilangan pekerjaan)

- **Lokasi**: `_components/docstation-app.tsx:74-91`
- **Bukti**:
  ```ts
  const selectMode = useCallback(
    (m: DocStationMode) => {
      setMode(m);
      setStep(2);
      setReadyToPrint(false);
      doc.resetSession();
    },
    [doc.resetSession],
  );

  const reset = useCallback(() => {
    setMode(null);
    setStep(1);
    doc.resetSession();
  }, [doc.resetSession]);
  ```
- **Dampak**: `resetSession` mencegah kebocoran object URL (baik), tetapi dipanggil tanpa konfirmasi
  ketika pengguna menekan tombol "Kembali"/ganti mode. Jika pengguna sedang mengedit banyak halaman ADF
  lalu keliru menekan "Kembali", seluruh halaman dan anotasi terhapus seketika tanpa dialog dan tanpa
  undo. Tidak ada race per se, tetapi interaksi "tekan sekali = hilang semua" adalah UX gagal yang berat.
- **Rekomendasi**: tampilkan dialog konfirmasi bila `doc.pages.length > 0`, atau simpan snapshot sesi.

### F8 — High — AbortController simpan tidak menghentikan pembuatan PDF, hanya upload

- **Lokasi**: `_components/save-panel.tsx:105-171`
- **Bukti**:
  ```ts
  const aborter = new AbortController();
  abortRef.current = aborter;
  ...
  if (config.format === "pdf") {
    await loadPdfLib();
    const bytes = await createPdf(engine, engine.pages, { ... });
    const file = { name: `${baseName}.pdf`, bytes, contentType: "application/pdf" };
  ```
  dan tombol batal:
  ```tsx
  <button type="button" onClick={() => abortRef.current?.abort()} ...>
  ```
- **Dampak**: `aborter.signal` hanya diteruskan ke `uploadToCloud`/`uploadFileWithProgress`. Fase
  `createPdf` (sinkron-berat, bisa detik-an untuk banyak halaman) dan `renderPageToCanvas` untuk JPG/PNG
  tidak bisa dibatalkan. Menekan "Batalkan unggahan" saat tahap PDF membuat pengguna mengira proses
  berhenti padahal pipeline PDF terus berjalan dan `setBusy(false)` baru terjadi di `finally`. Tidak ada
  indikator progres tahap PDF, sehingga tampak "hang".
- **Rekomendasi**: pisahkan status tahap (menyusun PDF vs mengunggah), tampilkan progres penyusunan,
  dan cek `aborter.signal.aborted` di antara halaman.

### F9 — Medium — `scan()` memakai `scanning` dari closure; guard anti-dobel rapuh

- **Lokasi**: `_hooks/use-docstation.ts:190-227`
- **Bukti**:
  ```ts
  const scan = useCallback(
    async (config: ScanConfig) => {
      if (scanning) return;
      const aborter = new AbortController();
      scanAbortRef.current = aborter;
      setScanning(true);
      ...
    },
    [addImageBlobs, scanning],
  );
  ```
- **Dampak**: `scanning` masuk ke dependency, sehingga `scan` dibuat ulang setiap toggle dan nilai yang
  dibaca adalah dari render saat handler dibuat. Dua klik cepat pada "Mulai Pindai" dalam render yang
  sama dapat lolos guard `if (scanning) return` (nilai `scanning` masih `false`), memulai dua
  `requestScan` yang menimpa `scanAbortRef.current` — lewat `cancelScan` hanya satu yang dibatalkan.
  Selain itu `setScanning(false)` di `finally` bisa menyalakan kembali UI sementara scan kedua berjalan.
- **Rekomendasi**: gunakan guard berbasis ref (`scanningRef.current`) bukan state sebagai penjaga, atau
  disable tombol dengan state `scanning` yang sama di panel.

### F10 — Medium — `useOpenCV.load()` dapat berjalan ganda; reader tidak ditutup saat unmount

- **Lokasi**: `_hooks/use-opencv.ts:110-201`
- **Bukti**:
  ```ts
  const load = useCallback(async () => {
    if (state.status === "ready") return;
    cancelledRef.current = false;
    setState({ ...initialState, status: "loading" });
    ...
    readerRef.current = response.body.getReader();
  }, [ensureWorker, state.status]);
  ```
  Cleanup unmount (`:220-238`) hanya membersihkan `pendingRef`, `initWaitersRef`, dan `terminate()` worker —
  **tidak** memanggil `readerRef.current?.cancel()`.
- **Dampak**: `state.status` adalah closure; dua pemanggilan `load()` dalam tick yang sama (editor-studio
  memanggil `void cv.load()` pada mount, dan alur lain bisa memicunya) sama-sama melihat `status !== "ready"`
  dan memulai dua `fetch` penuh (~8 MB). Karena hanya `readerRef.current` yang dipegang (satu slot),
  reader pertama menjadi yatim. Saat unmount di tengah unduhan, `reader` tidak di-`cancel()`, sehingga
  unduhan terus berjalan dan menahan buffer di memori.
- **Rekomendasi**: guard dengan ref `loadingRef`/`loadPromiseRef` (single-flight), dan `cancel()` reader
  di cleanup unmount.

### F11 — Medium — `onError` di CanvasOverlay adalah dead code (proses render tak pernah laporkan galat)

- **Lokasi**: `_components/canvas-overlay.tsx:74` (prop) dan `:307`
- **Bukti**:
  ```tsx
  onError?: (message: string) => void;
  ...
  {onError ? null : null}
  ```
- **Dampak**: `renderPageToCanvas` di `render()` (`:84-97`) dipanggil tanpa try/catch. Bila render
  gagal (mis. `getContext` null, atau gambar belum siap), kegagalan terlempar ke event handler dan
  pengguna hanya melihat kanvas kosong tanpa pesan apa pun. Prop `onError` yang disediakan jelas
  dimaksudkan untuk ini tetapi tidak pernah dipakai — jadi jalur error tidak pernah ditangkap.
- **Rekomendasi**: bungkus `render()` dengan try/catch dan panggil `onError`, lalu tampilkan fallback
  UI (mis. "Gagal menampilkan pratinjau").

### F12 — Medium — Hapus berkas berdasarkan nama → salah hapus saat nama duplikat

- **Lokasi**: `_components/upload-panel.tsx:106` dan `_components/docstation-app.tsx:233`
- **Bukti**:
  ```tsx
  onRemoveFile={(name) => setPrintFiles((prev) => prev.filter((f) => f.name !== name))}
  ```
  ```tsx
  {files.map((f) => ( <li key={f.name} ...>
  ```
- **Dampak**: `key` dan identitas penghapusan memakai `f.name`. Mengunggah dua berkas bernama sama
  (umum: `scan.pdf`, `IMG_0001.jpg`) menimbulkan key duplikat (React reconciliation keliru) dan
  menghapus satu akan menghapus **semua** berkas bernama sama. Tidak ada validasi ukuran maksimum, jadi
  berkas ratusan MB bisa masuk dan memicu OOM saat `f.arrayBuffer()`.
- **Rekomendasi**: pakai id unik (mis. `crypto.randomUUID`) untuk key & penghapusan; validasi
  `f.size` terhadap batas wajar dan tampilkan pesan bila melebihi.

### F13 — Medium — Autosuspend render ulang kanvas bergantung daftar dependency rapuh

- **Lokasi**: `_components/canvas-overlay.tsx:100-116`
- **Bukti**:
  ```ts
  useEffect(() => {
    render();
  }, [
    render,
    zoom,
    page?.rotation,
    page?.fineRotation,
    page?.contrast,
    page?.brightness,
    page?.grayscale,
    page?.gamma,
    page?.flipH,
    page?.flipV,
    page?.sourceUrl,
  ]);
  ```
- **Dampak**: `render` sendiri sudah bergantung `[page, state]`, tetapi `state` adalah objek mutable
  yang sama sepanjang hidup sesi (dari `stateRef`). Perubahan piksel nyata (mis. hasil `applyImageData`
  mengganti `page.image`) hanya terdeteksi bila identitas pagemu ter-refresh. Ketergantungan pada banyak
  field opt-`?` mudah luput saat model halaman bertambah field baru, sehingga perubahan tidak memicu
  render ulang (kanvas basi). Ini jenis bug "stale tampilan" yang sulit dilacak.
- **Rekomendasi**: gunakan pola versi eksplisit (mis. `page.renderVersion` yang di-increment mesin
  setiap mutasi gambar) sebagai satu-satunya trigger, bukan enumerasi field.

### F14 — Medium — Tidak ada penanganan konfirmasi/keyboard pada dialog pemilih folder

- **Lokasi**: `_components/save-panel.tsx:283-296` (pemakaian) dan `cloud-storage/_components/folder-picker-dialog.tsx`
- **Bukti**: `FolderPickerDialog` merender `Dialog`/`DialogContent` tetapi setiap baris folder adalah
  `<button>` biasa; tidak ada `role`/focus management khusus, dan `onPick` langsung ditutup tanpa
  verifikasi. Tidak ada indikasi fokus awal.
- **Dampak**: pembukaan dialog tidak memindahkan fokus ke dalam dialog secara eksplisit (bergantung pada
  implementasi `Dialog` shadcn). Bila basis komponen tidak menangkap fokus/Escape dengan benar, pengguna
  keyboard bisa "keluar" ke konten di belakang. Tidak ada pesan bila daftar folder gagal dimuat —
  `load()` `catch { setFolders([]) }` menampilkan "Tidak ada subfolder di sini" walau sebenarnya error
  jaringan, sehingga pengguna mengira folder benar-benar kosong (lihat F16).
- **Rekomendasi**: pastikan `DialogContent` men-trap fokus dan mengembalikan fokus ke tombol pemicu saat
  tutup; bedakan state "gagal memuat" dari "kosong" dengan pesan + tombol coba lagi.

### F15 — Medium — Tombol kontrol editor berukuran 40×40 px (< 44 px target sentuh)

- **Lokasi**: `_components/editor-toolbar.tsx:104-119`
- **Bukti**:
  ```tsx
  className={cn(
    // 40px ≈ target sentuh minimum yang nyaman di ponsel.
    "flex h-10 w-10 items-center justify-center rounded-lg border ...",
  ```
- **Dampak**: Klaim komentar tidak akurat: pedoman target sentuh minimum yang diterima umumnya 44×44 px
  (WCAG 2.5.5 / Apple HIG). Tombol toolbar berukuran 40×40 px dan diletakkan rapat
  (`gap-2`), sehingga sulit ditekan akurat di perangkat sentuh — dan toolbar ini adalah alur utama
  pengeditan hasil scan di ponsel. Margin kelewat kecil juga meningkatkan salah tekan pada tombol
  destruktif ("Reset edit", "Hapus strip tepi ADF").
- **Rekomendasi**: besarkan target sentuh minimal 44×44 (mis. `h-11 w-11`) dan beri jarak antar tombol.

### F16 — Low — `onAddFiles` tidak melakukan dedup / memberi umpan balik file tak didukung

- **Lokasi**: `_components/upload-panel.tsx:44-50, 62-67`
- **Bukti**:
  ```ts
  const handleDrop = (e: React.DragEvent) => {
    ...
    const dropped = Array.from(e.dataTransfer.files).filter(accepted);
    if (dropped.length > 0) onAddFiles(dropped);
  };
  ```
- **Dampak**: berkas yang ditolak filter `accepted` dibuang tanpa pesan ("2 berkas diabaikan karena
  format tidak didukung"). Berkas yang sama bisa ditambahkan berulang kali (tidak ada dedup), lalu
  muncul di daftar dengan key duplikat (lihat F12). Pengguna tak tahu mengapa sebagian berkas "hilang".
- **Rekomendasi**: hitung `rejected = totalDropped - dropped.length`, tampilkan peringatan, dan
  dedup berdasarkan nama+ukuran dengan id unik.

### F17 — Low — Tidak ada retry/mekanisme ulang pada kegagalan scan & cetak

- **Lokasi**: `_components/docstation-app.tsx:160-172` (scan), `:257-292` (print)
- **Bukti**:
  ```tsx
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Gagal memindai dokumen");
  }
  ```
- **Dampak**: saat `requestScan`/`sendPrintFile` gagal karena jaringan putus sesaat, satu-satunya
  respons adalah toast yang hilang otomatis. Tidak ada tombol "Coba lagi" pada UI; pengguna harus
  mengulang langkah secara manual dan menebak apa yang gagal. Untuk ADF multi-lembar, kegagalan di
  tengah proses tidak memberi tahu berapa lembar sudah tersimpan sebagian.
- **Rekomendasi**: pertahankan konfigurasi terakhir dan tampilkan aksi "Coba lagi" pada kegagalan;
  untuk ADF partikan jumlah lembar yang berhasil saat error.

### F18 — Low — Overlay kanvas hanya fokusabel saat mode crop

- **Lokasi**: `_components/canvas-overlay.tsx:281-292`
- **Bukti**:
  ```tsx
  tabIndex={cropMode && !busy ? 0 : -1}
  role="application"
  aria-label={cropMode ? "Area crop — ..." : "Kanvas anotasi"}
  ```
- **Dampak**: saat mode anotasi (brush/eraser/highlighter) aktif, kanvas `tabIndex={-1}`, sehingga
  pengguna keyboard tidak dapat memfokuskan/menggambar sama sekali — fitur anotasi praktis
  keyboard-inaccessible. `role="application"` pada kanvas anotasi juga membebaskan pembaca layar dari
  mode browse tanpa menyediakan perintah alternatif yang terdokumentasi, sehingga bisa memperburuk
  pengalaman screen reader.
- **Rekomendasi**: buat kanvas fokusabel saat `tool` aktif juga; sediakan padanan keyboard atau
  minimal deskripsi aksi alternatif, dan pertimbangkan `role="img"` + petunjuk bila anotasi tak bisa
  diakses keyboard.

## Prioritas Perbaikan

P0 (perbaiki segera — berisiko kehilangan data / memori):

1. **F2** — batalkan pipeline auto-enhance saat unmount/ganti mode; jangan `setBusy`/`toast` setelah lepas.
2. **F1** — `AbortController` + flag mount pada `usePrinterStatus` untuk menghentikan `setState` pasca-unmount.
3. **F3** — guard double-submit pada cetak & simpan (disable tombol + ref lock).
4. **F7** — dialog konfirmasi sebelum `resetSession` menghapus pekerjaan.

P1 (korektnya informasi & aksesibilitas inti): 5. **F4 + F5 + F6** — status error/offline sungguhan, state loading badge, dan bedakan offline perangkat vs printer. 6. **F15** — naikkan target sentuh toolbar ke ≥44px. 7. **F8** — hentikan tahap penyusunan PDF via sinyal dan tampilkan progres bertahap.

P2 (kualitas & ketahanan): 8. **F9 + F10** — guard single-flight berbasis ref untuk `scan()` dan `load()`; tutup reader saat unmount. 9. **F12 + F16** — identitas berkas unik, dedup, dan umpan balik berkas ditolak + batas ukuran. 10. **F11 + F13** — tangkap error render kanvas; trigger render via versi eksplisit.

P3 (penyempurnaan): 11. **F14** — fokus trap dialog pemilih folder + bedakan "gagal memuat" dari "kosong". 12. **F17** — aksi "coba lagi" pada kegagalan scan/cetak. 13. **F18** — aksesibilitas keyboard untuk mode anotasi.
