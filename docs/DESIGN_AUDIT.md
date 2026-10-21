# UI/UX Baseline Audit

Tanggal: 20 Oktober 2026  
Target: produksi `https://sdn1kenanga.sch.id` (read-only, tanpa mutasi data)  
Artefak: `docs/design-baseline/` (JSON) + screenshot lokal di `/tmp/opencode/baseline/`

## Metode

- Playwright (Chromium) pada 375 / 768 / 1024 / 1440 px.
- axe-core dengan tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` pada viewport 1440.
- Impeccable detektor v4.7.0: `npx impeccable detect app components --json`.
- Inventaris kode: impor ikon, file motion, komponen UI, ukuran build `out/`.
- Ulangi dengan: `npm run audit:ui` dan `npm run audit:design` (lihat catatan di bawah).

## Status implementasi (setelah Fase 1–4)

Diperbarui 20 Oktober 2026. Verifikasi terakhir di dev `http://sdn1kenanga.sch.id:3001`
dengan sesi admin; produksi belum dideploy ulang pada saat catatan ini dibuat.

| Area              | Status          | Bukti                                                                                    |
| ----------------- | --------------- | ---------------------------------------------------------------------------------------- |
| Tipografi         | Selesai         | Plus Jakarta Sans + Source Serif 4 via `next/font/local`; `--font-inter` dihapus.        |
| Kontras & label   | Selesai         | axe 0 pelanggaran (12 halaman), termasuk login dan dashboard.                            |
| Heading           | Selesai         | H1 ganda di top bar dashboard dihapus; satu H1 per halaman.                              |
| Motion            | Selesai         | `motion` 14 + `MotionConfig reducedMotion="user"`; 36 file memakai `motion/react`.       |
| Ikon              | Selesai         | 354 file Lucide v1.59; 0 referensi Tabler; `@tabler/icons-react` dihapus.                |
| Efek mati         | Selesai         | 9 komponen Aceternity tak terpakai dihapus; `components/ui` 58 → 49 file.                |
| Detektor desain   | Selesai         | `npx impeccable detect app components` → **0 temuan** (sebelumnya 28).                   |
| Hero landing      | Selesai         | Satu shader WebGL2 + poster fallback, pause offscreen/hidden, reduced-motion aman.       |
| Bundle            | Sedikit membaik | 15,88 MB JS / 350,7 KB CSS mentah; 132 MB `out/` total.                                  |
| Form              | Sebagian        | Validasi on-blur di 15 form (RHF); select hubungan shadcn; 28 `<select>` native tersisa. |
| Tabel/empty state | Selesai         | DataTable kini punya state loading, empty, error + retry; error boundary dashboard.      |
| Navigasi          | Selesai         | Breadcrumb desktop, fokus setelah route change, target sentuh mobile ≥44 px.             |
| Refresh visual    | Selesai         | Shell baru, Card solid, PageHeader, overview & landing dirombak, auth tanpa rainbow.     |

Angka baseline di bawah adalah kondisi **sebelum** perubahan dan disimpan sebagai
pembanding.

## Ringkasan temuan

| Area            | Temuan                                                                                                                                                                                                                   | Dampak                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Tipografi       | `--font-sans: var(--font-inter)` tetapi `--font-inter` tidak pernah didefinisikan; tidak ada web font di `out/`. UI memakai font default browser dan berbeda per OS.                                                     | Tinggi — identitas visual tidak konsisten.  |
| Kontras         | 11 dari 12 halaman punya pelanggaran `color-contrast` (serious). Contoh: footer `text-white/50` (3.15:1), `text-white/60` (3.84:1), versi `text-black/20` (1.3–1.6:1), `text-green-600`/`text-blue-600/70` untuk status. | Tinggi — gagal WCAG AA.                     |
| Nama tombol     | `button-name` critical: combobox Radix tanpa label di `/katalog-buku` (2) dan `/admin/siswa` (3), tombol ikon di `/tabungan` (1).                                                                                        | Tinggi — tidak terbaca screen reader.       |
| Heading         | Dashboard menampilkan dua `<h1>` pada satu halaman (`/overview`: “Beranda” + “Selamat pagi”, `/admin/siswa`: dua “Manajemen Siswa”).                                                                                     | Sedang — struktur heading tidak semantik.   |
| Motion          | 40 file memakai `framer-motion`; hanya 3 file + 1 aturan CSS yang menangani `prefers-reduced-motion`. Durasi/easing ad-hoc (0.15–0.8 s; 7× `easeInOut`, 6× spring).                                                      | Tinggi — aksesibilitas & konsistensi gerak. |
| Ikon            | 352 file Lucide + 2 ikon Tabler di sidebar. Tidak ada brand icon Lucide yang dipakai.                                                                                                                                    | Rendah — mudah disatukan.                   |
| Efek dekoratif  | 9 dari 12 komponen Aceternity tidak dipakai (`background-beams`, `bento-grid`, `card-hover-effect`, `meteors`, `sparkles`, `stars-background`, `text-generate-effect`, `tracing-beam`, `3d-card`).                       | Rendah — dead code.                         |
| Detektor desain | 28 temuan di 21 file: 12 `ai-color-palette` (gradien ungu/indigo), 4 `side-tab`, 4 `border-accent-on-rounded`, 3 `gradient-text`, 4 `bounce-easing` (advisory), 1 `overused-font` (Arial).                               | Sedang — konsistensi visual.                |
| Komponen        | 58 file `components/ui`; belum ada primitif shadcn `Field`, `InputGroup`, `Empty`, `Spinner`, `Kbd`, `Breadcrumb`, `Pagination`, `Drawer`, `ToggleGroup`. 29 `<select>` native vs 88 impor shadcn Select.                | Sedang — form/tabel belum seragam.          |
| Struktur        | 12 halaman >1.000 baris (terbesar 1.332 baris).                                                                                                                                                                          | Sedang — sulit dijaga konsisten.            |
| Build           | `out/` 131 MB; 300 file JS (15,8 MB mentah) + CSS 352 KB (mentah); chunk terbesar 1,5 MB. Angka ini total seluruh rute, bukan satu halaman.                                                                              | Sedang — perlu audit bundle per rute.       |

## Hasil per halaman (1440 px)

| Halaman         | DOM nodes | Tinggi | axe | Detail                      |
| --------------- | --------: | -----: | --: | --------------------------- |
| `/`             |       390 |  3.170 |   1 | contrast ×3                 |
| `/login`        |       209 |    900 |   1 | contrast ×6                 |
| `/spmb`         |       403 |  3.712 |   1 | contrast ×3                 |
| `/daftar-ortu`  |       264 |  1.232 |   1 | contrast ×3                 |
| `/berita`       |       203 |  1.344 |   1 | contrast ×3                 |
| `/katalog-buku` |       612 |  3.226 |   2 | button-name ×2, contrast ×4 |
| `/overview`     |       582 |    900 |   1 | contrast ×8                 |
| `/admin/siswa`  |     1.085 |    900 |   2 | button-name ×3, contrast ×3 |
| `/tabungan`     |       555 |    900 |   2 | button-name ×1, contrast ×3 |
| `/presensi`     |       536 |    900 |   1 | contrast ×6                 |
| `/pengaturan`   |       426 |    900 |   1 | contrast ×3                 |
| `/keuangan`     |       380 |    900 |   1 | contrast ×4                 |

Total: **3 temuan critical** (nama tombol) dan **12 jenis temuan serious** (kontras) di 12 halaman.

## Detektor Impeccable — 28 temuan

| Aturan                     | Jumlah | Contoh lokasi                                                                                                                             |
| -------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-color-palette`         |     12 | `tabungan/page.tsx` (`from-purple-500`), `pengaturan/tab-ai-provider.tsx`, `perpustakaan/binding/page.tsx`, `ruang-tumbuh/game-shell.tsx` |
| `side-tab`                 |      4 | `admin/notifikasi/page.tsx`, `arsip/surat-keluar/detail/client-page.tsx`, `pengaturan/tab-sistem.tsx`, `rich-text-editor.tsx`             |
| `border-accent-on-rounded` |      4 | dua `kartu-preview.tsx` (`border-t-2`, `border-b-2`)                                                                                      |
| `gradient-text`            |      3 | `ruang-tumbuh/page.tsx`, `inventaris-client.tsx`, `perpustakaan-client.tsx`                                                               |
| `bounce-easing` (advisory) |      4 | `admin/siswa/import/page.tsx`, `arsip/surat-masuk/baru/page.tsx`, `chat/message-list.tsx`, `scan/unified-qr-workbench.tsx`                |
| `overused-font`            |      1 | `inventaris/label/client-page.tsx` (Arial untuk label cetak)                                                                              |

Catatan: `overused-font` pada label cetak adalah keputusan sadar (Arial untuk kompatibilitas printer), jadi kandidat untuk `ignore` berkonfigurasi, bukan diperbaiki.

## Inventaris teknis

- **Ikon (kini):** 354 file mengimpor `lucide-react` v1.59; 0 referensi Tabler.
- **Motion (kini):** 36 file memakai `motion/react`; `MotionConfig reducedMotion="user"` di root; 5 file menangani reduced-motion eksplisit.
- **Font:** tidak ada `next/font`; `out/fonts/Liberation*.ttf` hanya untuk PDF, bukan UI.
- **Palet:** token teal + injeksi brand runtime (`lib/theme.ts`); utility glass masih memakai `zinc` di dark mode.
- **Shadcn:** `components.json` valid (style `new-york`, Tailwind v4, icon lucide); CLI belum terpasang sebagai dependency.
- **Cetak:** beberapa halaman sengaja memakai Arial/Times New Roman untuk kebutuhan cetak.

## Backlog prioritas

### P0 — perbaikan cepat (Fase 1–3)

1. Definisikan font web yang sebenarnya; hapus `--font-inter` yang undefined.
2. Perbaiki kontras: footer publik, label versi `#app-version`, teks status hijau/biru, `text-muted-foreground/30`.
3. Beri `aria-label` pada semua combobox filter dan tombol ikon.
4. Hilangkan `<h1>` ganda di dashboard (satu heading utama per halaman).
5. Tambahkan `MotionConfig reducedMotion="user"` dan audit animasi dashboard.
6. Satukan ikon ke Lucide; ganti 2 ikon Tabler.

### P1 — fondasi (Fase 1–2)

7. Token semantik `success/warning/info/focus`, `border-subtle/strong`, radius/elevasi; bersihkan `zinc`.
8. Token motion global + migrasi ke `motion@14`.
9. Tambah primitif shadcn yang kurang; hapus 9 efek tak terpakai.
10. Ganti gradien ungu/indigo dan side-tab dengan aksen brand teal.

### P2 — pola UX (Fase 3)

11. Form: label, hint, validasi on-blur, error inline + ringkasan, autofill, loading.
12. Tabel: empty/loading/error, sticky header, `aria-sort`, fallback mobile.
13. Navigasi: breadcrumb, fokus setelah route change, target sentuh ≥44 px.
14. axe di CI untuk 6 flow utama.

## Rencana penyebaran token warna (belum dikerjakan)

Diperbarui 21 Oktober 2026 setelah commit `77d1dcb` (galeri 148 preset tema +
warna teks otomatis) live di dev `:3001` dan prod `:8181`.

Perbaikan global (shell dashboard, header, sidebar, footer, kontras teks, preset
tema) sudah aktif di semua halaman karena memakai token bersama. Yang belum
seragam adalah modul yang masih menyimpan warna hardcoded: **309 file, 6.927
kelas warna Tailwind, 323 hex** di `app/` dan `components/` (di luar
`components/dashboard` dan `components/public` yang sudah bersih).

Aturan penggantian: pakai token semantik `primary`, `secondary`, `accent`,
`muted-foreground`, `text-soft`, `success`, `warning`, `info`, `destructive`,
`border-line`, `border-subtle`, `chart-1..5`. Warna status boleh memakai token
status, bukan `green-600`/`blue-600/70`/`zinc-500`. Hex baru tidak boleh
ditambahkan; hex yang ada diganti token.

Setiap fase = satu commit + deploy, dengan guardrail: `npx tsc --noEmit`,
`npx vitest run`, `npm run audit:design` → 0 temuan, dan axe (WCAG AA) 0
pelanggaran di halaman yang disentuh (desktop 1440 + mobile 390).

| Fase | Area                                                        | File |    Hit |
| ---- | ----------------------------------------------------------- | ---: | -----: |
| 1    | Publik, auth, portal orang tua, SPMB, katalog perpustakaan  |   35 |   ±790 |
| 2    | Admin (termasuk siswa) dan pengaturan                       |   75 |  2.116 |
| 3    | Akademik: presensi, bank soal, ruang tumbuh, tugas, praktik |   57 | ±1.280 |
| 4    | Operasional: keuangan, tabungan, inventaris, arsip, surat   |  107 | ±2.050 |
| 5    | Sisa: profil, docstation, kiosk, halaman status, UI bersama |   38 |   ±810 |

Angka per fase saling tumpang tindih sedikit (satu file bisa masuk dua cakupan);
total terukur tetap 309 file / 6.927 hit.

Catatan per fase:

- Fase 1: `app/(public)`, `app/(auth)`, `app/parent`, `components/spmb`, dan
  `components/perpustakaan`. Prioritaskan karena paling terlihat dan paling
  sering dibuka dari ponsel.
- Fase 2: `app/(dashboard)/admin` dan `app/(dashboard)/pengaturan` — dua area
  dengan hit terbanyak dan paling sering dipakai admin.
- Fase 3: `presensi` (301 hit), `bank-soal` (269), `ruang-tumbuh` (279),
  `tugas` + `tugas-saya` (186), `perpustakaan` (139), `praktik` (108).
- Fase 4: `arsip` (629 hit) dan `tabungan` (282) adalah sisa terbesar;
  `components/letters` + `letters/generator` (391) sebaiknya dikerjakan bersama
  karena saling impor. Termasuk `keuangan`, `inventaris`, `cloud-storage`,
  `components/finance`, `components/tabungan`, `components/inventaris`,
  `components/alumni`, `components/master`, `components/gallery`,
  `components/arsip`, dan `components/loans`.
- Fase 5: `profil`/`profile`, `docstation`, root `app/*` (layout, error,
  not-found, maintenance, offline), `kiosk`, `kiosk-kelas`, `kiosk-komputer`,
  `s`, `app/tabungan`, `components/ui`, `components/chat`,
  `components/attendance`, `components/scan`, dan komponen bersama lain. Kiosk
  (`app/kiosk`, `app/kiosk-kelas`) masing-masing 113 hit dan berbagi tampilan,
  jadi kerjakan berurutan dalam satu commit.
- Pengumuman ke pengguna sebaiknya setelah Fase 2, saat halaman tersibuk sudah
  seragam.

Cek progres cepat:

```bash
grep -roE "\b(bg|text|border|ring|from|to|via)-(red|green|blue|amber|emerald|indigo|rose|purple|violet|teal|cyan|orange|yellow|lime|sky|fuchsia|pink|slate|gray|zinc|neutral|stone)-[0-9]{2,3}" app components --include=*.tsx | wc -l
```

## Cara menjalankan ulang

```bash
# Detektor desain (tanpa token)
npm run audit:design

# Audit UI publik
BASE_URL=http://localhost:8181 npm run audit:ui

# Audit termasuk dashboard (token hanya via environment)
BASE_URL=https://sdn1kenanga.sch.id \
SESSION_TOKEN="<jwt>" \
USER_INFO='{"id":"...","role":"superadmin"}' \
OUT_DIR=/tmp/sekolahku-audit \
npm run audit:ui
```

Catatan:

- `npm run audit:ui` menulis screenshot dan `report.json` ke `OUT_DIR` (default `docs/design-baseline/run`, sudah di-gitignore).
- `npx impeccable detect` mengembalikan exit code `2` bila ada temuan; itu normal untuk baseline.
- Telemetry Impeccable dapat dimatikan dengan `npx impeccable telemetry off`.
- Audit produksi hanya melakukan GET; tidak ada data yang diubah.

## Hero shader

- Komponen: `components/public/hero-shader.tsx`; sumber: `components/public/hero-shader-source.ts`.
- Hanya di `/`; poster CSS menjadi fallback saat reduced-motion, WebGL gagal, atau context lost.
- Canvas `aria-hidden`, `pointer-events-none`; scrim kiri `from-background/80` menjaga kontras.
- Resolusi internal 0,7× desktop / 0,85× mobile, DPR ≤1,5, maks 1920 px; pause saat tab hidden/off-screen.
- axe landing: 0 pelanggaran.

## Baseline artifacts

- `docs/design-baseline/report.json` — hasil Playwright + axe + metrik.
- `docs/design-baseline/login-page.json` — hasil khusus login.
- `docs/design-baseline/impeccable.json` — 28 temuan detektor.
- Screenshot lengkap: `/tmp/opencode/baseline/*.png` (tidak di-commit karena halaman dashboard memuat data produksi).
