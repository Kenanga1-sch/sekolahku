# Riset: Wizard DocStation — Stepper, Navigasi Maju/Mundur, dan Kehilangan Data

> **Status dokumen:** LAPORAN AUDIT (read-only).
> **Tidak ada kode produksi yang diubah.** Seluruh temuan di bawah hanya hasil pembacaan kode;
> setiap perbaikan hanya disajikan sebagai _rekomendasi_. Perubahan satu-satunya pada task ini
> adalah penulisan file laporan ini.

---

## 1. Ringkasan

Alur kerja DocStation saat ini adalah wizard berbasis `mode` + `step` yang dikelola langsung di
dalam `DocStationApp` (`app/(dashboard)/docstation/_components/docstation-app.tsx`). Untuk mode
**scan** terdapat 4 langkah (Mode → Konfigurasi → Edit → Simpan), sedangkan mode **print** hanya
3 langkah (Mode → Unggah → Cetak). Komponen stepper
(`wizard-stepper.tsx`) hanya dirender ketika `mode && step > 1`, sehingga **langkah 1 (Mode) tidak
pernah menampilkan stepper**. Akibatnya pengguna tidak punya gambaran posisi mereka di alur, dan
lebih penting lagi **tidak ada jalan mundur yang aman** dari Edit kembali ke Konfigurasi: satu-satunya
tombol "Kembali" pada langkah Konfigurasi (`ScanConfigPanel.onBack`) dan Unggah (`UploadPanel.onBack`)
diarahkan ke `reset()`, yang memanggil `applyReset()` → `doc.resetSession()`. Fungsi ini **menghapus
seluruh halaman yang sudah dipindai**, mengosongkan `activeId`, dan menghapus overlay (`use-docstation.ts`).
Artinya: menekan "Kembali" bukan sekadar berpindah langkah, melainkan **membuang pekerjaan pengguna tanpa
peringatan** (kecuali saat status sibuk).

Ringkas masalah inti:

1. **Stepper tersembunyi di langkah 1** — tidak ada indikator 4 langkah saat memulai.
2. **Tidak ada tombol mundur dari Edit ke Konfigurasi** — `EditorStudio` hanya punya tombol maju
   ("Lanjut Cetak" via `onProceed`), tidak ada `onBack`.
3. **Tombol "Kembali" melakukan `reset()`** — destruktif dan menyesatkan secara semantik.
4. **Makna `mode.selected` di state tersirat dari `mode` + `step`** — tidak ada field state eksplisit
   "mode terpilih" yang bisa dipulihkan; `applyReset()` menghapus `mode` menjadi `null`, sehingga
   kembali ke pemilih mode dan mengulang dari nol.

Rekomendasi tingkat tinggi: stepper harus **selalu terlihat** (termasuk langkah 1) menampilkan 4
langkah lengkap; navigasi **Kembali hanya mengubah `step`** (tanpa `resetSession`); dan
**pengosongan sesi dipindah ke aksi eksplisit terpisah** ("Mulai Sesi Baru") dengan konfirmasi.

---

## 2. Temuan (dengan bukti `file:baris`)

### T2.1 Stepper disembunyikan di langkah 1

Bukti: `docstation-app.tsx:206`

```tsx
{
  mode && step > 1 && <WizardStepper mode={mode} step={step} />;
}
```

Konsekuensi: pada saat `!mode` (pengguna masih di `ModePicker`) dan pada saat `step === 1`, elemen
`<WizardStepper />` tidak dirender sama sekali. Pengguna baru diperlihatkan kerangka 4 langkah
setelah mereka memilih mode dan masuk ke langkah 2. Ini bertentangan dengan tujuan stepper sebagai
orientasi; langkah "Mode" yang seharusnya menjadi langkah 1 justru tidak pernah terlihat sebagai
bagian dari deretan. Definisi 4 langkah sendiri sudah ada dan benar di
`wizard-stepper.tsx:12-21` (Mode, Konfigurasi, Edit, Simpan), jadi masalahnya murni pada kondisi
render, bukan pada data label.

### T2.2 Tidak ada tombol mundur dari Edit ke Konfigurasi

Bukti: `editor-studio.tsx:395-405` — blok tombol bawah `EditorStudio`:

```tsx
<Button type="button" variant="outline" onClick={handleExportPdf} ...>
  <FileDown className="mr-1.5 h-4 w-4" /> Unduh PDF
</Button>
<Button type="button" onClick={onProceed} ...>
  <Printer className="mr-1.5 h-4 w-4" /> Lanjut Cetak
</Button>
```

Props `EditorStudioProps` (`editor-studio.tsx:24-32`) hanya mendefinisikan `onProceed`; tidak ada
`onBack`. Di sisi pemanggil, `docstation-app.tsx:236-245` merender `EditorStudio` untuk `step === 3`
tanpa meneruskan handler kembali apa pun. Selain itu, meski komponen ini tidak memiliki tombol
"Kembali", ia mengandalkan `WizardStepper` sebagai satu-satunya penanda posisi — dan stepper tersebut
(per T2.1) tidak interaktif (tidak ada `onClick`/tombol per langkah), sehingga tidak bisa dipakai
sebagai navigasi mundur. Ringkasnya: dari langkah Edit **tidak ada cara** kembali ke Konfigurasi tanpa
memulai ulang seluruh sesi.

### T2.3 Tombol "Kembali" memanggil `reset()` sehingga pekerjaan hilang

Bukti berantai:

- `scan-config-panel.tsx:263-265` — tombol Kembali di Konfigurasi memanggil `onBack`:
  ```tsx
  <Button variant="ghost" onClick={onBack}>
    Kembali
  </Button>
  ```
- `docstation-app.tsx:230` — `ScanConfigPanel` dipasangi `onBack={reset}`.
- `docstation-app.tsx:150-159` — definisi `reset`:
  ```tsx
  const reset = useCallback(() => {
    if (busy) {
      setPendingAction({ kind: "reset" });
      return;
    }
    applyReset();
  }, [busy, applyReset]);
  ```
- `docstation-app.tsx:129-135` — `applyReset` mengosongkan mode dan sesi:
  ```tsx
  const applyReset = useCallback(() => {
    setMode(null);
    setStep(1);
    doc.resetSession();
  }, [doc.resetSession]);
  ```
- `use-docstation.ts:214-226` — `resetSession` benar-benar menghapus halaman:
  ```tsx
  const resetSession = useCallback(() => {
    const engine = stateRef.current!;
    engine.pages.forEach((p) => {
      try {
        URL.revokeObjectURL(p.sourceUrl);
      } catch {}
    });
    engine.pages = [];
    engine.activeId = null;
    engine.manualOverlays = {};
    syncPages();
  }, [syncPages]);
  ```

Dampak: mengklik "Kembali" di langkah Konfigurasi (setelah pengguna memindai sebagian atau menyetel
parameter) **membuang semua halaman hasil pindai** dan melempar pengguna kembali ke `ModePicker`
(`setMode(null)`), bukan ke langkah 1 yang menampilkan stepper. Tidak ada dialog konfirmasi selama
`busy === false`; konfirmasi hanya muncul saat ada proses berjalan (`pendingAction`, `docstation-app.tsx:322-345`).
Kehilangan data ini tidak dapat di-undo — `resetSession` merevoke object URL sumber sehingga gambar
tidak dapat direkonstruksi.

Kasus serupa pada mode print: `docstation-app.tsx:262` memasang `onBack={reset}` pada `UploadPanel`,
sehingga "Kembali" dari langkah Unggah juga menghapus berkas yang telah diunggah (via reset sesi),
walaupun berkas print disimpan di state terpisah `printFiles` (`docstation-app.tsx:64`) yang **tidak**
dibersihkan oleh `reset()` — menandakan inkonsistensi: sebagian pekerjaan hilang, sebagian tertinggal.

### T2.4 Makna `mode.selected` / `mode` di state

Tidak ada field `mode.selected` secara literal di kode; makna "mode terpilih" diwakili oleh state
`mode: DocStationMode | null` (`docstation-app.tsx:50`). Observasi:

- `mode === null` ⇒ pengguna berada di langkah 1 (`ModePicker`, dirender pada `docstation-app.tsx:210`).
- `mode === "scan" | "print"` ⇒ alur aktif; `step` kemudian mengindeks sub-langkah.
- Perpindahan mode lewat `applyMode` (`docstation-app.tsx:112-121`) **selalu** memanggil
  `doc.resetSession()` dan `setStep(2)`. Jadi "ganti mode" identik dengan "hapus sesi lalu mulai dari
  langkah 2". Ini berarti `mode` bukan hanya penanda pilihan, melainkan juga _pemicu reset_.
- `applyReset` menetapkan `mode = null`, sehingga konsep "mode terpilih namun tidak aktif" **tidak
  dapat direpresentasikan**. Tidak ada cara menyimpan mode sebelumnya untuk kembali tanpa clear.

Konsekuensi desain: karena pilihan mode terikat erat pada reset, setiap kebutuhan "kembali ke Mode"
atau "ganti mode" berujung pada kehilangan data. Pemodelan ulang diperlukan agar **pemilihan mode**
dan **pengosongan data** menjadi dua operasi berbeda.

### T2.5 Stepper tidak interaktif

Bukti: `wizard-stepper.tsx:31-66` — item langkah dirender sebagai `<div>`/`<span>` tanpa `onClick`,
`role="button"`, atau `tabIndex`. Satu-satunya atribut aksesibilitas adalah `aria-current` untuk
langkah aktif (`wizard-stepper.tsx:41`). Karena itu, bahkan bila stepper ditampilkan di semua langkah,
ia belum dapat digunakan sebagai kontrol navigasi. Ini penting untuk rencana implementasi (bagian 4).

---

## 3. Opsi Solusi + Rekomendasi

### Opsi A — Minimalkan perubahan: aktifkan stepper & ganti handler Kembali (DIREKOMENDASIKAN)

- Tampilkan `WizardStepper` **selalu** (termasuk `step === 1`), menampilkan 4 langkah tetap: Mode,
  Konfigurasi, Edit, Simpan. Indikator step aktif sudah ada (`isActive`/`isPassed` pada
  `wizard-stepper.tsx:34-36`) dan bisa langsung dipakai.
- Ganti `onBack` pada Konfigurasi/Upload dari `reset` menjadi `goToStep(1)` (atau `goToStep(prev)`),
  yang **hanya** mengubah `step` tanpa menyentuh `doc.resetSession()`.
- Tambahkan tombol **"Mulai Sesi Baru"** terpisah (destruktif) yang memanggil `reset()` — dengan dialog
  konfirmasi eksplisit, terlepas dari status `busy`.
- Tambahkan navigasi **"Kembali ke Edit"** pada `SavePanel` (`onBack` sudah ada di props;
  `docstation-app.tsx:255` mengarahkannya ke `setStep(3)` — perlu dipastikan tidak memicu reset; saat ini
  memang aman).

**Kelebihan:** perubahan kecil, risiko rendah, langsung menyelesaikan keluhan utama (stepper & kehilangan
data). **Kekurangan:** stepper belum interaktif (navigasi tetap via tombol panel).

### Opsi B — Stepper interaktif penuh

Seperti Opsi A, ditambah menjadikan tiap langkah stepper dapat diklik untuk lompat ke langkah tersebut
(dengan guard `step <= maxReachedStep`), sehingga pengguna dapat bebas maju-mundur. Perlu penambahan state
`maxStepReached` atau validasi data per langkah (mis. tidak boleh ke Edit bila 0 halaman).

**Kelebihan:** UX paling baik, navigasi konsisten. **Kekurangan:** lebih banyak perubahan; butuh
aturan kapan langkah boleh diklik (mis. Edit butuh ≥1 halaman, Simpan butuh ≥1 halaman).

### Opsi C — Pisahkan alur menjadi rute/URL per langkah

Mengangkat `step` menjadi segmen rute (`?step=2`) agar tombol browser/back bekerja.

**Kelebihan:** riwayat navigasi native. **Kekurangan:** perubahan arsitektur besar, di luar lingkup,
dan `step` masih bergantung pada state mesin non-serializable (`stateRef`). Tidak direkomendasikan
untuk iterasi ini.

### Rekomendasi akhir

Terapkan **Opsi A** sekarang (cepat, aman, menyembuhkan bug kehilangan data), lalu lanjutkan ke
**Opsi B** sebagai peningkatan UX terpisah. Prinsip wajib:

1. **Stepper selalu terlihat** dan menampilkan 4 langkah (Mode, Konfigurasi, Edit, Simpan) dengan
   indikator aktif yang jelas untuk mode scan (dan tetap 3 langkah untuk mode print, atau 4 langkah
   dengan label "Unggah/Cetak" — lihat risiko di bagian 4).
2. **Navigasi maju-mundur tidak menghilangkan data**: "Kembali" hanya `setStep`; dilarang memanggil
   `resetSession`.
3. **`reset` hanya pada aksi eksplisit "Mulai Sesi Baru"**, dengan konfirmasi, tanpa bergantung pada
   `busy`.
4. **Langkah Mode tetap jelas** dan dapat dikembalikan kapan pun tanpa clear data (mode boleh berubah,
   tetapi perpindahan mode tidak boleh otomatis menghapus halaman tanpa konfirmasi).

---

## 4. Rencana Implementasi Terperinci

> Catatan: seluruh perubahan di bawah adalah **rencana**. Tidak ada satu pun yang diterapkan pada task ini.

### 4.1 `wizard-stepper.tsx` — hapus kondisi sembunyi (dilakukan di pemanggil) + tambah label/step

Masalah sembunyi berada di pemanggil (`docstation-app.tsx:206`), bukan di dalam komponen. Namun
komponen perlu disesuaikan agar menerima langkah 1 dengan benar.

- **Label langkah:** pertahankan array `scan` 4 langkah (Mode, Konfigurasi, Edit, Simpan) di
  `wizard-stepper.tsx:12-21`. Untuk `print`, tambahkan label konsisten agar jumlah langkah tetap bisa
  dibandingkan (opsi: 3 langkah "Mode, Unggah, Cetak", atau 4 langkah "Mode, Unggah, Cetak, Selesai").
  Rekomendasi: biarkan print 3 langkah agar semantik "Simpan" tidak muncul di alur print.
- **Kemampuan opsional (untuk Opsi B):** tambahkan prop opsional
  `onStepClick?: (n: number) => void` dan `maxReached?: number`, serta ubah `<div>` langkah menjadi
  `<button type="button" disabled={s.n > maxReached}>` dengan `aria-current` yang sudah ada. Ini menjaga
  aksesibilitas (target kontrol nyata, bukan div).
- **Jangan** ubah gaya visual yang sudah ada (`cn`, kelas aktif/passed) agar konsisten dengan tema.

### 4.2 `docstation-app.tsx` — ganti handler "Kembali" dari `reset` menjadi `goToStep`

- Tambahkan helper navigasi non-destruktif:
  ```tsx
  const goToStep = useCallback((n: number) => {
    setStep(n); // TIDAK memanggil doc.resetSession()
  }, []);
  ```
- Ubah pemanggilan `ScanConfigPanel` (`docstation-app.tsx:230`): `onBack={reset}` →
  `onBack={() => goToStep(1)}` (atau `goToStep(step - 1)` setelah mengekstrak step).
- Ubah pemanggilan `UploadPanel` (`docstation-app.tsx:262`): `onBack={reset}` → `onBack={() => goToStep(1)}`.
- Biarkan `SavePanel.onBack` tetap `() => setStep(3)` (`docstation-app.tsx:255`); ini sudah non-destruktif.
- **Tambahkan tombol "Mulai Sesi Baru" terpisah**, mis. di header (dekat `PrinterStatusBadge`) atau di
  footer tiap panel, yang memanggil `reset()`. Karena `reset()` saat ini meminta konfirmasi hanya bila
  `busy`, tambahkan **konfirmasi eksplisit selalu** untuk aksi ini (bisa memakai `AlertDialog` yang sudah
  ada, dengan jenis `pendingAction` baru seperti `{ kind: "new-session" }`).
- **Pisahkan pemilihan mode dari reset:** pertimbangkan `applyMode` agar tidak selalu `resetSession()`
  tanpa konfirmasi. Rekomendasi: bila sesi berisi halaman (`doc.pages.length > 0`), tampilkan dialog
  konfirmasi sebelum `applyMode` mengganti mode. Ini memperbaiki T2.4.
- **Stepper selalu tampil:** ubah `docstation-app.tsx:206` menjadi dirender untuk `mode` apa pun
  (termasuk `step === 1`), mis. `{mode && <WizardStepper mode={mode} step={step} />}`; untuk langkah 1
  sebelum mode dipilih, render stepper statis dengan langkah 1 aktif (opsional; jika ingin sederhana,
  render stepper begitu `mode` terpilih, dan pastikan `step` kembali ke 1 bila pengguna memilih
  "Kembali ke Mode" — lihat risiko R4.4).

### 4.3 `save-panel.tsx` — tambah navigasi "Kembali ke Edit"

- `SavePanel` **sudah** memiliki prop `onBack` dan tombol Kembali (`save-panel.tsx:459-461`) yang
  diarahkan ke `setStep(3)` oleh pemanggil. Untuk memperjelas, ubah label tombol dari "Kembali"
  menjadi **"← Kembali ke Edit"** agar tidak ambigu dengan "Kembali" pada langkah lain.
- Pastikan handler `onBack` saat `busy` tetap `disabled` (sudah ada: `disabled={busy}`,
  `save-panel.tsx:459`) untuk mencegah navigasi saat unggah/menyimpan berjalan.

### 4.4 Perubahan konkret per tombol (ringkasan tabel)

| Lokasi                                            | Label saat ini | Aksi saat ini                         | Aksi yang direkomendasikan                                    |
| ------------------------------------------------- | -------------- | ------------------------------------- | ------------------------------------------------------------- |
| `scan-config-panel.tsx:263`                       | "Kembali"      | `onBack={reset}` → hapus sesi         | `onBack={() => goToStep(1)}` — hanya ubah step                |
| `upload-panel.tsx` (via `docstation-app.tsx:262`) | "Kembali"      | `onBack={reset}` → hapus sesi         | `onBack={() => goToStep(1)}`                                  |
| `save-panel.tsx:459`                              | "Kembali"      | `onBack` → `setStep(3)`               | ubah label "Kembali ke Edit"; handler tetap                   |
| `editor-studio.tsx:404`                           | "Lanjut Cetak" | `onProceed` → `setStep(4)`/ganti alur | tetap; tambah tombol "Kembali ke Konfigurasi" bila diinginkan |
| Header/nav baru                                   | —              | —                                     | tambah "Mulai Sesi Baru" → `reset()` **dengan konfirmasi**    |
| Stepper                                           | —              | tidak tampil di step 1                | selalu tampil; indikator `isActive` untuk step aktif          |

### 4.5 Risiko & Regresi

- **R4.1 State tidak konsisten antar step.** `step` dan `mode` dikelola di dua `useState` terpisah
  (`docstation-app.tsx:50-51`) tanpa invariant tunggal. Mengizinkan lompat ke step mana pun bisa
  menghasilkan kombinasi tidak valid (mis. `step === 3` untuk print tanpa berkas). Mitigasi: validasi
  per step sebelum navigasi (Edit/Simpan butuh `doc.pages.length > 0`; Unggah→Cetak butuh
  `printFiles.length > 0`).
- **R4.2 Data hilang salah.** Jika `goToStep` keliru memanggil `applyMode`/`reset`, bug kehilangan data
  tetap ada. Mitigasi: satu-satunya pemanggil `reset`/`resetSession` harus aksi "Mulai Sesi Baru"
  (uji grep bahwa tidak ada `onBack={reset}` tersisa).
- **R4.3 Tombol "Kembali" ganda.** Setelah menambahkan "Kembali" di beberapa panel, pengguna bisa
  melihat dua tombol kembali (satu dari panel, satu bila stepper dibuat interaktif). Mitigasi: tentukan
  satu kanal utama (panel) dan buat stepper interaktif hanya sebagai pelengkap dengan gaya berbeda.
- **R4.4 Stepper di step Simpan.** `step === 4` untuk scan berarti "Simpan"; bila `WizardStepper` selalu
  tampil, pastikan highlight langkah 4 benar dan tidak menampilkan langkah print "Cetak" pada alur scan.
  Mitigasi: label step dipilih dari `mode` (sudah dilakukan di `wizard-stepper.tsx:12-21`).
- **R4.5 Perpindahan mode tanpa clear.** Memisahkan `applyMode` dari reset dapat membuat halaman hasil
  scan tetap ada saat berpindah ke print, berpotensi membingungkan (dan `readyToPrint`/`printFiles` bisa
  bercampur). Mitigasi: konfirmasi eksplisit saat sesi tidak kosong, atau tampilkan banner jelas bahwa
  halaman scan akan dibawa ke alur cetak.
- **R4.6 Objek URL bocor bila reset tidak pernah dipanggil.** Saat ini `resetSession` merevoke
  `sourceUrl`. Jika kita menghindari reset, pastikan tetap ada titik yang membersihkan URL saat unmount
  (sudah ada di `use-docstation.ts:135-147`) agar tidak ada kebocoran memori.

### 4.6 Kriteria Penerimaan (UA/uji)

1. Stepper terlihat pada langkah 1 (Mode) hingga langkah 4 (Simpan) untuk mode scan.
2. Menekan "Kembali" pada Konfigurasi tidak menghapus halaman (`doc.pages` tetap sama).
3. Kembali dari Edit ke Konfigurasi lalu maju lagi mempertahankan halaman & parameter.
4. "Mulai Sesi Baru" meminta konfirmasi lalu mengosongkan sesi (dan kembali ke `step === 1`,
   `mode === null`).
5. Tidak ada pemanggilan `resetSession` dari jalur navigasi biasa (verifikasi grep).

---

## 5. Pernyataan Kepatuhan

Dokumen ini disusun dalam **mode read-only**: seluruh berkas produksi hanya **dibaca** untuk
mengumpulkan bukti, dan **tidak ada kode produksi yang diubah, ditambah, atau dihapus**. Satu-satunya
berkas yang ditulis adalah laporan ini (`docs/docstation-research-wizard.md`). Semua referensi baris
dicantumkan sebagai bukti dan dapat berubah bila kode bergerak; periksa ulang sebelum implementasi.
