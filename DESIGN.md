# DESIGN.md — Sekolahku

Dokumen ini mencatat sistem visual yang **sudah ada** dan aturan yang berlaku
saat menambah/mengubah UI. Keputusan produk ada di `PRODUCT.md`.

## Prinsip

1. Tenang dan terbaca: teal sekolah, permukaan lapang, aksen secukupnya.
2. Konsisten lebih penting daripada meriah; efek dekoratif harus punya alasan.
3. Mobile-first untuk portal orang tua dan halaman publik.
4. Aksesibilitas bukan lapisan akhir: kontras, fokus, label, dan reduced-motion
   diperiksa bersamaan dengan implementasi.
5. Komponen shadcn/Radix lebih diutamakan daripada komponen baru.

## Token warna

Sumber: `app/globals.css` + injeksi brand `lib/theme.ts`.

| Peran            | Nilai saat ini              | Catatan                            |
| ---------------- | --------------------------- | ---------------------------------- |
| Primary          | `#0A3D4A`                   | Bisa diganti admin (runtime).      |
| Secondary        | `#98D8D0`                   | Aksen lembut.                      |
| Accent           | `#4FB8B4`                   | Sorotan/hover.                     |
| Background       | `#E2F4F0`                   | Mint terang.                       |
| Foreground       | `#04222B`                   | Teks utama.                        |
| Muted foreground | `#1D8B94`                   | Hati-hati kontras pada teks kecil. |
| Border/input     | `#10606F`                   | Kuat; turunkan untuk divider.      |
| Destructive      | `oklch(0.577 0.245 27.325)` | Aksi berbahaya.                    |

Dark mode: surface `#04222B`, card `#0A3D4A`, primary `#4FB8B4`. Token brand
runtime hanya mengganti primary di dark mode; surface gelap tetap milik globals.

**Aturan:** jangan menambah hex/`zinc` baru di komponen. Pakai token semantik.
Token yang direncanakan: `surface`, `surface-raised`, `border-subtle`,
`border-strong`, `success`, `warning`, `info`, `focus-ring`.

## Tipografi

- **Plus Jakarta Sans** (variable, 200–800) untuk UI, dimuat via `next/font/local`
  dari `app/fonts/`, dengan fallback sistem dan `display: swap`.
- **Source Serif 4** (variable, 200–900) untuk aksen editorial halaman publik;
  `preload: false`, dimuat saat kelas `font-serif` dipakai.
- Skala: 12 / 14 / 16 / 18 / 24 / 32 px. Body minimal 14 px (publik 16 px).
- Label minimal 12 px; hindari teks <12 px untuk informasi penting.
- Line-height body 1.5–1.75; panjang baris 60–75 karakter di desktop.
- Angka uang memakai `tabular-nums`.

## Bentuk, ruang, elevasi

- Radius dasar `0.75rem`; input 12, card 16, dialog 20, pill penuh.
- Spacing kelipatan 4/8; hierarki vertikal 16/24/32/48.
- Elevasi 3 tingkat (`card-depth-1/2/3`); hindari shadow acak.
- Border divider memakai `border-subtle`; border input tetap kuat.

## Komponen

- Basis: `components/ui` (shadcn, gaya `new-york`, Radix, Tailwind v4).
- Form: label terlihat, hint persisten, error di bawah field, `aria-describedby`.
- Tabel: header sticky, empty/loading/error state, pagination, `aria-sort`.
- Dialog: gunakan Radix focus trap; konfirmasi aksi destruktif.
- Toast: Sonner; jangan jadikan satu-satunya tempat error form.
- Komponen efek (Aceternity) hanya untuk halaman publik; 9 dari 12 tidak dipakai
  dan akan dihapus. Jangan menambah efek baru tanpa kebutuhan.

## Ikon

- Keluarga utama: **Lucide**. Tabler dipensiunkan (tinggal 2 ikon di sidebar).
- Ukuran: 14/16/20/24 px; stroke konsisten 1.75 atau 2.
- Ikon dekoratif: `aria-hidden="true"`. Ikon kontrol: `aria-label` atau teks.
- Tidak memakai emoji sebagai ikon struktural.

## Motion

- Paket: `motion` (migrasi dari `framer-motion`), import `motion/react`.
- Durasi: fast 120 ms, base 180 ms, slow 240 ms; exit 60–70% durasi enter.
- Hanya `transform`/`opacity`; jangan animasi width/height.
- Wajib menghormati `prefers-reduced-motion`; sediakan keadaan akhir statis.
- Maksimal 1–2 elemen bergerak per view. Tidak ada bounce/elastic.
- `MotionConfig reducedMotion="user"` di root.

## Layout

- Container maksimal 1280 px; padding bertahap 16/24/40/64.
- Mobile-first; breakpoint acuan 375/768/1024/1440.
- Target sentuh web minimal 24×24 px, target utama ≥44 px.
- `min-h-dvh` untuk layar penuh; hindari `100vh` di mobile.
- Navigasi utama konsisten; bottom-nav maksimal 5 item.

## Hero publik dan shader

- Landing boleh memakai **satu** hero shader (WebGL2, poster fallback).
- Shader hanya latar dekoratif: `aria-hidden`, `pointer-events-none`, tanpa
  informasi penting; teks tetap di atas scrim yang menjaga kontras.
- Wajib: pause saat tab hidden/keluar viewport, DPR ≤1.5, fallback poster saat
  reduced-motion atau WebGL tidak tersedia.
- Tidak ada shader di dashboard atau halaman transaksional.

## Aksesibilitas

- Kontras teks normal ≥4.5:1; teks besar/non-teks ≥3:1.
- Fokus terlihat, tidak tertutup sticky header/modal.
- Satu `<h1>` per halaman; heading berurutan.
- Form: label + hint + error terhubung; error summary memfokuskan field pertama.
- Semua tombol ikon punya nama aksesibel.

## Jangan

- Gradien ungu/indigo, side-tab border, gradient text, bounce.
- Glassmorphism berlapis di dalam kartu (card dalam card).
- Teks abu-abu di atas warna brand tanpa cek kontras.
- Menambah dependency komponen baru (mis. daisyUI) tanpa keputusan eksplisit.
