## [v1.1.026] - Notifikasi Orang Tua & Keandalan PWA Produksi

### ✨ Portal orang tua (Fase 2–6)

- **Presensi anak**: rekap per tahun ajaran, riwayat 30 terakhir, grafik kehadiran mingguan (7 hari), dan tautan dalam `?anak=<id>`.
- **Preferensi notifikasi** per orang tua/wali (migrasi `000046`) + kartu UI di profil.
- **Web Push ber-aksi**: tombol "Ajukan Izin" pada notifikasi alpha (`models/push.go` → `PushPayload.Actions`, `sw.js` `notificationaction`).
- **Scheduler** kirim Web Push nyata: peringatan alpha 12:30 & rekap harian orang tua 16:00 (sebelumnya hanya in-app).

### 📱 PWA (Fase 7)

- `scripts/gen-sw-precache.cjs` (terpasang via npm `postbuild`): precache **seluruh** chunk `/_next/*` (bukan 5 aset lagi) dengan `CACHE_NAME` berbasis hash isi — cache lama otomatis terganti tiap rilis.
- **UpdateBanner**: dorong notifikasi refresh ketika service worker baru siap.
- Badge versi → `v1.1.026`.
- **Koreksi**: `gen-sw-precache` kini benar-benar menulis `CACHE_NAME` hash (regex netral-kutip), mengecualikan `/sw.js` dari precache, dan service worker menambah listener `notificationaction` agar tombol "Ajukan Izin" benar-benar berfungsi (`PushAction` kini membawa `url`).

### 🔧 Build & Deploy

- Alur rilis tetap satu binary: `npm run build` (→ `postbuild` injeksi precache) → `build-linux.bat`/`go build` embed `dist/` → `sekolahku_linux` → `deploy.sh` (`podman build` + `--replace` + health check di prod).
- `deploy.sh` & skrip diagnostik tak lagi memuat password plaintext (pakai `DEPLOY_PASS`/`SUDO_PASS` dari env, fail-fast).
- Dump DB & tarball upload (berisi data siswa) dihentikan dari pelacakan git; `.gitignore` diperketat. PAT GitHub pada URL remote **perlu dirotasi** oleh pemilik.

## [Sekolahku Unified Deployment Stabilization] - 2026-04-16

### 🚀 Deployment & Connectivity

- **Unified Binary**: Successfully stabilized the Go + Next.js unified deployment (`sekolahku.exe`).
- **Port Agnostic**: Updated frontend `GO_API_URL` to use relative paths, resolving port conflicts (now default 8181).
- **Static Export**: Fixed Next.js static export build process to correctly embed assets within the Go binary.

### 🔐 Authentication & RBAC

- **Role Consolidation**: Performed migration of `superadmin` privileges into a single `admin` role for simplicity.
- **Reactive Auth**: Implemented safe session refreshing during login to ensure dashboard menus appear instantly without manual refresh.
- **Database Integrity**: Fixed SQLite timestamp scanning errors (`sql: Scan error on column index...`) across all repositories using `SafeTime` utility.
