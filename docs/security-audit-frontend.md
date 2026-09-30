# Audit Keamanan Frontend — Sekolahku

Tanggal audit: 2026-01-27
Cakupan: `app/`, `actions/`, `components/`, `lib/` (kecuali `lib/tabungan`, `lib/library`, `lib/docstation`), `next.config.ts`, `package.json`.
Metode: pembacaan kode statis (tanpa menjalankan aplikasi). Tidak ada kode produksi yang diubah.

---

## 1. Ringkasan

Aplikasi adalah Next.js 16 (App Router) yang di-build dengan `output: "export"` (HTML statis ditanam ke binary Go). Seluruh autentikasi, otorisasi, CSRF, dan sanitasi sisi-server ditangani backend Go; frontend bersifat **thin client** yang memanggil `/api/*` dengan `credentials: "include"`.

**Kekuatan yang sudah ada:**

- `lib/security.ts` menyediakan `sanitizeHTML` (DOMPurify, allowlist tag/attr), `sanitizeText`, `escapeHTML`, `sanitizeUrl`, serta helper validasi (email/phone/NIK).
- `dangerouslySetInnerHTML` untuk konten berita (`app/(public)/berita/detail/page.tsx`) sudah dibungkus `sanitizeHTML()`.
- URL aset upload diklasifikasikan (`lib/upload-url.ts`): folder privat hanya lewat `/api/files/*` terautentikasi.
- CSRF token (`csrf_token` cookie) otomatis disertakan pada semua request mutasi (`lib/api-client.ts`, `lib/cloudstorage/api.ts`).
- Sesi utama disimpan sebagai cookie **HttpOnly** `session` (kebenaran diverifikasi di backend tiap request); `localStorage` sengaja tidak lagi dipakai sebagai sumber sesi (`actions/auth.ts`).
- `components/auth-guard.tsx` memverifikasi sesi lewat `/api/profile` sebelum render dashboard/parent.

**Kelemahan utama:** karena mode statis, **tidak ada header keamanan HTTP** (HSTS, X-Content-Type-Options, dll.) dan **tidak ada route protection di edge/server** — seluruh guard berjalan di klien. CSP diset lewat `<meta http-equiv>` dan terpaksa memakai `unsafe-inline`/`unsafe-eval`. Ada beberapa titik XSS manual (HTML string + `innerHTML`) dan kanal identitas non-HttpOnly (`user_info`, `csrf_token`) yang dapat dibaca/dimodifikasi klien.

**Catatan:** kerentanan dependency tidak dapat diverifikasi tanpa `npm audit`/database CVE; hanya versi mencurigakan yang dicatat (lihat Temuan 6).

---

## 2. Temuan

### Temuan 1 — CSP lemah: `unsafe-inline` + `unsafe-eval` (Severity: Tinggi)

- **File:** `app/layout.tsx` (`<meta httpEquiv="Content-Security-Policy" ...>`)
- **Detail:** CSP memakai `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`. `unsafe-inline` membuat CSP tidak efektif melawan XSS (inline script yang disuntik tetap dieksekusi); `unsafe-eval` memperlebar dampak. `connect-src 'self' https: wss: blob:` mengizinkan eksfiltrasi ke host https mana pun. Tidak ada `require-trusted-types-for`.
- **Dampak:** jika ada satu celah HTML injection (Temuan 2/3), penyerang dapat menjalankan script bebas; `connect-src https:` memudahkan pengiriman data curian ke server penyerang.
- **Rekomendasi:** hosting adalah binary Go yang menyajikan aset statis — set header CSP di layer Go/proxy (nginx) alih-alih `<meta>` agar bisa pakai nonce/hash. Minimal pertahankan `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; batasi `connect-src` ke origin API + wss sekolah; hapus `unsafe-eval` bila memungkinkan (audit kebutuhan lib 3D/pdf.js); pertimbangkan Trusted Types bertahap.

### Temuan 2 — HTML string generation untuk cetak berpotensi XSS (Severity: Sedang–Tinggi)

- **File:** `lib/letter-html.ts`
- **Detail:** `generateLetterHtml()` membangun dokumen HTML lengkap dari data surat/variabel melalui template literal, lalu hasilnya dicetak (pola serupa di `lib/letter-docx.ts`/`letter-image.ts`). Helper `esc()` hanya meng-escape `& < >` (bukan `"` maupun `'`) dan `sanitizeUrl` tidak dipakai. Nilai masuk ke **atribut**: `<img class="kop-logo" src="${esc(logo)}">`, `src="${S(d.url)}"` (QR/TTD/gambar), `style="width:${w}px"`, dst. Nilai dari data surat (mis. `d.url`, `d.caption`, nama/jabatan) dapat menutup atribut dan menyuntik event handler.
- **Dampak:** DOM XSS bila penyerang dapat mengendalikan field dokumen surat (URL gambar/QR/TTD, caption, atau variabel data siswa). Berjalan di origin sekolah.
- **Rekomendasi:** untuk semua nilai yang masuk ke **atribut**, gunakan `escapeHTML()` (meng-escape `"` dan `'`) dan `sanitizeUrl()` untuk `src`/`href`; jangan menaruh nilai mentah di dalam `style`. Pertimbangkan merender surat lewat React/`@react-pdf` (sudah tersedia) alih-alih string HTML.

### Temuan 3 — `innerHTML` pada preview PDF (Severity: Rendah)

- **File:** `components/letter-builder/letter-pdf-preview.tsx`
- **Detail:** `container.innerHTML = ""` (clear) lalu `appendChild` canvas. Hanya menulis string kosong, jadi tidak inject data. Aman saat ini, tapi berdekatan dengan kanal DOM.
- **Dampak:** tidak ada dampak langsung; risiko kebersihan kode.
- **Rekomendasi:** ganti dengan `container.replaceChildren()` untuk menghindari kebiasaan menyentuh `innerHTML`.

### Temuan 4 — Identitas & token di cookie non-HttpOnly (`user_info`, `csrf_token`) (Severity: Sedang)

- **File:** `actions/auth.ts`, `lib/auth.ts`, `lib/nav-fallback.ts`, `lib/api-client.ts`, `lib/cloudstorage/api.ts`, `components/auth-guard.tsx`
- **Detail:** `user_info` (berisi `id`, `role`, `email`, `name`, `imp`) dibaca/ditulis dari JS (`document.cookie`) dan dipakai untuk **UI-level role/guard** (`auth-guard`, `layout-client` cek `user.role`). Cookie ini tidak HttpOnly sehingga dapat dimodifikasi via DevTools/JS. `csrf_token` juga dibaca JS (memang by design agar dapat dikirim sebagai header). Komentar di `actions/auth.ts` mengindikasikan `localStorage` pernah dipakai sebagai sumber sesi utama dan sempat bisa dipakai memalsukan role di UI.
- **Dampak:** pemalsuan `user_info` dapat mengubah tampilan/perilaku guard klien (menampilkan menu admin), meski operasi data tetap ditolak backend. `user_info` juga membocorkan role/email ke JS apa pun yang berjalan (memperparah Temuan 1). Jika backend sempat mempercayai role dari `user_info`, dapat menjadi eskalasi hak.
- **Rekomendasi:** pastikan backend **selalu** menurunkan role dari cookie `session` (HttpOnly), bukan `user_info`. Turunkan data `user_info` seminimal mungkin (hindari `email`/`name` bila tak perlu di JS; gunakan endpoint `/api/profile`). Terapkan `SameSite=Lax/Strict` + `Secure` pada `user_info` dan `csrf_token`. Dokumentasikan bahwa `user_info` murni kosmetik.

### Temuan 5 — Tidak ada middleware / route protection sisi-server (Severity: Sedang)

- **File:** tidak ada `middleware.ts`; guard di `components/auth-guard.tsx`, `app/(dashboard)/layout.tsx`, `app/parent/layout.tsx`, `lib/hooks/use-auth.tsx`
- **Detail:** Semua proteksi route dilakukan di **klien**. `AuthGuard` memakai flag global `globalVerified` (verify-once) dan melewati verifikasi untuk path `/profil/ganti-password`. Halaman statis (HTML) semua route dapat diunduh tanpa autentikasi.
- **Dampak:** (a) tidak mencegah akses ke bundel/konten statis halaman; (b) pola "verify once" membuat navigasi berikutnya tidak diverifikasi ulang (sesi kedaluwarsa hanya tertangkap oleh handler 401 per-API); (c) by design data tetap di backend, jadi dampak terbatas pada UI. Namun keamanan bergantung sepenuhnya pada ketepatan otorisasi server.
- **Rekomendasi:** karena mode export, tidak bisa memakai middleware Next. Dorong enforcement auth di server Go (redirect/403 untuk HTML protected) atau minimal pastikan setiap endpoint API memvalidasi sesi. Audit ulang pengecualian `/profil/ganti-password`.

### Temuan 6 — Dependency & versi mencurigakan (Severity: Rendah, perlu verifikasi)

- **File:** `package.json`
- **Detail:** Versi besar/penting: `next 16.1.1`, `react/react-dom 19.2.3`, `@sentry/nextjs ^10.32.1`, `isomorphic-dompurify ^2.35.0`, `jspdf ^4.1.0`, `mammoth ^1.11.0`, `docxtemplater ^3.67.6`, `@e965/xlsx ^0.20.3`, `three ^0.184.0`, `leaflet ^1.9.4`. Beberapa paket punya riwayat CVE: `docxtemplater` (template injection / prototype pollution pada versi lama), `mammoth`/`docx` (parsing dokumen), `@e965/xlsx` (fork SheetJS — SheetJS lama punya CVE prototype pollution), `jspdf`. Tidak ada `overrides`/`resolutions` untuk pinning patch keamanan; banyak dependency memakai caret `^`.
- **Dampak:** potensi RCE/DoS saat memproses dokumen/Excel yang tidak tepercaya (mis. import massal, template Word).
- **Rekomendasi:** jalankan `npm audit --omit=dev` di CI dan tambahkan langkah audit otomatis; verifikasi CVE untuk `docxtemplater`, `mammoth`, `@e965/xlsx`, `jspdf`; pertimbangkan pinning eksak + Dependabot. Validasi jenis/ukuran file di backend untuk endpoint import/upload (di luar cakupan tapi relevan).

### Temuan 7 — `NEXT_PUBLIC_*` dan info konfigurasi terekspos (Severity: Rendah)

- **File:** `lib/api-client.ts`, `lib/config.ts`, `.env.example`, `.env.production.example`
- **Detail:** Semua `NEXT_PUBLIC_*` tertanam di bundel klien (nama sekolah, NPSN, email, alamat, `NEXT_PUBLIC_API_URL`). **Tidak ditemukan secret sensitif** (`GEMINI_API_KEY`, `JWT_SECRET`, `CLOUDSTORAGE_*`, `VAPID_PRIVATE_KEY`, `BACKUP_ZIP_PASSWORD`) dalam variabel `NEXT_PUBLIC_*` — secret tersebut hanya muncul di file contoh env tanpa prefix publik, yang benar. Catatan: `NEXT_PUBLIC_API_URL` di `.env.production.example` bernilai `https://sdn1kenanga.sch.id/api` sedangkan `goFetch` menambahkan prefix path `/api/...` sehingga berpotensi double `/api/api`. Bukan celah keamanan langsung, tapi bisa menyebabkan misrouting.
- **Dampak:** hanya kebocoran informasi non-rahasia (data kontak sekolah memang publik).
- **Rekomendasi:** pertahankan disiplin: JANGAN pernah menaruh secret di `NEXT_PUBLIC_*`. Perbaiki nilai `NEXT_PUBLIC_API_URL` agar konsisten dengan prefix `goFetch` (root origin tanpa `/api`).

### Temuan 8 — Preview file via iframe/img pada origin aplikasi (Severity: Rendah–Informasi)

- **File:** `app/(dashboard)/cloud-storage/_components/file-preview-dialog.tsx`, `components/arsip/pdf-viewer.tsx`, `app/s/_components/share-page-client.tsx`, `components/document-viewer.tsx`
- **Detail:** preview memakai `<iframe src>`/`<img src>`/`<video>` ke endpoint file. Endpoint file sensitif dilindungi auth (`/api/files/*`); share publik memakai token. Namun `<iframe src=...>` untuk PDF/DOC membuka dokumen di origin aplikasi; bila respons file dapat dipaksa berisi HTML/JS dengan `Content-Type` yang salah, ada risiko XSS berbasis file. `document-viewer.tsx` dan `share-page-client.tsx` sudah memakai `rel="noopener noreferrer"`/`rel="noreferrer"` (baik).
- **Dampak:** rendah bila backend menyetel `Content-Type` benar + `X-Content-Type-Options: nosniff` untuk file tak tepercaya.
- **Rekomendasi:** pastikan backend mengirim `X-Content-Type-Options: nosniff` dan `Content-Disposition` yang tepat untuk semua file user-upload; tambahkan `sandbox` pada iframe PDF/DOC, atau tampilkan PDF lewat renderer sisi-klien (pola `letter-pdf-preview.tsx` yang memakai canvas lebih aman).

### Temuan 9 — Rate limit klien tidak dapat diandalkan (Severity: Informasi)

- **File:** `lib/security.ts` (`checkRateLimit`), `app/(auth)/login/page.tsx` (lockout di `localStorage`)
- **Detail:** lockout login disimpan di `localStorage` (`login_attempts`, `login_lockout_until`) dan `checkRateLimit` adalah `Map` in-memory. Keduanya mudah dilewati (hapus storage / reload).
- **Dampak:** tidak mencegah brute-force nyata.
- **Rekomendasi:** sudah ada rate limit serupa di backend; pastikan brute-force login dibatasi **di server**.

---

## 3. Skor Risiko per Kategori

Skala 0–10 (10 = paling berisiko).

| Kategori    | Skor       | Alasan                                                                                                                                                                                |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **XSS**     | **6 / 10** | `lib/letter-html.ts` membangun HTML string dengan escape atribut yang tidak lengkap + CSP `unsafe-inline` (Temuan 1, 2, 3, 8). Konten berita sudah disanitasi.                        |
| **CSRF**    | **3 / 10** | Token CSRF otomatis disertakan pada request mutasi via `lib/api-client.ts` & cloudstorage; cookie sesi HttpOnly. Enforcement akhir ada di backend (tidak diaudit di sini).            |
| **AuthZ**   | **5 / 10** | Otorisasi nyata di backend, tetapi guard klien rapuh: identitas/role dari cookie non-HttpOnly yang dapat dipalsukan, verify-once, tidak ada proteksi route sisi-server (Temuan 4, 5). |
| **Secrets** | **3 / 10** | Tidak ditemukan secret sensitif di `NEXT_PUBLIC_*`/bundel; hanya data publik sekolah. Risiko utama: disiplin ke depan + kanal cookie non-HttpOnly (Temuan 4, 7).                      |
| **Headers** | **7 / 10** | Tidak ada header keamanan HTTP (HSTS, XCTO, Referrer-Policy, X-Frame-Options) karena static export; CSP hanya via `<meta>` dan lemah (Temuan 1, 5).                                   |

**Skor risiko keseluruhan (rata-rata): ~4.8 / 10** — sedang. Model ancaman bergantung pada ketatnya backend Go; frontend sendiri tidak dapat menjamin keamanan, tetapi beberapa titik (XSS atribut, CSP) perlu ditutup.

---

## 4. Prioritas Perbaikan

**Prioritas 1 — Segera (1–2 minggu):**

1. Perbaiki escape atribut & URL pada `lib/letter-html.ts`: gunakan `escapeHTML()` + `sanitizeUrl()` untuk semua nilai yang masuk ke `src`/`href`/`style`. (Temuan 2)
2. Audit ulang backend: pastikan role otoritatif **selalu** dari cookie `session` (HttpOnly), bukan `user_info`. Tambahkan `SameSite=Lax/Strict` + `Secure` pada `user_info` dan `csrf_token`. (Temuan 4)
3. Perkuat CSP di layer HTTP (Go/nginx), hapus `unsafe-eval`, persempit `connect-src`, dan tambahkan header keamanan (HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`). (Temuan 1)

**Prioritas 2 — Jangka Pendek (2–4 minggu):** 4. Tetapkan `Content-Type`/`Content-Disposition`/`nosniff` di backend untuk semua file upload; tambahkan `sandbox` pada iframe PDF/DOC. (Temuan 8) 5. Jalankan `npm audit --omit=dev` di CI; verifikasi CVE `docxtemplater`/`mammoth`/`@e965/xlsx`/`jspdf`; aktifkan Dependabot. (Temuan 6) 6. Perbaiki nilai `NEXT_PUBLIC_API_URL` (hindari double `/api`). (Temuan 7)

**Prioritas 3 — Jangka Menengah (backlog):** 7. Pindahkan pembuatan dokumen surat ke renderer React/`@react-pdf` (hilangkan HTML string manual). (Temuan 2/3) 8. Pastikan enforcement auth & rate limit login benar-benar terjadi di server Go; dokumentasikan `user_info` sebagai kosmetik. (Temuan 5/9) 9. Terapkan Trusted Types secara bertahap dan evaluasi ulang kebutuhan `unsafe-inline`. (Temuan 1)

---

## 5. Batasan Audit

- Analisis statis saja; tidak ada pengujian dinamis, fuzzing, atau `npm audit` nyata.
- Otorisasi/CSRF/sanitasi sisi **server (Go)** tidak termasuk cakupan; beberapa temuan hanya dapat dipastikan setelah memeriksa backend.
- Kategori `lib/tabungan`, `lib/library`, `lib/docstation` dikecualikan sesuai permintaan.
- Versi dependency dicatat apa adanya dari `package.json`; tidak diverifikasi terhadap database kerentanan.
