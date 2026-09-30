# DocStation — Riset Multi-Scan (Pindai Lagi / Append Halaman)

> **Status dokumen: RISET & USULAN — READ-ONLY.**
> Tidak ada satu baris kode produksi yang diubah untuk menyusun laporan ini.
> Semua perubahan yang diuraikan di bagian (3) dan (4) **hanya diusulkan**, bukan
> dieksekusi. Bila disetujui, implementasi dilakukan di PR terpisah dengan
> pengujian regresi. Laporan ini sendiri adalah satu-satunya berkas yang ditulis.

---

## 1. Ringkasan

Alur `scan` di DocStation saat ini bersifat **sekali pindai**: begitu
`doc.scan(...)` sukses dan menghasilkan halaman, `docstation-app.tsx` langsung
melompat dari step 2 (Konfigurasi) ke step 3 (EditorStudio). Di EditorStudio
tidak ada jalan kembali ke step 2 tanpa membuang sesi yang sudah ada
(`resetSession()`), sehingga operator yang ingin memindai **batch berikutnya**
(ADF habis, mau tambah lembar, ganti sumber flatbed→ADF, dsb.) harus keluar dan
mengulang seluruh alur, kehilangan hasil edit/urutan halaman sebelumnya.

Riset ini bertujuan merancang opsi **"Pindai Lagi"** yang:

1. memindahkan user dari step 3 (atau step 4) kembali ke step 2 **tanpa**
   membersihkan sesi, dan
2. **menambahkan (append)** halaman hasil scan baru ke daftar halaman existing
   alih-alih menggantinya.

Fitur ini bertentangan secara struktural dengan beberapa mekanisme yang sudah
ada: `scan()` di hook memakai `addImageBlobs()` yang memang sudah _append_
(bukan replace), tetapi `docstation-app.tsx` menggerakkan `step` secara
proaktif dan `reset()`/`applyReset()` menghapus sesi. Selain itu ada interaksi
halus dengan `autoEnhance`, `skipBlank`, `movePage`/`syncOrder`, dan guard
`busy` berbasis `AlertDialog`. Bagian (2)–(4) memetakan temuan, opsi, dan
rencana implementasi konkret beserta risikonya.

Kesimpulan awal: fitur ini **layak dan relatif murah** karena mesin state
(`use-docstation.ts`) sudah _append_-by-default; pekerjaan utamanya ada di
orkestrasi UI (`docstation-app.tsx`) dan penanganan batch baru di
(`editor-studio.tsx`).

---

## 2. Temuan (dengan bukti file:baris)

### 2.1 `setStep(3)` dipanggil begitu scan sukses

`app/(dashboard)/docstation/_components/docstation-app.tsx:227-237`:

```tsx
{step === 2 && !doc.scanning && (
  <ScanConfigPanel
    ...
    onScan={async () => {
      try {
        await doc.scan({ ...scanConfig, printerIp: scanPrinterIp });
        // Batal → tetap di langkah 2 (tanpa halaman baru tak ada lanjut).
        if (doc.stateRef.current.pages.length > 0) setStep(3);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memindai dokumen");
      }
    }}
    onBack={reset}
  />
)}
```

- **Bukti:** `docstation-app.tsx:232-233` — setelah `await doc.scan(...)` selesai
  (dengan halaman), baris `if (doc.stateRef.current.pages.length > 0) setStep(3)`
  langsung menaikkan step. Tidak ada cabang "append mode" atau penanda bahwa user
  ingin tetap di step 2.
- **Dampak:** Tidak ada cara memicu scan berulang dari UI saat state global sudah
  di step 3, karena `ScanConfigPanel` hanya dirender ketika `step === 2`
  (`docstation-app.tsx:219`). Untuk kembali, user harus menekan **Kembali**
  di EditorStudio/step 4, atau keluar ke step 1.
- **Catatan penting:** kondisi `pages.length > 0` bersifat **global** (menghitung
  seluruh engine.pages), bukan "bertambah pada batch ini". Artinya, bila suatu
  saat tombol Pindai Lagi memanggil `doc.scan()` saat sudah ada halaman (mis.
  dari step 3), kondisi ini akan langsung `true` dan pemanggil tidak dapat
  membedakan "batch baru berisi halaman" vs "sudah ada halaman lama".

### 2.2 `reset()` (tombol Kembali di ScanConfigPanel) mengosongkan sesi

`docstation-app.tsx:98-113`:

```tsx
const reset = useCallback(() => {
  // Saat sibuk, minta konfirmasi sebelum menghapus sesi di tengah proses.
  if (busy) {
    setPendingAction({ kind: "reset" });
    return;
  }
  applyReset();
}, [busy, applyReset]);
```

`docstation-app.tsx:74-80`:

```tsx
const applyReset = useCallback(() => {
  setMode(null);
  setStep(1);
  doc.resetSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [doc.resetSession]);
```

- **Bukti:** `ScanConfigPanel` menerima `onBack={reset}` di
  `docstation-app.tsx:238`. `reset` → `applyReset` memanggil `doc.resetSession()`.
- **Bukti hilir:** `app/(dashboard)/docstation/_hooks/use-docstation.ts:239-252`
  (`resetSession`) mengosongkan `engine.pages = []`, `engine.activeId = null`,
  `engine.manualOverlays = {}`, dan me-revoke semua `sourceUrl`. Jadi tombol
  **Kembali** di step 2 saat ini berarti "batalkan total & balik ke step 1",
  bukan "kembali ke editor dengan halaman utuh".
- **Dampak:** Ini akar masalah "harus reset untuk pindai lagi". Tombol Kembali
  di step 2 tidak bisa dipakai sebagai jalur Pindai Lagi karena disambiguasi
  aksinya destruktif dan mengubah `mode` ke `null`.

### 2.3 Guard `busy` berbasis AlertDialog

`docstation-app.tsx:59-64`:

```tsx
const [pendingAction, setPendingAction] = useState<
  { kind: "mode"; mode: DocStationMode } | { kind: "reset" } | null
>(null);
```

`docstation-app.tsx:82-113` — `selectMode` dan `reset` sama-sama memeriksa `busy`;
bila sibuk, aksi ditunda ke `pendingAction`, lalu dialog dikonfirmasi di
`confirmPendingAction` (`docstation-app.tsx:114-125`).

`docstation-app.tsx:366-393` (AlertDialog) dan definisi `busy` di
`docstation-app.tsx:63`:

```tsx
const busy = doc.scanning || doc.busy || processing;
```

- **Bukti:** `docstation-app.tsx:63` — `busy` menggabungkan tiga sumber:
  `doc.scanning` (loop scan/ADF), `doc.busy` (enhance/warp dari EditorStudio via
  `setBusy`), dan `processing` (cetak/simpan lokal di `DocStationApp`).
- **Dampak:** Setiap aksi navigasi yang merusak sesi (ganti mode, reset) sudah
  dijaga. Namun **belum ada guard** untuk aksi "Pindai Lagi" non-destruktif:
  bila tombol itu ditambahkan tanpa memeriksa `busy`, user bisa menekannya
  saat `autoEnhance` batch masih berjalan (loop bisa sampai 50 halaman, lihat
  `editor-studio.tsx` `useEffect` auto-enhance) sehingga batch baru tumpang
  tindih dengan batch lama memakai canvas/worker yang sama.
- **Konsistensi:** `ScanConfigPanel` saat ini tidak menerima prop `busy`; tombol
  "Mulai Pindai Sekarang" bisa ditekan berkali-kali, dilindungi hanya oleh
  `if (scanning) return;` di `use-docstation.ts:174`. Ini guard level hook, bukan
  level UI.

### 2.4 `scan()` sudah _append_ ke engine.pages (bukan replace)

`use-docstation.ts:160-179` (`addImageBlobs`) dan `use-docstation.ts:182-213`
(`scan`).

- **Bukti:** `addImageBlobs` melakukan `engine.pages.push(page)` per blob
  (`use-docstation.ts:171`) lalu `syncPages()`; `scan` memanggilnya dengan
  `"Scan"` (`use-docstation.ts:201`). Tidak ada `.splice`/`.length = 0` di jalur
  ini.
- **Dampak menguntungkan:** Mesin state sudah mendukung multi-batch secara alami.
  Yang perlu diubah **bukan** mesin append-nya, melainkan (a) orkestrasi step di
  `docstation-app.tsx`, dan (b) penamaan/penomoran halaman agar batch baru tidak
  menabrak nama batch lama (`createEnginePage(image, url, "Scan N")` memakai
  `engine.pages.length + 1`, lihat `use-docstation.ts:171`, jadi sebenarnya
  monotonic — aman).

### 2.5 Penomoran halaman batch

`use-docstation.ts:171`:

```tsx
const page = createEnginePage(
  image,
  url,
  `${namePrefix} ${engine.pages.length + 1}`,
);
```

- **Bukti:** Nama memakai `engine.pages.length + 1` yang dihitung ulang setiap
  iterasi, sehingga batch kedua akan melanjutkan penomoran (mis. batch 1 =
  "Scan 1..3", batch 2 mulai dari "Scan 4"). Tidak ada tabrakan nama.
- **Catatan:** `name` hanya label; identitas halaman stabil di `id`
  (`state.ts:80-84`, `crypto.randomUUID()`), jadi append aman dari sisi React key
  (`page-strip.tsx:53` memakai `key={page.id}`).

### 2.6 `autoEnhanceOnLoad` hanya benar-benar jalan sekali

`editor-studio.tsx:232-289` (`useEffect` auto pipeline) dan `editor-studio.tsx:303-337`.

- **Bukti:** `editor-studio.tsx:236` — `if (!autoEnhanceOnLoad || autoEnhancedRef.current) return;`
  lalu `autoEnhancedRef.current = true` (`editor-studio.tsx:239`). Efek hanya
  bergantung pada `[autoEnhanceOnLoad, doc.pages.length]` (`editor-studio.tsx:338`).
- **Dampak:** Bila step 3 di-unmount saat Pindai Lagi (komponen EditorStudio
  dilepas karena `step !== 3`, lihat `docstation-app.tsx:241`), `autoEnhancedRef`
  ikut hilang dan saat kembali ke step 3 efek pada page count baru akan jalan
  lagi — tapi `autoEnhancedRef` akan kembali `false`, sehingga **seluruh halaman**
  (termasuk batch lama yang sudah diedit) akan di-enhance ulang. Ini bisa
  menghapus hasil edit manual operator pada batch 1. Risiko ini harus ditangani
  eksplisit (lihat 2.8 & bagian 4).

### 2.7 `skipBlank` & kelangsungan batch

- **Bukti:** `scan-config-panel.tsx:207-225` mengeset `skipBlank` via `onChange`,
  dan `use-docstation.ts:187-201` meneruskannya ke `addImageBlobs(..., { skipBlank })`.
  `isProbablyBlank` (`use-docstation.ts:46-70`) membuang lembar ADF kosong.
- **Dampak:** Bila semua lembar batch baru terbuang sebagai blank, `blobs`
  di `requestScan` tetap non-kosong di level API (blob ada), tetapi
  `addImageBlobs` bisa `continue` untuk semua → `pages.length` tak bertambah.
  Pemanggil `onScan` saat ini memakai `pages.length > 0` global sehingga tetap
  dianggap sukses. Untuk append, perlu dibedakan "batch ini menambah 0 halaman".
  `requestScan` melempar error bila `blobs.length === 0`
  (`api.ts:180-182`) tetapi **tidak** bila semua dibuang oleh `skipBlank` di hook.

### 2.8 State transisi step & unmount EditorStudio

`docstation-app.tsx:241-253` merender `EditorStudio` hanya saat `step === 3`:

```tsx
{step === 3 && (
  <EditorStudio
    ...
    autoEnhanceOnLoad={scanConfig.autoEnhance}
  />
)}
```

- **Bukti:** Karena `step` mengontrol mount/unmount, setiap transisi step 3→2
  melepas seluruh state lokal EditorStudio (`tool`, `brushSize`, `cropMode`,
  `selectedIds`, `zoom`, `autoEnhancedRef`, `autoEnhanceAbortRef`,
  `cancelledRef`). `useEffect` cleanup (`editor-studio.tsx:331-337`) meng-abort
  auto-enhance saat unmount — bagus untuk mencegah race, tetapi juga berarti
  job enhance yang belum selesai pada batch 1 akan dibatalkan oleh Pindai Lagi.
- **Dampak:** Pindai Lagi saat `doc.busy` aktif (auto-enhance berjalan) akan
  membatalkan proses batch 1 di tengah jalan, meninggalkan sebagian halaman
  ter-enhance dan sebagian tidak. Ini alasan kuat tombol Pindai Lagi **wajib**
  dijaga oleh `busy` (lihat bagian 4).

### 2.9 `movePage`/`syncOrder` dan urutan halaman

`editor-studio.tsx:412-428` (`movePage`) memutasi `engine.pages` in-place lalu
`syncOrder()`.

- **Bukti:** `movePage` menukar elemen array dan langsung `doc.syncOrder()`.
  Append di akhir array (`use-docstation.ts:171`) konsisten dengan urutan
  tampilan `page-strip.tsx:42-52` (render urut index).
- **Dampak:** Karena append terjadi di ekor array, halaman baru selalu muncul di
  kanan strip — sesuai ekspektasi operator. Tidak ada konflik dengan reorder.
  Satu-satunya risiko: bila Pindai Lagi dijalankan sementara user punya
  `selectedIds` (checkbox multi) yang tertinggal dari batch sebelumnya; seleksi
  itu tidak dibersihkan oleh `scan` sehingga bisa ikut ter-"stitch".

---

## 3. Opsi Solusi + Rekomendasi

### Opsi A — Tombol "Pindai Lagi" di step 3/EditorStudio, kembali ke step 2 tanpa reset

Menambahkan tombol di `EditorStudio` (mis. di footer dekat "Lanjut Cetak") yang
memanggil prop baru `onRescan()`. `docstation-app.tsx` menyalurkan `onRescan`
sebagai `() => setStep(2)` **tanpa** `doc.resetSession()`. Karena `scan()` sudah
append (2.4), batch baru otomatis ditambahkan.

- **Pro:** Perubahan minimal, memakai append bawaan mesin.
- **Kontra:** Meng-unmount EditorStudio → state lokal (`zoom`, `tool`, seleksi)
  hilang; auto-enhance berpotensi re-run semua halaman (2.6).
- **Interaksi `autoEnhance`:** Setelah kembali ke step 3 dengan `autoEnhanceOnLoad=true`,
  `autoEnhancedRef` reset → efek me-render **semua** halaman, termasuk batch lama.
  Perlu penanda "halaman mana yang belum di-enhance".

### Opsi B — Pindai Lagi tanpa meninggalkan step 3 (scan inline)

Menambahkan kontrol trigger scan langsung di EditorStudio (mis. tab "Multi" atau
tombol terpisah) yang memanggil `doc.scan(scanConfig)` lalu tetap di step 3.
Hasil append langsung muncul di `PageStrip`.

- **Pro:** EditorStudio tidak di-unmount → state lokal (seleksi, zoom) aman;
  auto-enhance tidak re-run karena `autoEnhancedRef` tetap `true`.
- **Kontra:** `scanConfig` harus di-threading ke EditorStudio (saat ini tidak,
  lihat `docstation-app.tsx:241-253`) atau butuh konteks; `InlineProgress`
  (`docstation-app.tsx:220-228`) juga hanya dirender di step 2 sehingga progress
  scan tidak tampil; EditorStudio belum punya UI konfigurasi scan → perlu
  duplikasi/embed `ScanConfigPanel` inline.

### Opsi C — Sub-step "Tambahkan Halaman" (step 2.5 khusus batch lanjutan)

step 2 dirender dengan mode `isRescanMode` yang: (a) menampilkan banner
"Menambah halaman ke dokumen yang ada", (b) `onBack` mengembalikan ke step 3
alih-alih reset, (c) `onScan` hanya menaikkan step bila batch baru menambah
halaman.

- **Pro:** Paling eksplisit; menjaga konvensi wizard; mudah diuji; dapat memakai
  ulang `ScanConfigPanel` + `InlineProgress`; tidak meng-unmount di tengah scan
  (karena scan masih di step 2, sama seperti sekarang).
- **Kontra:** Butuh prop baru di `ScanConfigPanel` (`rescanMode`, `onBack` khusus)
  dan penanganan batch count.

### Rekomendasi

**Rekomendasi: Opsi C sebagai kerangka utama, mengambil elemen Opsi B untuk
progress.** Secara spesifik:

1. Tambahkan **`isRescanMode`** (state boolean di `DocStationApp`).
2. Tombol **"Pindai Lagi"** di `EditorStudio` memanggil `onRescan()` yang:
   `setIsRescanMode(true); setStep(2);` — **tanpa** `resetSession()`.
3. Di step 2, `onBack` memilih jalur: bila `isRescanMode` → `setStep(3)` (kembali
   ke editor, sesi utuh); bila bukan → `reset()` (perilaku lama).
4. `onScan` menghitung **delta halaman** (`pages.length` sebelum vs sesudah) dan
   hanya `setStep(3)` bila `delta > 0`; bila `delta === 0` (mis. semua lembar
   blank ter-skip) tetap di step 2 dengan `toast` informatif.
5. Setelah kembali ke step 3, reset `isRescanMode=false`.
6. Auto-enhance: tandai halaman yang **baru saja di-enhance** agar batch lama
   tidak diulang; atau lebih sederhana, nonaktifkan auto-enhance untuk batch
   lanjutan dan tawarkan tombol "Perbaiki Otomatis" pada halaman yang dipilih.

**Alasan append (bukan replace)** dipilih: hasil batch 1 mungkin sudah diedit
(crop, rotate, anotasi, penyesuaian). Replace akan membuang kerja itu dan
menabrak prinsip "append" yang sudah jadi default mesin (`use-docstation.ts:171`).

**Interaksi kunci yang harus dijaga:**

- **autoEnhance** (2.6): jangan re-enhance batch lama.
- **skipBlank** (2.7): bedakan "sukses 0 halaman" agar tidak salah lompat step.
- **Guard busy AlertDialog** (2.3): tombol Pindai Lagi yang merusak konteks
  (meng-unmount editor) harus dicek terhadap `busy`; minimal nonaktif saat
  `busy`. Untuk perubahan yang tidak destruktif murni (kembali ke konfigurasi
  tanpa menghapus sesi), perdalam: jangan sampai auto-enhance batch 1 ter-abort
  oleh transisi. Karena transisi step 3→2 memang meng-abort (2.8), alternatif
  aman adalah menunggu hingga tidak sibuk, atau menampilkan dialog.
- **State transisi step** (2.8): `isRescanMode` harus di-reset ketika user
  benar-benar keluar (reset/ganti mode) agar tidak "bocor" ke alur berikutnya.

---

## 4. RENCANA IMPLEMENTASI TERPERINCI

> **Catatan tegas: seluruh rencana di bawah adalah USULAN. Tidak ada perubahan
> kode yang dieksekusi dalam tugas riset ini.** Bagian ini disiapkan bila tim
> menyetujui; implementasi + test regresi dilakukan pada PR terpisah.

### 4.1 File yang akan diubah

| File                                                           | Perubahan                                                                                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `app/(dashboard)/docstation/_components/docstation-app.tsx`    | State `isRescanMode`, handler `onRescan`, threading ke `ScanConfigPanel` & `EditorStudio`, guard busy.                             |
| `app/(dashboard)/docstation/_components/editor-studio.tsx`     | Prop `onRescan`, tombol "Pindai Lagi", (opsional) tombol serupa di step 4 lewat `docstation-app`.                                  |
| `app/(dashboard)/docstation/_components/scan-config-panel.tsx` | Prop `rescanMode?: boolean` + copy banner + label tombol; `onBack` tetap satu prop (makna diatur pemanggil).                       |
| `app/(dashboard)/docstation/_hooks/use-docstation.ts`          | (Opsional) helper `appendPages` eksplisit / `addImageBlobs` mengembalikan jumlah halaman ditambah, agar delta bisa dihitung andal. |
| `app/(dashboard)/docstation/_components/page-strip.tsx`        | (Bila perlu) penanda visual "baru" pada halaman dari batch terakhir. Opsional.                                                     |

### 4.2 Perubahan konkret — `docstation-app.tsx`

1. **State baru:**

   ```tsx
   const [isRescanMode, setIsRescanMode] = useState(false);
   ```

2. **Handler `onRescan`** (dipasang ke `EditorStudio`):

   ```tsx
   const handleRescan = useCallback(() => {
     // Guard: jangan tinggalkan editor saat proses gambar masih berjalan,
     // karena transisi step 3→2 meng-unmount EditorStudio dan meng-abort
     // auto-enhance batch sebelumnya (lihat temuan 2.8).
     if (busy) {
       setPendingAction({ kind: "rescan" });
       return;
     }
     setIsRescanMode(true);
     setStep(2);
     // TIDAK memanggil doc.resetSession() — sesi halaman dipertahankan.
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [busy]);
   ```

3. **`onScan` di step 2 — hitung delta, jangan tebak dari `pages.length` global:**

   ```tsx
   onScan={async () => {
     const before = doc.stateRef.current.pages.length;
     try {
       await doc.scan({ ...scanConfig, printerIp: scanPrinterIp });
       const delta = doc.stateRef.current.pages.length - before;
       if (delta > 0) {
         setStep(3);
         setIsRescanMode(false);
       } else {
         // Semua lembar ter-skip (skipBlank) atau batal: tetap di konfigurasi.
         toast.info("Tidak ada halaman baru yang tertangkap. Coba sesuaikan sumber/opsi.");
       }
     } catch (err) {
       toast.error(err instanceof Error ? err.message : "Gagal memindai dokumen");
     }
   }}
   ```

   Ini memperbaiki kelemahan kondisi lama (`docstation-app.tsx:233`) yang memakai
   jumlah global.

4. **`onBack` di step 2 — dua makna:**

   ```tsx
   onBack={() => {
     if (isRescanMode) {
       // Kembali ke editor dengan halaman utuh (tanpa reset).
       setIsRescanMode(false);
       setStep(3);
       return;
     }
     reset(); // perilaku lama: keluar ke step 1 & kosongkan sesi
   }}
   ```

   Alternatif: teruskan `onBack={isRescanMode ? backToEditor : reset}`.

5. **AlertDialog untuk `kind: "rescan"`:** tambahkan varian di `pendingAction`
   dan copy yang sesuai ("Menunggu proses selesai sebelum memindai batch baru"),
   lalu `confirmPendingAction` mengeksekusi `handleRescan` versi non-guard.

6. **Reset `isRescanMode`** di `applyReset` dan `applyMode` agar tidak bocor ke
   alur berikutnya:

   ```tsx
   const applyReset = useCallback(() => {
     setMode(null);
     setStep(1);
     setIsRescanMode(false);
     doc.resetSession();
   }, [doc.resetSession]);
   ```

7. **Threading ke `EditorStudio`:**

   ```tsx
   <EditorStudio
     ...
     autoEnhanceOnLoad={scanConfig.autoEnhance && !isRescanMode} // lihat 4.5
     onRescan={handleRescan}
   />
   ```

### 4.3 Perubahan konkret — `editor-studio.tsx`

1. Tambah prop `onRescan?: () => void` ke `EditorStudioProps`.
2. Render tombol di footer (dekat "Unduh PDF"/"Lanjut Cetak"), mis.:

   ```tsx
   <Button
     type="button"
     variant="outline"
     onClick={onRescan}
     disabled={doc.busy} // JANGAN izinkan saat enhance batch jalan
   >
     <ScanLine className="mr-1.5 h-4 w-4" />
     Pindai Lagi
   </Button>
   ```

3. Pastikan tombol **dinonaktifkan saat `doc.busy`** sehingga transisi
   unmount tidak meng-abort job enhance (temuan 2.8). Bila tetap ingin
   konfirmasi, serahkan ke `handleRescan` (guard `busy` → AlertDialog).

### 4.4 Perubahan konkret — `scan-config-panel.tsx`

1. Tambah prop opsional:

   ```tsx
   rescanMode?: boolean;
   ```

2. Bila `rescanMode`, tampilkan banner di atas grid:

   > "Mode tambah halaman: hasil pemindaian akan **ditambahkan** ke dokumen yang
   > ada (X halaman). Tidak ada halaman yang dihapus."

3. Ubah label tombol: "Mulai Pindai Sekarang" → "Pindai & Tambahkan Halaman", dan
   tombol "Kembali" tetap memanggil `onBack` (makna diatur pemanggil di 4.2 poin 4).

### 4.5 Perubahan konkret — `use-docstation.ts` (append & delta)

- **Jadikan `addImageBlobs` mengembalikan jumlah halaman appended:**

  ```tsx
  async function addImageBlobs(...): Promise<number> {
    let added = 0;
    for (const blob of blobs) { ... engine.pages.push(page); added++; }
    syncPages();
    return added;
  }
  ```

  dan `scan()` meneruskan nilai ini (`return added`) agar `onScan` dapat memakai
  `const added = await doc.scan(...)` alih-alih menghitung delta manual. Ini
  menghilangkan balapan `pages.length` global.

- **Alternatif `appendPages(pages)` eksplisit:** bila ingin API lebih deskriptif
  dari `setPages`, sediakan `appendImageBlobs` alias yang hanya menegaskan
  perilaku append. **Tidak perlu** membuat `setPages` baru — mesin tidak punya
  `setPages` (state disinkron via `syncPages` dari `engine.pages`), jadi
  mengganti "replace" tidak relevan; yang perlu adalah memastikan tidak ada
  pemanggil yang mengosongkan `engine.pages` di tengah alur Pindai Lagi.

- **autoEnhance/skipBlank pada batch baru:** karena `scan` menerapkan
  `skipBlank` per batch (`use-docstation.ts:201`), dan `autoEnhance` ditangani di
  layer EditorStudio, tidak ada perubahan di hook untuk keduanya kecuali
  pengembalian `added` di atas.

### 4.6 Interaksi dengan autoEnhance (detail penting)

Karena `EditorStudio` di-unmount saat `step` berubah, `autoEnhancedRef`
(`editor-studio.tsx:236`) kembali `false` saat kembali ke step 3. Bila
`autoEnhanceOnLoad` tetap `true`, efek akan meng-enhance **semua** halaman
(batch lama + baru). Dua strategi:

- **(Rekomendasi) Matikan auto-enhance saat `isRescanMode`** (`autoEnhanceOnLoad={scanConfig.autoEnhance && !isRescanMode}`),
  lalu sediakan tombol "Perbaiki Otomatis" manual untuk halaman baru. Ini
  mencegah halaman batch 1 yang sudah diedit tertimpa ulang.
- **(Alternatif) Pertahankan ref lintas-mount**: angkat `autoEnhancedRef` /
  penanda `enhancedPageIds: Set<string>` ke `DocStationApp` atau `useDocStation`,
  dan di loop auto-enhance hanya proses halaman yang **belum** ada di set. Ini
  lebih kompleks dan menyentuh hook, tetapi memberi UX "auto-enhance hanya pada
  halaman baru".

### 4.7 Perlindungan `busy` saat batch berjalan

- Tombol "Pindai Lagi" **disabled saat `doc.busy`** (4.3).
- `handleRescan` masih menyimpan guard `busy` (double-safety) dan menunda via
  `pendingAction: { kind: "rescan" }` → AlertDialog (4.2 poin 5).
- Pada step 2, `InlineProgress` (`docstation-app.tsx:220-228`) ditampilkan selama
  `doc.scanning`; pastikan tombol `onBack`/`onScan` tidak dapat memicu reset saat
  `scanning` (sudah dijaga oleh `busy` di `reset`).
- `doc.scan` sendiri sudah idempoten-guard: `if (scanning) return;`
  (`use-docstation.ts:174`) — namun ini menyebabkan pemanggilan kedua **diam-diam
  no-op**, sehingga UI harus menonaktifkan tombol, bukan mengandalkan hook.

### 4.8 PageStrip (bila perlu)

Opsional: beri badge "Baru" pada halaman yang berasal dari batch terakhir
(mis. simpan `lastBatchStartIndex` di state sementara). Tidak wajib untuk MVP;
`PageStrip` tidak perlu diubah untuk fungsionalitas inti karena sudah menerima
`pages` hasil append.

---

## 5. Risiko & Regresi

| #   | Risiko                              | Pemicu                                                                                                       | Dampak                                                                  | Mitigasi                                                                                                                                           |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **State bocor** `isRescanMode`      | User keluar via `reset`/ganti mode tanpa mereset flag                                                        | Batch berikutnya tampil sebagai "mode tambah" padahal sesi baru         | Reset `isRescanMode` di `applyReset`, `applyMode`, dan setelah kembali ke step 3 (4.2 poin 6).                                                     |
| R2  | **Duplikasi halaman**               | User menekan "Pindai Lagi" dua kali atau `doc.scan` dipanggil ganda                                          | Halaman sama masuk dua kali (append idempoten tidak ada)                | Disable tombol saat `scanning`/`busy`; guard `kind:"rescan"`; jangan auto-retry scan.                                                              |
| R3  | **Urutan halaman kacau**            | Append di tengah setelah user reorder manual                                                                 | Halaman baru mengacaukan urutan logis (mis. sisipan di antar bab)       | Append di ekor array konsisten (2.9); dokumentasikan bahwa Pindai Lagi menambah di akhir; sediakan reorder manual (sudah ada di `page-strip.tsx`). |
| R4  | **Busy guard longgar**              | Tombol Pindai Lagi aktif saat `doc.busy` (auto-enhance batch berjalan)                                       | Transisi unmount meng-abort auto-enhance → halaman ter-enhance sebagian | Disable saat `doc.busy` + AlertDialog (4.7).                                                                                                       |
| R5  | **autoEnhance re-run batch lama**   | `autoEnhancedRef` reset saat EditorStudio di-remount                                                         | Edit manual batch 1 tertimpa enhance ulang                              | Matikan auto-enhance saat rescan, atau penanda `enhancedPageIds` (4.6).                                                                            |
| R6  | **skipBlank membuang semua lembar** | Mode ADF + semua lembar blank                                                                                | `delta === 0`, user bingung kenapa tak pindah step                      | Hitung delta & tampilkan `toast` informatif (4.2 poin 3); jangan lompat step.                                                                      |
| R7  | **Balapan `pages.length` global**   | Memakai kondisi lama `pages.length > 0`                                                                      | Salah menyimpulkan batch berhasil padahal 0 halaman baru                | Pakai return `added` dari `scan`/`addImageBlobs` (4.5).                                                                                            |
| R8  | **Seleksi multi tertinggal**        | `selectedIds` dari batch lama masih aktif saat batch baru masuk                                              | Stitch/card layout tak sengaja memakai halaman lama                     | (Opsional) bersihkan seleksi pada `handleRescan`, atau minta konfirmasi.                                                                           |
| R9  | **Kebocoran object URL**            | Batch lama boleh dipertahankan (append), tapi bila user akhirnya reset, `resetSession` sudah me-revoke (2.2) | Aman; risiko hanya bila ada jalur hapus baru yang lupa revoke           | Ikuti pola revoke yang ada (`use-docstation.ts:239-252`).                                                                                          |
| R10 | **Progress scan tak terlihat**      | Bila memilih Opsi B (scan di dalam editor) tanpa `InlineProgress`                                            | User tak tahu scan berjalan                                             | Rekomendasi Opsi C tetap di step 2 agar `InlineProgress` tampil.                                                                                   |

---

## 6. Kesimpulan

- Mesin state (`use-docstation.ts`) **sudah append**; perubahan utama ada di
  orkestrasi UI (`docstation-app.tsx`) dan penanganan batch di
  (`editor-studio.tsx`).
- Rekomendasi: **Opsi C** — tombol "Pindai Lagi" dari editor memindahkan user ke
  step 2 tanpa `resetSession()`, `onBack` step 2 bersifat kondisional
  (`isRescanMode`), dan `onScan` memakai **delta halaman** agar tidak salah
  menyimpulkan.
- Titik rawan: auto-enhance re-run (R5), guard busy (R4), dan kebocoran flag
  `isRescanMode` (R1) — semuanya punya mitigasi jelas.
- **Semua perubahan di dokumen ini bersifat USULAN dan belum dieksekusi.**
  Implementasi menunggu persetujuan dan harus disertai test regresi untuk alur
  scan berulang, ADF + `skipBlank`, dan auto-enhance lintas batch.
