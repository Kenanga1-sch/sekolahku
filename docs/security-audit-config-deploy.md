# Audit Keamanan — Konfigurasi Deployment & Manajemen Secret

Tanggal audit: 2026-06-24
Lingkup: konfigurasi deployment (Docker/Podman, nginx, vercel, systemd, CI/CD),
manajemen secret, permission file, hardening container, TLS/header, backup, dan
kebocoran PII via logging/Sentry.
Sifat: **audit baca-saja** — tidak ada kode produksi yang diubah.

> **Catatan penting:** Dokumen ini **tidak memuat nilai rahasia aktual**
> (API key, JWT secret, password, token). Hanya membahas **ada/tidak ada** dan
> **lokasinya**. Bila menemukan nilai default yang harus diganti, yang
> dicantumkan hanyalah penanda posisi (mis. "nilai default di `server.py`").

File yang dibaca (konteks):
`Dockerfile`, `docker-compose.yml`, `nginx.conf`, `vercel.json`,
`sentry.client.config.ts`, `sentry.edge.config.ts`, `sentry.server.config.ts`,
`scripts/*.sh`, `scripts/post-receive`, `deploy.sh`, `sekolahku.service`,
`integrations/docstation/docker-compose.yml`,
`integrations/docstation/cloudflared-config.yml.example`,
`integrations/docstation/server.py`, `integrations/docstation/Dockerfile`,
`integrations/docstation/REMOTE_ACCESS.md`, `go-backend/cmd/api/main.go`,
`go-backend/cmd/api/static.go`, `go-backend/internal/middleware/auth.go`,
`go-backend/internal/handlers/docstation_handler.go`,
`go-backend/internal/handlers/backup_crypto.go`, `lib/env.ts`, `lib/config.ts`,
`.env.example`, `.env.production.example`, `.gitignore`, `.dockerignore`,
`backup.bat`, `deep_check.sh`, `ppid.sh`, `verify_db_in_cont.sh`.

Catatan: `go-backend/internal/config/config.go` **tidak ada** di repo; konfigurasi
env Go ditangani oleh `loadEnv()` di `go-backend/cmd/api/main.go` dan
`internal/middleware/auth.go`.

---

## 1. Ringkasan

Secara umum posture keamanan deployment **cukup matang** untuk aplikasi sekolah
yang di-hosting mandiri:

- Backend Go **menolak start** bila `JWT_SECRET` kosong (`panic` di
  `InitJWTMiddleware`) — tidak ada fallback secret di kode produksi.
- Container produksi di-deploy dengan hardening yang baik pada **jalur
  `scripts/deploy.sh`**: `--cap-drop=ALL`, `no-new-privileges`, `--read-only`,
  `tmpfs /tmp`, dan Podman **rootless** (uid 0 container dipetakan ke uid host
  biasa, bukan root host).
- Backup lokal (`scripts/backup.sh`) **wajib terenkripsi** — gagal bila
  `BACKUP_ZIP_PASSWORD` kosong, dan memverifikasi hasil enkripsi.
- Backup Telegram di aplikasi memakai envelope AES-256-GCM + scrypt
  (`backup_crypto.go`).
- `nginx.conf` sudah memasang sejumlah header keamanan dan `server_tokens off`.
- `.gitignore` dan `.dockerignore` sudah mengecualikan `.env*`, `*.db`, `uploads`,
  `backups/`, dan kredensial.

Namun ada **temuan signifikan** yang perlu ditindaklanjuti, terutama pada
integrasi **DocStation** (`integrations/docstation/`) yang berisi secret
hardcoded/default, port yang dipublish di `docker-compose.yml`, dan artefak
PII/backup yang **ada di dalam working tree repo**.

| Prioritas | Jumlah |
| --------- | ------ |
| Critical  | 3      |
| High      | 4      |
| Medium    | 5      |
| Low/Info  | 5      |

---

## 2. Temuan

### CRITICAL

#### C-1. Password default hardcoded di DocStation server

- **Severity:** Critical
- **Lokasi:** `integrations/docstation/server.py` (nilai default `APP_PASSWORD`).
- **Detail:** Nilai `APP_PASSWORD` diambil lewat `os.getenv("DOCSTATION_PASSWORD", ...)`
  dengan **default yang tertulis langsung di source code** (terkait NPSN sekolah).
  Bila env `DOCSTATION_PASSWORD` tidak diset, server memakai password default itu.
- **Dampak:** Bypass autentikasi penuh pada endpoint scan/print DocStation bila
  diakses via LAN/Cloudflare Tunnel tanpa env yang benar. Endpoint `/api/print`,
  `/api/escl/*`, dan `/api/login` hanya dilindungi password ini.

#### C-2. Session secret default hardcoded di DocStation docker-compose

- **Severity:** Critical
- **Lokasi:** `integrations/docstation/docker-compose.yml`
  (`DOCSTATION_SESSION_SECRET` bernilai placeholder `change-me-secret`).
- **Detail:** docker-compose menetapkan nilai placeholder literal di dalam YAML
  yang ter-commit. Tidak ada mekanisme wajib-diisi (berbeda dengan `JWT_SECRET`
  di `docker-compose.yml` root yang memakai pola interpolasi wajib).
- **Dampak:** Sesi/cookie DocStation dapat diprediksi/dipalsukan. Sensitif
  karena DocStation mengekspos proxy ke printer LAN.

#### C-3. Artefak PII & backup DB ada di dalam working tree repo

- **Severity:** Critical
- **Lokasi:** direktori `backups/` (mis. `backups/db/sekolahku-*.db`,
  `backups/sekolahku_*.db`, `backups/files/uploads-*.tar.gz`),
  `go-backend/data/sekolahku.db`, `go-backend/go-backend/data/sekolahku.db`,
  serta banyak berkas di `public/uploads/` dan
  `go-backend/internal/handlers/uploads/`.
- **Detail:** Database SQLite produksi berisi **PII siswa** (nama, kelas, dll.)
  dan arsip tar uploads berada di dalam root repo yang diaudit. Meskipun
  `.gitignore` sudah memblokir `*.db`, `backups/`, dan `/uploads`, berkas-berkas
  ini **sudah ada di filesystem** dan sebagian **ter-track sebelumnya** (lihat
  komentar di `.gitignore`: "Upload runtime terlanjur ter-track ... butuh
  `git rm --cached` terpisah").
- **Dampak:** Kebocoran PII bila direktori repo ikut di-backup/di-rsync/dibagikan.
  `backups/*.db` adalah salinan DB; `uploads-*.tar.gz` adalah arsip foto siswa.

---

### HIGH

#### H-1. Port dipublish ke semua interface & jalur docker-compose tanpa hardening

- **Severity:** High
- **Lokasi:** `docker-compose.yml` (root).
- **Detail:**
  - `ports: - "8181:8181"` untuk app terikat ke semua interface (0.0.0.0).
  - Block `telegram-bot-api` mempublikasikan `"8081:8081"` ke host.
  - Root `docker-compose.yml` **tidak memakai** hardening yang ada di
    `scripts/deploy.sh` (tanpa `--read-only`, `--cap-drop=ALL`,
    `no-new-privileges`). Jalur `docker-compose` ini melemahkan hardening yang
    sudah dirancang untuk jalur Podman.
- **Dampak:** Bila `docker-compose.yml` dipakai langsung di server (bukan
  `deploy.sh`), layanan bind ke semua interface tanpa proteksi sebanding.

#### H-2. DocStation berjalan dengan network_mode host + cookie tidak Secure

- **Severity:** High
- **Lokasi:** `integrations/docstation/docker-compose.yml`.
- **Detail:** `network_mode: host` membuat container berbagi network namespace
  host; `DOCSTATION_SECURE_COOKIE=0` (cookie tidak Secure) sehingga cookie sesi
  bisa terkirim via HTTP polos. Kombinasi ini memperbesar dampak C-1/C-2.

#### H-3. Validasi TLS dinonaktifkan (InsecureSkipVerify) ke printer

- **Severity:** High
- **Lokasi:** `go-backend/internal/handlers/docstation_handler.go`
  (`tls.Config{InsecureSkipVerify: true}`), dan `server.py` (verifikasi TLS off).
- **Detail:** Untuk printer LAN self-signed, TLS tidak diverifikasi. Ini
  trade-off yang terdokumentasi dan wajar di segmen LAN, tetapi tetap dicatat
  karena memindahkan risiko ke jalur jaringan.

#### H-4. Dokumentasi mengizinkan DocStation diakses tanpa autentikasi

- **Severity:** High
- **Lokasi:** `integrations/docstation/REMOTE_ACCESS.md`.
- **Detail:** Bagian "Akses LAN" menyatakan login dilewati karena belum ada kata
  sandi. Meski ada bagian 3 yang mewajibkan mengaktifkan otentikasi, panduan ini
  berisiko dipakai apa adanya (default tanpa auth).

---

### MEDIUM

#### M-1. `nginx.conf` melayani `/uploads/` langsung & meng-cache publik

- **Severity:** Medium
- **Lokasi:** `nginx.conf` (`location /uploads/`).
- **Detail:** `root /home/kenanga/sekolahku-deploy;` melayani berkas di bawah
  `uploads/` dengan `expires 7d` dan `Cache-Control: public`. Backend Go
  membatasi folder privat (via `handlers.IsPublicUploadPath`), tetapi nginx
  tidak menyaring path — bergantung pada struktur direktori. Bergantung pada
  layout, file arsip/scan bisa ikut terlayani langsung dan ter-cache publik.

#### M-2. `nginx.conf` belum mengaktifkan HSTS dan HTTPS masih dikomentari

- **Severity:** Medium
- **Lokasi:** `nginx.conf` (server block `listen 80`; blok HTTPS dikomentari;
  baris `add_header Strict-Transport-Security` dikomentari).
- **Detail:** Instruksi yang aktif hanya HTTP. HSTS dan redirect HTTP ke HTTPS
  tidak aktif di nginx. (Aplikasi Go memang mengejar redirect HTTPS via
  `HTTPSRedirect` + `TRUST_PROXY=true` dan mengirim HSTS saat `ENV=production`,
  tetapi konfigurasi nginx sendiri belum.)

#### M-3. Backup lokal memakai AES-256-CBC, berbeda dari app (AES-256-GCM)

- **Severity:** Medium
- **Lokasi:** `scripts/backup.sh` (`openssl enc -aes-256-cbc -pbkdf2`) vs
  `go-backend/internal/handlers/backup_crypto.go` (AES-256-GCM).
- **Detail:** Backup lokal shell memakai CBC (tanpa autentikasi integritas
  bawaan) sedangkan backup in-app memakai AEAD (GCM). Meski ada verifikasi
  dekripsi setelah enkripsi, CBC tidak memberi jaminan integritas sekuat AEAD.
  Tidak konsisten antar jalur.

#### M-4. `vercel.json` SPA rewrite menyapu semua path

- **Severity:** Medium
- **Lokasi:** `vercel.json` (semua source di-rewrite ke `/index.html`).
- **Detail:** Semua path di-rewrite ke `index.html`. Untuk static export ini
  biasanya aman, tetapi bila ada aset server-side, rewrite global bisa
  menyamarkan 404 dan mempermudah enumerasi.

#### M-5. Permission uploads/DocStation terlalu terbuka (0755/0644)

- **Severity:** Medium
- **Lokasi:** `go-backend/cmd/api/static.go` (`os.MkdirAll(..., 0755)`),
  `docstation_handler.go` (`os.MkdirAll(dir, 0o755)`,
  `os.WriteFile(dest, body, 0o644)`).
- **Detail:** Direktori uploads dibuat world-readable/traversable (0755) dan
  berkas DocStation 0644. Untuk server multi-user, direktori PII sebaiknya 0750
  dan berkas sensitif 0640. (Backup app sudah benar: `0o600`.)

---

### LOW / INFO

#### L-1. Sentry: sebagian PII bisa lolos via event.user / breadcrumbs / replay

- **Severity:** Low
- **Lokasi:** `sentry.client.config.ts`, `sentry.server.config.ts`.
- **Detail:** `beforeSend` menghapus `request.cookies` dan header
  `authorization`/`cookie`, tetapi tidak membersihkan `event.user`
  (email/ID), breadcrumbs, atau query string. `replaysOnErrorSampleRate: 1.0`
  merekam sesi ketika error — replay dapat menampilkan PII di layar. DSN diambil
  dari env (baik, tidak hardcoded).

#### L-2. Default `server_name sekolah.example.com` dan path host spesifik

- **Severity:** Low
- **Lokasi:** `nginx.conf` (placeholder domain, `root` dengan path home user).
- **Detail:** Placeholder domain & path user spesifik di berkas yang di-commit;
  pastikan diganti di server dan tidak membocorkan struktur host.

#### L-3. Secret diteruskan lewat argumen/echo pada beberapa script

- **Severity:** Low
- **Lokasi:** `deploy.sh` (root: `sshpass -p`), `deep_check.sh` /
  `verify_db_in_cont.sh` (pola `echo` password lalu pipe ke `sudo -S`).
- **Detail:** Password SSH/sudo lewat argumen teks sehingga dapat muncul di
  daftar proses/`/proc`. Tidak ada nilai aktual di repo (diambil dari env),
  tetapi praktiknya berisiko. Opsi `StrictHostKeyChecking=no` juga melemahkan
  verifikasi host SSH. `scripts/backup.sh` sudah lebih baik (memakai env, bukan
  argumen).

#### L-4. Image base pihak ketiga memakai tag `latest`

- **Severity:** Low
- **Lokasi:** `docker-compose.yml` (image telegram-bot-api pihak ketiga).
- **Detail:** Tag `latest` non-deterministik & sulit di-pin ke audit CVE.
  `Dockerfile` utama sudah baik (`alpine:3.21` versi pin). DocStation memakai
  `python:3.11-slim` (pin minor; bisa diperketat ke digest).

#### L-5. Container utama sengaja berjalan sebagai uid 0 (root) di dalam container

- **Severity:** Info
- **Lokasi:** `Dockerfile` (tidak ada direktif `USER`).
- **Detail:** Didokumentasikan & disengaja — dikompensasi oleh Podman
  rootless + `--cap-drop=ALL` + `--read-only` di `deploy.sh`. Bukan temuan
  kritis, tetapi dicatat karena jalur `docker-compose.yml` tidak memberi
  kompensasi yang sama (lihat H-1).

---

### Temuan Positif (untuk konteks)

- `JWT_SECRET` wajib diisi (panic bila kosong) — `internal/middleware/auth.go`.
- Hardening container di `scripts/deploy.sh` & `scripts/podman-service-up.sh`
  konsisten (`cap-drop`, `no-new-privileges`, `read-only`, `tmpfs`).
- Backup lokal wajib terenkripsi (`scripts/backup.sh` keluar non-zero bila
  password kosong).
- `backup_crypto.go` memakai AES-256-GCM + scrypt; password tidak pernah
  dibocorkan ke response (`BackupEncryptionEnabled` hanya boolean).
- `nginx.conf`: `server_tokens off`, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, rate limiting,
  `client_max_body_size`.
- `SecurityHeaders` (Go) memasang CSP + HSTS (saat production).
- `.gitignore`/`.dockerignore` sudah komprehensif untuk `.env*`, `*.db`,
  `backups/`, kredensial, dan artefak build.

---

## 3. Rekomendasi Konkret

### Prioritas 1 — Segera (Critical)

1. **Hapus password default hardcoded (C-1).**
   Ubah `integrations/docstation/server.py` agar **gagal start** bila
   `DOCSTATION_PASSWORD` tidak diset (pola seperti `JWT_SECRET`), atau tolak
   semua request bila kosong. Jangan biarkan default apa pun yang dapat dipakai.

2. **Wajibkan `DOCSTATION_SESSION_SECRET` (C-2).**
   Di `integrations/docstation/docker-compose.yml`, ubah menjadi interpolasi
   wajib (gaya yang gagal bila kosong, sama seperti `JWT_SECRET`), dan
   dokumentasikan pembuatan nilainya (mis. `openssl rand -hex 32`).

3. **Bersihkan artefak PII/backup dari working tree & riwayat git (C-3).**
   - Hentikan tracking direktori sensitif: `git rm --cached -r backups/`,
     `public/uploads/`, `go-backend/data/`,
     `go-backend/internal/handlers/uploads/`, `public/uploads_from_server/`.
   - Tambahkan `.gitkeep` pada folder kosong yang harus tetap ada.
   - Untuk riwayat yang sudah ter-push (mengandung PII), pertimbangkan
     `git filter-repo` + rotasi database/kredensial, dan koordinasikan dengan
     pemilik repo. Hapus juga salinan lokal yang tidak diperlukan.
   - Pastikan backup DB tidak pernah disimpan di bawah root repo; gunakan
     direktori di luar repo (mis. `/opt/sekolahku-prod/backups`) dengan
     permission 0700.

### Prioritas 2 — Segera setelahnya (High)

4. **Selaraskan jalur `docker-compose.yml` dengan hardening `deploy.sh` (H-1).**
   Tambahkan `read_only: true`, `tmpfs`, `cap_drop: [ALL]`,
   `security_opt: [no-new-privileges:true]`; batasi binding port ke
   `127.0.0.1:8181:8181` (bukan semua interface) bila ada reverse proxy.
   Idealnya dokumentasikan bahwa produksi memakai `scripts/deploy.sh`
   (Podman rootless), bukan `docker compose up`.

5. **Perkuat DocStation (H-2, H-4).**
   - Set `DOCSTATION_SECURE_COOKIE=1` saat diakses via HTTPS.
   - Pertimbangkan menghapus `network_mode: host` dan memakai jaringan bridge
     dengan port terbatas.
   - Perbarui `REMOTE_ACCESS.md` agar otentikasi **wajib sejak awal** (bukan
     opsional), dan tandai mode tanpa-password sebagai hanya untuk uji lokal.

6. **Batasi dampak InsecureSkipVerify (H-3).**
   Meski printer LAN memakai self-signed, dokumentasikan secara eksplisit di
   `docstation_handler.go` bahwa ini khusus jaringan internal dan jangan
   dipakai jika DocStation diekspos ke internet tanpa tunnel terlindungi.

### Prioritas 3 — Menengah

7. **Ketatkan `nginx.conf` (M-1, M-2).**
   - Aktifkan blok HTTPS + HSTS setelah sertifikat siap, dan tambahkan
     redirect HTTP ke HTTPS (mis. `return 301 https://<host><uri>;`).
   - Jawab `/uploads/` lewat backend (`proxy_pass`) atau tambahkan aturan
     `location` yang menolak folder privat, agar aturan `IsPublicUploadPath`
     di Go juga berlaku di tepi; turunkan `expires` untuk berkas non-publik.

8. **Samakan skema enkripsi backup (M-3).**
   Alihkan `scripts/backup.sh` ke AES-256-GCM (AEAD) atau bungkus memakai
   utilitas yang sama dengan `backup_crypto.go`, sehingga kedua jalur punya
   jaminan integritas setara.

9. **Ketatkan permission (M-5).**
   Ubah `os.MkdirAll(..., 0755)` di `static.go` dan `0o755`/`0o644` di
   `docstation_handler.go` menjadi `0750`/`0640` untuk direktori/berkas PII.

10. **Tinjau `vercel.json` (M-4).**
    Pastikan rewrite global tidak menyamarkan path sensitif; tambahkan
    pengecualian/404 eksplisit bila diperlukan.

### Prioritas 4 — Rendah

11. **Perketat filter Sentry (L-1).** Tambahkan pembersihan `event.user`,
    `event.breadcrumbs`, dan query string di `beforeSend`, dan pertimbangkan
    menurunkan `replaysOnErrorSampleRate` atau mengaktifkan masking PII.
12. **Hilangkan placeholder host (L-2).** Ganti domain/path di `nginx.conf`
    dan pastikan tidak di-commit dengan nilai host internal spesifik.
13. **Hindari secret di argumen proses (L-3).** Ganti `sshpass -p` dan
    `echo ... | sudo -S` dengan mekanisme non-argumen (mis. SSH key + `sudo -n`,
    atau `SSH_ASKPASS`), dan hapus `StrictHostKeyChecking=no`.
14. **Pin image & tag (L-4).** Ganti `latest` dengan tag/digest tetap untuk
    `aiogram/telegram-bot-api`; pertimbangkan digest untuk `python:3.11-slim`.
15. **Dokumentasikan keputusan root di container (L-5).** Pertahankan catatan
    di `Dockerfile`/`deploy.sh`, tetapi tegaskan bahwa itu hanya valid bila
    Podman rootless + opsi hardening dipakai.

---

## 4. Checklist Tindak Lanjut

- [ ] C-1: Password DocStation default dihapus; server gagal start bila kosong.
- [ ] C-2: `DOCSTATION_SESSION_SECRET` wajib; tidak ada placeholder ter-commit.
- [ ] C-3: `backups/`, DB, `uploads/` di-untrack dan dipindah keluar repo.
- [ ] H-1: `docker-compose.yml` diselaraskan dengan hardening `deploy.sh`.
- [ ] H-2: Cookie Secure aktif; `network_mode: host` ditinjau ulang.
- [ ] H-3: Risiko InsecureSkipVerify didokumentasikan/dibatasi.
- [ ] H-4: `REMOTE_ACCESS.md` mewajibkan otentikasi.
- [ ] M-1: `/uploads/` ditinjau agar tidak menyajikan folder privat.
- [ ] M-2: HTTPS + HSTS aktif di `nginx.conf`.
- [ ] M-3: Skema enkripsi backup diseragamkan (AEAD).
- [ ] M-4: `vercel.json` ditinjau.
- [ ] M-5: Permission direktori/berkas PII dikeatkan.
- [ ] L-1..L-5: Ditinjau sesuai prioritas.

---

## 5. Catatan Metodologi

- Audit dilakukan dengan membaca berkas konfigurasi/deployment **tanpa**
  membuka isi `.env` produksi yang sebenarnya; hanya berkas contoh
  (`.env.example`, `.env.production.example`) yang ditinjau.
- Tidak ada kode produksi yang diubah. Dokumen ini adalah satu-satunya berkas
  yang ditulis.
- Nilai rahasia aktual sengaja **tidak** dicantumkan; temuan hanya menyebut
  lokasi dan sifat (hardcoded/default/wajib-diisi).
