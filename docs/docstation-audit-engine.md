# Audit Engine DocStation — Worker, OpenCV & Pipeline Gambar

Tanggal: 2026-02 (audit statis, tanpa menjalankan runtime)
Cakupan:

- `public/docstation/worker.js`
- `lib/docstation/api.ts`
- `lib/docstation/canvas.ts`
- `lib/docstation/editor.ts`
- `lib/docstation/pdf.ts`
- `lib/docstation/state.ts`
- `lib/docstation/vendor-loader.ts`
- `app/(dashboard)/docstation/_hooks/use-opencv.ts`
- (konteks konsumen) `app/(dashboard)/docstation/_components/editor-studio.tsx`, `_hooks/use-docstation.ts`

Fokus audit: (1) protokol `postMessage` worker, (2) kebocoran memori OpenCV
`Mat`/buffer besar, (3) validasi hasil image transferable & klaim zero-copy,
(4) batas dimensi/gambar ekstrem.

---

## Ringkasan

Secara umum protokol worker sudah lebih matang dari versi lama: ada `requestId`
untuk korelasi, ada `assertImageResult` di sebagian jalur konsumen, ada
`try/finally` untuk `Mat.delete()` pada blok OpenCV, dan `pendingRef` di hook
di-reject saat unmount. Namun masih ada beberapa kelemahan nyata:

- **Korelasi belum lengkap** dan protokol tidak simetris: worker tidak pernah
  mengirim balasan error eksplisit untuk `type` tak dikenal / payload rusak,
  sehingga request bisa **menggantung sampai timeout 120 s** walau worker
  sudah tahu tidak bisa memprosesnya.
- **Tidak ada pemulihan setelah worker crash**: `onerror` menolak semua task
  tapi worker mati tidak dibuat ulang — semua operasi berikutnya hang.
- **Validasi hasil tidak konsisten**: jalur `runEnhance` (ENHANCE_BW/DESPECKLE/
  PUNCH_HOLE) hanya memeriksa `result.error`, tidak memanggil
  `assertImageResult` seperti jalur lain → hasil null/corrupt bisa lolos ke
  `applyImageData`.
- **Klaim "zero-copy" pada `takeTransferable` tidak benar**: ImageData disalin
  penuh (`copy.set(src)`) sebelum buffer di-transfer; yang dihemat hanya
  structured-clone, bukan salinan piksel.
- **Beberapa algoritma pure-JS mengalokasikan buffer float raksasa tanpa guard
  dimensi** (MSRCR ±7 buffer `Float32Array` seukuran gambar, Sauvola 2 integral
  image), berpotensi OOM di perangkat lemah. Worker tetap menerima lebar/tinggi
  apa pun asal dari pemanggil.
- **Beberapa `cv.Mat`/resource OpenCV berpotensi bocor** (`cv.Size` yang
  di-`push` ke array `mats` lalu dipanggil `.delete()`; `MatVector`/`contours`
  yang tidak selalu `delete()` anggotanya pada jalur error).
- **Tidak ada timeout/abort internal di worker**: task yang melebihi timeout
  main thread tetap berjalan dan menahan buffer besar sampai selesai.

Tingkat keparahan: 3 Critical, 4 High, 4 Medium, 2 Low.

---

## Temuan

### [Critical] Pesan tak dikenal / payload rusak tidak dibalas → request menggantung sampai timeout

- **Lokasi:** `public/docstation/worker.js:411` (blok `default:`), `worker.js:37` (`self.onmessage`), dan `app/(dashboard)/docstation/_hooks/use-opencv.ts:255` (timeout `run()`).
- **Bukti kode:**

  ```js
  // worker.js — blok default hanya mencatat, TIDAK membalas
  default:
      console.warn('[DocStation Worker] Pesan tidak dikenal:', type);
  ```

  ```ts
  // use-opencv.ts — resolve hanya terjadi saat worker membalas requestId yang cocok
  const timer = setTimeout(() => {
    if (pendingRef.current.delete(requestId)) {
      reject(new Error("Worker timeout — coba lagi atau kecilkan resolusi"));
    }
  }, WORKER_TASK_TIMEOUT_MS); // 120000 ms
  ```

- **Dampak:** Jika `type` salah/baru/typo, atau pengiriman gagal sebagian, worker diam dan main thread menunggu **penuh 120 detik** sebelum error. UX membeku (tombol busy) selama 2 menit untuk kondisi yang seharusnya bisa gagal cepat. Karena `job()`/`reply()` tidak dipanggil di `default`, tidak ada peluang korelasi lain.
- **Rekomendasi:** Di blok `default`, balas eksplisit: `reply('ERROR', { error: 'Pesan tidak dikenal: ' + type, code: 'UNKNOWN_TYPE' }, [], requestId)`. Bungkus seluruh body `onmessage` dengan `try/catch` yang juga membalas `ERROR` bila `requestId` ada. Turunkan timeout default (mis. 30–45 s) dan bedakan per operasi (`AUTO_PIPELINE` boleh lebih lama).

### [Critical] Payload rusak (imageData/width/height hilang) diproses diam-diam menghasilkan gambar kosong "valid"

- **Lokasi:** semua `case` worker, mis. `public/docstation/worker.js:53` (`const { imageData, width, height } = payload;`) dan `worker.js:241` (`AUTO_PIPELINE`).
- **Bukti kode:**

  ```js
  const { imageData, width, height } = payload;
  // ...
  const buffer = medianFilter3x3Buffer(imageData, width, height); // imageData undefined → Uint8ClampedArray(undefined) panjang 0
  job('ENHANCE_RESULT', { mode: 'despeckle', width, height, imageData: buffer, ... }, [buffer]);
  ```

  ```js
  function sauvolaBinarizeBuffer(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData); // tanpa cek panjang vs width*height
    ...
  }
  ```

- **Dampak:** `new Uint8ClampedArray(undefined)` menghasilkan buffer panjang 0; loop membaca `undefined`/NaN menjadi 0. Fungsi mengembalikan buffer "sukses" dengan dimensi klaim `width`/`height`. Karena tidak ada cek `buffer.byteLength === width*height*4`, hasil kosong/rusak bisa lolos ke `applyImageDataToPage` (`editor.ts`) lalu di-`putImageData` → `ImageData` dengan panjang tidak cocok → throw di sisi konsumen atau halaman jadi putih/hitam tanpa pesan jelas.
- **Rekomendasi:** Tambahkan guard di awal setiap `case`: validasi `imageData instanceof ArrayBuffer || ArrayBuffer.isView`, `Number.isInteger(width/height)`, `width>0 && height>0`, dan `byteLength === width*height*4`; jika gagal balas `ERROR` dengan requestId.

### [Critical] Tidak ada pemulihan saat worker crash; semua request berikutnya menggantung

- **Lokasi:** `app/(dashboard)/docstation/_hooks/use-opencv.ts:118` (`worker.onerror`), `use-opencv.ts:104` (`ensureWorker`), `use-opencv.ts:140` (`worker.onmessage`).
- **Bukti kode:**

  ```ts
  worker.onerror = () => {
    rejectAllPending(new Error("Worker DocStation gagal (error)"));
  };
  workerRef.current = worker;
  ```

  ```ts
  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current; // worker mati tetap dibalikkan
    ...
  ```

- **Dampak:** Saat worker mengalami OOM/exception fatal (`onerror`), semua pending ditolak, tetapi `workerRef.current` tetap menunjuk worker mati dan tidak di-`terminate()`/diganti. `run()`/`load()` berikutnya memakai worker mati → setiap task baru **menggantung sampai timeout**. Tidak ada `onmessageerror` handler juga. Tidak ada indikator status "error" pada state hook (state hanya `ready`/`loading`).
- **Rekomendasi:** Pada `onerror`: `worker.terminate()`, set `workerRef.current = null`, `setState(status: "error")`, lalu re-create worker saat request berikutnya (atau retry otomatis sekali). Tambahkan `worker.onmessageerror`. Sediakan flag "workerDead" agar `run()` bisa membuat worker baru.

### [High] Validasi hasil tidak konsisten — jalur `runEnhance` tak memakai `assertImageResult`

- **Lokasi:** `app/(dashboard)/docstation/_components/editor-studio.tsx:158` (`runEnhance`) vs `:220` (`runAdvanced`) dan `:280` (`pipelinePage`).
- **Bukti kode:**

  ```ts
  // runEnhance — hanya cek error, tanpa assertImageResult
  const result = await cv.run({ type: messageMap[mode], payload: {...}, transfer });
  if (result.error) throw new Error(String(result.error));
  await doc.applyImageData(result.imageData, result.width, result.height, true);
  ```

  ```ts
  // runAdvanced / pipelinePage — pakai assertImageResult
  if (result.error) throw new Error(String(result.error));
  assertImageResult(result, labels[mode]);
  ```

- **Dampak:** Jalur ENHANCE_BW/DESPECKLE/PUNCH_HOLE bisa menerima balasan tanpa `imageData` valid (mis. hanya `{ mode, width, height, note }` karena `result.error` undefined) lalu `applyImageData(undefined, ...)` → melempar di `new ImageData(new Uint8ClampedArray(undefined), ...)` atau membuat halaman rusak. Cek `result.error` saja tidak menutup kasus field hilang. Inkonsistensi ini memudahkan regresi.
- **Rekomendasi:** Panggil `assertImageResult(result, label)` di **semua** jalur konsumsi hasil gambar (runEnhance, runDeskew sudah pakai cek sendiri, runAutoWarp sudah). Jadikan helper tunggal `applyWorkerImageResult()` yang selalu memvalidasi sebelum `applyImageData`.

### [High] `Mat`/resource OpenCV berpotensi bocor pada jalur error di DETECT_PAPER & PERSPECTIVE_WARP

- **Lokasi:** `public/docstation/worker.js:274` (DETECT_PAPER), `worker.js:152` (PERSPECTIVE_WARP), khususnya `worker.js:162` (`cv.Size` di-`push` ke `mats`).
- **Bukti kode:**

  ```js
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, points); mats.push(srcTri);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [...]); mats.push(dstTri);
  const M = cv.getPerspectiveTransform(srcTri, dstTri); mats.push(M);
  ...
  const dsize = cv.Size(dstWidth, dstHeight); mats.push(dsize); // cv.Size BUKAN cv.Mat, tak punya .delete()
  ```

  ```js
  const c = contours.get(bestIndex); // MatVec->Mat
  const peri = cv.arcLength(c, true);
  const approx = new cv.Mat(); mats.push(approx);
  cv.approxPolyDP(c, approx, 0.02 * peri, true);
  // jika approxPolyDP/rect berikut melempar, c.delete() di bawah tak tereksekusi
  ...
  c.delete();
  ```

- **Dampak:** `cv.Size` di-`push` ke `mats` lalu dipanggil `m.delete()` (dibungkus try/catch "ignore") — efeknya bukan kebocoran, tapi menandakan `mats` dipakai sebagai kumpulan "bereskan apa pun" tanpa tipe. Yang lebih serius: di DETECT_PAPER, `c = contours.get(bestIndex)` di-`delete()` di akhir blok; bila `cv.arcLength`/`approxPolyDP`/`intAt` melempar, `c.delete()` dan `approx` (belum tentu ter-push) tidak dibersihkan → `cv.Mat` wasm bocor. `MatVector.contours` sendiri di-`delete()`, tapi anggotanya bergantung `delete` manual.
- **Rekomendasi:** Pisahkan array `mats` (cv.Mat) dari resource non-Mat. Untuk `contours.get(i)`, gunakan `try/finally` per kontur agar `c.delete()` selalu jalan. Pertimbangkan helper `withMat(fn)` atau cek `typeof m.delete === 'function'` sebelum memanggil.

### [High] MSRCR & Sauvola mengalokasikan buffer float raksasa tanpa batas dimensi → risiko OOM di perangkat lemah

- **Lokasi:** `public/docstation/worker.js:530` (`msrcrEnhanceBuffer`), `worker.js:432` (`sauvolaBinarizeBuffer`), dan `worker.js:241` (`AUTO_PIPELINE` yang memanggil keduanya berantai).
- **Bukti kode:**

  ```js
  const r = new Float32Array(len);
  const g = new Float32Array(len);
  const b = new Float32Array(len);
  const grayF = new Float32Array(len);
  const logR = new Float32Array(len);
  const logG = new Float32Array(len);
  const logB = new Float32Array(len);
  // 7 × len × 4 byte + boxBlur temp/out (2 × len × 4) ≈ 9 buffer float
  ```

  ```js
  // AUTO_PIPELINE memanggil berantai: whiten + flatten + despeckle (+ grayscale/sauvola)
  buffer = whitenBackgroundBuffer(buffer, w, h, strength);
  buffer = flattenIlluminationBuffer(buffer, w, h, 0.8);
  buffer = despeckleStrongBuffer(buffer, w, h);
  ```

- **Dampak:** Untuk gambar 2600×2600 (6.76 MP), MSRCR saja ± 7×6.76M×4 ≈ 189 MB float, ditambah `boxBlurGrayBuffer` (2 buffer per skala, 3 skala) yang berulang. `AUTO_PIPELINE` menumpuk beberapa buffer RGBA (`Uint8ClampedArray` len×4 ≈ 27 MB each) sekaligus tanpa melepas yang sebelumnya (hanya reassign variabel; GC baru jalan belakangan). Di HP kentang ini mudah memicu OOM worker → `onerror` → lihat temuan Critical #3 (semua operasi berikutnya mati).
- **Rekomendasi:** Tambahkan guard dimensi eksplisit di awal setiap `case` berdasarkan operasi (mis. tolak `width*height > N` untuk operasi MSRCR/Sauvola, atau turunkan resolusi di worker sebelum memproses). Bebaskan buffer antara dengan `null`-kan variabel/`if` sebelum alokasi berikutnya. Pertimbangkan memproses dalam tile/bertahap untuk operasi berat.

### [High] Task yang melewati timeout main thread tetap berjalan dan menahan buffer transferable

- **Lokasi:** `app/(dashboard)/docstation/_hooks/use-opencv.ts:255` (timeout) + worker menerima buffer transferable `worker.js:37`.
- **Bukti kode:**

  ```ts
  const timer = setTimeout(() => {
    if (pendingRef.current.delete(requestId)) {
      reject(new Error("Worker timeout — coba lagi atau kecilkan resolusi"));
    }
  }, WORKER_TASK_TIMEOUT_MS);
  ```

- **Dampak:** Saat timeout, main thread menolak Promise dan melupakan task, tetapi worker **tidak dihentikan** dan terus memproses (AUTO_PIPELINE bisa >120 s). Buffer RGBA besar yang sudah di-transfer ke worker masih tertahan di sana sampai komputasi selesai; `postMessage` balasan akhirnya diabaikan (requestId sudah dihapus dari `pendingRef`). Jika pengguna mencoba ulang, task baru mengantre di belakang task raksasa yang masih jalan → efek "menggantung" berantai dan puncak memori ganda.
- **Rekomendasi:** Sediakan mekanisme abort/`CANCEL` ke worker (worker cek flag kooperatif di antara tahap pipeline), atau pecah task panjang menjadi langkah-langkah yang bisa dibatalkan. Saat timeout, putuskan buffer yang dipegang (mis. terminate worker bila dianggap macet).

### [Medium] Klaim "zero-copy" pada `takeTransferable` tidak akurat — tetap ada satu salinan piksel penuh

- **Lokasi:** `app/(dashboard)/docstation/_components/editor-studio.tsx:96` (`takeTransferable`).
- **Bukti kode:**

  ```ts
  const takeTransferable = (imageData: ImageData) => {
    const src = imageData.data;
    const copy = new Uint8ClampedArray(src.length);
    copy.set(src); // salinan penuh dibuat di sini
    return { buffer: copy.buffer, transfer: [copy.buffer] as Transferable[] };
  };
  ```

  Komentar di atasnya mengklaim: _"Buffer dikirim sebagai Transferable (zero-copy) — menghemat satu salinan ~35MB per operasi"_.

- **Dampak:** Karena `getImageData` mengembalikan `ImageData` miliknya sendiri, sebenarnya buffer `imageData.data.buffer` **bisa langsung di-transfer** tanpa salinan `copy.set(src)`. Kode saat ini melakukan salinan penuh (≈27 MB untuk 2600²) sebelum transfer, jadi bukan zero-copy; biaya memori/CPU puncak naik. Pada beban berulang (auto-enhance semua halaman) ini signifikan.
- **Rekomendasi:** Transfer langsung: `const buf = imageData.data.buffer; return { buffer: buf, transfer: [buf] };` (`imageData` tidak dipakai lagi setelah dikirim). Perbarui komentar agar akurat. Pastikan tidak ada pembacaan ulang `imageData` setelah transfer (di `runAutoWarp` sudah ambil ulang dengan `getImageData` baru — pola yang benar).

### [Medium] `imageData.buffer.slice(0)` menyalin buffer OpenCV penuh sebelum transfer (bukan transfer asli)

- **Lokasi:** `public/docstation/worker.js:107` (ENHANCE_BW), `worker.js:167` (PERSPECTIVE_WARP).
- **Bukti kode:**

  ```js
  const outputData = new Uint8ClampedArray(result.data); // salinan 1
  const buffer = outputData.buffer.slice(0);             // salinan 2
  job('ENHANCE_RESULT', { ..., imageData: buffer }, [buffer]);
  ```

  ```js
  const imgData = dst.data;                // view ke heap wasm
  const buffer = imgData.buffer.slice(0);  // salinan penuh
  job('PERSPECTIVE_WARP_RESULT', { ..., imageData: buffer }, [buffer]);
  ```

- **Dampak:** Ada dua salinan penuh buffer hasil sebelum dikirim ke main thread. Ini membuang CPU dan memori puncak (dobel) untuk setiap hasil OpenCV. Memang perlu satu salinan karena `dst.data` adalah view ke heap wasm (tidak bisa di-transfer langsung), tetapi salinan ganda tidak perlu.
- **Rekomendasi:** Cukup satu salinan yang "owned": `const out = new Uint8ClampedArray(result.data); job(..., { imageData: out.buffer }, [out.buffer])` — hilangkan `outputData.buffer.slice(0)`. Untuk `dst.data`, dapat pakai `Uint8ClampedArray.from(dst.data)` sekali lalu transfer `buffer`-nya.

### [Medium] Ownership setelah transfer tidak dijaga — buffer yang sudah di-neuter bisa dipakai ulang

- **Lokasi:** `public/docstation/worker.js:241` (`AUTO_PIPELINE`), `worker.js:53` (pola `new Uint8ClampedArray(imageData)`).
- **Bukti kode:**

  ```js
  case 'AUTO_PIPELINE': {
    const { imageData, width, height } = payload;
    let buffer = new Uint8ClampedArray(imageData).buffer; // salinan; payload.imageData milik worker-side
    ...
  ```

  Di sisi main thread, `payload.imageData` di-transfer sebagai transferable (`editor-studio.tsx` `transfer`), sehingga buffer asal di main thread **di-neuter** (byteLength 0). Di dalam worker, `imageData` adalah buffer yang diterima (valid) — namun pada jalur fallback `catch` beberapa `case` (mis. DESKEW `worker.js:82`) memakai `imageData` yang mungkin sudah dikonsumsi di percobaan pertama.

- **Dampak:** Tidak ada dokumentasi/assert bahwa buffer yang dipakai fallback masih valid. Pada DESKEW, bila blok OpenCV mengubah `imageData` (tidak), fallback memakai nilai lama — tetapi pola ini rapuh: jika suatu saat buffer dikonsumsi dua kali (mis. di-transfer lagi), pembacaan mengembalikan panjang 0 → hasil kosong tanpa error. Tidak ada cek `byteLength` di titik konsumsi fallback.
- **Rekomendasi:** Di worker, salin sekali di awal `case` (`const src = new Uint8ClampedArray(imageData)`) lalu semua fallback memakai `src`, dan beri assert `src.length === width*height*4`. Di main thread, jangan pernah memakai ulang `imageData` setelah `postMessage` transfer.

### [Medium] Tidak ada guard dimensi/resize untuk gambar sangat besar atau piksel ekstrem di worker & `esclDimensions`

- **Lokasi:** `public/docstation/worker.js:37` (worker menerima `width`/`height` apa pun), `app/(dashboard)/docstation/_hooks/use-opencv.ts` (clamp hanya di konsumen via `maxDimension`), `lib/docstation/api.ts:39` (`esclDimensions`).
- **Bukti kode:**

  ```ts
  // api.ts — tanpa clamp resolution / paper; nilai besar menghasilkan scan raksasa
  function esclDimensions(paperSize, resolution, customWidth?, customHeight?) {
    const [wmm, hmm] = resolvePaperMM(paperSize, customWidth, customHeight);
    return {
      width: Math.round((wmm / MM_PER_INCH) * resolution),
      height: Math.round((hmm / MM_PER_INCH) * resolution),
    };
  }
  ```

  ```ts
  // editor.ts — perspectiveWarpBilinearBuffer membagi (dstW-1)/(dstH-1) → NaN bila 1
  const u = dx / (dstW - 1); // dstW=1 → pembagian nol
  ```

- **Dampak:** Konsumen memang merender pada `maxDimension` (2200/2600), tetapi worker sendiri **tidak** memvalidasi batas, sehingga pemanggil lain/regresi bisa mengirim 10000×10000 → semua alokasi `len*4` (≈400 MB) meledak. `PERSPECTIVE_WARP` menerima `dstWidth`/`dstHeight` mentah; `dstW=1` menghasilkan `u=NaN`, output kosong. `esclDimensions` tanpa clamp `resolution` (mis. user mengirim 2400 pada A0) bisa meminta scan >40 MP.
- **Rekomendasi:** Definisikan konstanta `MAX_PIXELS_PER_TASK` (mis. 40 MP, konsisten dengan `AUTO_STITCH`/`assertImageResult`) dan tolak di worker sebelum alokasi. Validasi `points.length === 8` dan `dstWidth >= 2 && dstHeight >= 2`. Di `esclDimensions`, clamp `resolution` (mis. 100–1200) dan total piksel.

### [Medium] `AUTO_STITCH` tidak memverifikasi ukuran buffer per gambar → `subarray`/`set` bisa OOB-diam atau salah offset

- **Lokasi:** `public/docstation/worker.js:346` (`AUTO_STITCH`), khususnya `worker.js:378`.
- **Bukti kode:**

  ```js
  for (const img of images) {
    const imgData = new Uint8ClampedArray(img.imageData);
    const offsetX = isVert ? Math.round((totalWidth - img.width) / 2) : currentX;
    const offsetY = isVert ? currentY : Math.round((totalHeight - img.height) / 2);
    for (let y = 0; y < img.height; y++) {
      const srcOffset = y * img.width * 4;
      const dstOffset = ((offsetY + y) * totalWidth + offsetX) * 4;
      canvasData.set(imgData.subarray(srcOffset, srcOffset + img.width * 4), dstOffset);
    }
    ...
  }
  ```

- **Dampak:** Loop mengasumsikan `img.imageData.byteLength === img.width*img.height*4`. Jika tidak (payload rusak, dimensi tidak sinkron), `subarray` menghasilkan potongan lebih pendek/lebih panjang dan `set` menulis pada offset yang salah → gambar hasil stitch "bergeser"/robek tanpa error. `img.width`/`img.height` juga tidak divalidasi sebagai bilangan bulat positif. Fungsi juga tetap memakai `Math.max(...images.map(...))` (aman untuk ≤50 lembar, tapi tanpa batas panjang eksplisit).
- **Rekomendasi:** Validasi tiap `img`: `Number.isInteger(img.width/height)`, `img.width>0`, dan `new Uint8ClampedArray(img.imageData).byteLength === img.width*img.height*4`; tolak gambar yang tidak konsisten dengan balasan `ERROR`. Batasi `images.length`.

### [Medium] Worker `DESKEW` membaca koordinat garis dengan `floatAt` padahal `HoughLinesP` mengembalikan CV_32S

- **Lokasi:** `public/docstation/worker.js:69-72`.
- **Bukti kode:**

  ```js
  cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 80, 30, 10);
  for (let index = 0; index < lines.rows; index += 1) {
    const x1 = lines.floatAt(index, 0); // HoughLinesP output bertipe CV_32S → seharusnya intAt
    ...
  }
  ```

- **Dampak:** Akses `floatAt` pada `Mat` bertipe integer bisa mengembalikan nilai yang salah/rusak (membaca reinterpretasi byte), sehingga sudut garis terdeteksi salah → `angle` deskew keliru. Konsumen membatasi `|angle|<=45` (`editor-studio.tsx` `runDeskew`) sehingga tidak meledak, tetapi hasil bisa tidak akurat dan sulit dilacak. Juga `medianAngle` sebenarnya **rata-rata** (mean), bukan median (penamaan menyesatkan; outlier garis tetap mempengaruhi).
- **Rekomendasi:** Gunakan `lines.intAt(index, c)` (sesuai tipe `HoughLinesP`). Ganti nama `medianAngle` → `meanAngle`, atau implementasi median sebenarnya agar robust terhadap outlier.

### [Low] `INITIALIZED` kedua (OpenCV siap) dapat diabaikan bila belum ada penunggu

- **Lokasi:** `public/docstation/worker.js:28` dan `app/(dashboard)/docstation/_hooks/use-opencv.ts:106`.
- **Bukti kode:** worker mengirim `INITIALIZED` (pure-js) di startup dan sekali lagi saat `cv.onRuntimeInitialized` (opencv-cpp). Hook menyelesaikan Promise pertama yang menerima `INITIALIZED` dan menghapus dirinya dari `initWaitersRef`; notifikasi kedua broadcast ke set (kosong) → diabaikan.
- **Dampak:** Status engine yang benar (opencv-cpp) bisa tidak pernah tercatat bila load kedua datang terlambat (atau sebaliknya, status "ready" ditetapkan dari sinyal pure-js lebih dulu padahal OpenCV menyusul). Ini lebih ke akurasi pelaporan status/UI (`cvStatus`) daripada kegagalan fungsional — worker tetap memilih OpenCV pada tiap `case` bila tersedia.
- **Rekomendasi:** Simpan "engine terakhir" di ref (bukan hanya resolve Promise), dan izinkan pembaruan status setelah ready. Atau bedakan pesan `INITIALIZED` (boot) dari `CV_READY`.

### [Low] `loadOpenCVFromUrl` menelan error tanpa memberi sinyal ke main thread

- **Lokasi:** `public/docstation/worker.js:31-35`.
- **Bukti kode:**

  ```js
  } catch (error) {
      console.warn('[DocStation Worker] Gagal menginisialisasi OpenCV Blob:', error);
  }
  ```

- **Dampak:** Bila `importScripts(url)` gagal (blob sudah direvoke, CSP, korup), tidak ada balasan apa pun ke main thread. Hook bergantung pada `OPENCV_INIT_TIMEOUT_MS` (30 s) lalu menganggap `pure-js-timeout`; UI menampilkan "Pure-JS" setelah menunggu 30 detik tanpa alasan yang jelas. Pengguna tak tahu OpenCV gagal.
- **Rekomendasi:** Balas `reply('CV_LOAD_FAILED', { error: String(error && error.message) }, [], undefined)` (atau tipe `INITIALIZED` dengan `cvEngine: 'pure-js'` + `reason`), sehingga hook menyelesaikan `initPromise` segera, bukan menunggu timeout.

### [Low] `releasePageImage`/revoke tidak dijamin untuk gambar yang dibuat worker; konsumen harus ingat

- **Lokasi:** `lib/docstation/editor.ts:31` (`replacePageImage`), `lib/docstation/canvas.ts` (`createImageFromBlob`).
- **Bukti kode:**

  ```ts
  export async function replacePageImage(page: EnginePage, blob: Blob): Promise<void> {
    const { image, url } = await createImageFromBlob(blob);
    if (page.sourceUrl) { try { URL.revokeObjectURL(page.sourceUrl); } catch {} }
    page.image = image; page.sourceUrl = url; ...
  }
  ```

- **Dampak:** Setiap hasil worker → `applyImageDataToPage` → `blobFromCanvas` (JPEG) → `replacePageImage` membuat object URL baru dan melepas yang lama. Ini benar, **tetapi** `applyImageDataToPage` membuat `ImageData`/canvas sementara berukuran penuh yang tidak dibersihkan eksplisit — bergantung GC. Berulang (auto-enhance N halaman, lalu penyuntingan) menumpuk canvas sementara (`document.createElement('canvas')` per operasi). Bukan kebocoran permanen, tapi puncak memori naik. Ini konsisten dengan temuan MSRCR: tidak ada strategi pelepasan eksplisit.
- **Rekomendasi:** Setelah `blobFromCanvas`, set `canvas.width = canvas.height = 0` untuk melepas backing store segera. Pertimbangkan padanan pola di `editor.ts` (`applyImageDataToPage`, `cropPage`, `stitchPages`) yang membuat canvas besar.

---

## Prioritas Perbaikan

### P0 — segera (Critical)

1. **Balas error eksplisit di worker** untuk `type` tak dikenal & payload rusak; bungkus `onmessage` dengan `try/catch` yang mengirim `ERROR` + `requestId`. Turunkan timeout `run()` dan buat per-operasi. (Temuan #1)
2. **Validasi payload di setiap `case`**: cek `width/height` integer positif dan `byteLength === width*height*4` sebelum alokasi. (Temuan #2)
3. **Pemulihan worker crash**: `terminate()` + `workerRef = null` + `setState("error")` pada `onerror`, buat ulang saat request berikutnya; tambah `onmessageerror`. (Temuan #3)

### P1 — penting (High)

4. **Satukan validasi hasil** di konsumen: panggil `assertImageResult` di `runEnhance` (dan semua jalur). (Temuan #4)
5. **Perbaiki manajemen resource OpenCV**: pisahkan `mats` (cv.Mat) dari `cv.Size`; `try/finally` untuk `contours.get()`; cek `typeof m.delete`. (Temuan #5)
6. **Guard dimensi operasi berat** (MSRCR/Sauvola/AUTO_PIPELINE): cap piksel per task, lepas buffer antar tahap. (Temuan #6)
7. **Abort/kooperatif-cancel + lepas buffer** saat timeout; hindari antrean task raksasa. (Temuan #7)

### P2 — perbaikan kualitas (Medium)

8. **Transfer langsung** `imageData.data.buffer` di `takeTransferable` (benar-benar zero-copy) dan perbarui komentar. (Temuan #8)
9. **Kurangi salinan ganda** `*.buffer.slice(0)` pada hasil OpenCV. (Temuan #9)
10. **Jaga ownership buffer** yang di-transfer (salin sekali, pakai di semua fallback, assert panjang). (Temuan #10)
11. **Clamp dimensi/resolusi** di worker & `esclDimensions`; validasi `points.length===8`, `dstWidth/Height>=2`. (Temuan #11)
12. **Validasi ukuran per gambar** di `AUTO_STITCH` + batasi jumlah gambar. (Temuan #12)
13. **Perbaiki `floatAt` → `intAt`** pada pembacaan `HoughLinesP`; rapikan penamaan/median. (Temuan #13)

### P3 — penyempurnaan (Low)

14. Simpan "engine terakhir" & dukung update status engine. (Temuan #14)
15. Balas `CV_LOAD_FAILED` agar load tidak menunggu 30 s buta. (Temuan #15)
16. Lepas backing store canvas sementara (`canvas.width = canvas.height = 0`) di titik hot-path. (Temuan #16)
