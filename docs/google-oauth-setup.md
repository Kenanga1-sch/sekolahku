# Panduan Google Sign-In (Login & Pendaftaran Semua Role)

Fitur ini memungkinkan **semua role** masuk memakai akun Google: orang tua,
guru, staff, admin, dan superadmin. Google **hanya** membuktikan kepemilikan
email; hak akses tetap ditentukan role di tabel `users`.

Aturan utamanya:

- **Login**: bila email Google sama dengan email akun yang sudah ada
  (`users.email` UNIQUE), identitas otomatis ditautkan dan pengguna langsung
  masuk ke dashboard sesuai role. Tidak perlu kode tambahan.
- **Akun lama tanpa email** (dibuat dengan nomor HP): masuk dulu pakai
  username + password → **Profil → Keamanan → Hubungkan akun Google**.
- **Pendaftaran mandiri** (verifikasi NISN + tanggal lahir anak) hanya untuk
  peran **orang tua**. Akun guru/staff/admin dibuat admin dari data
  kepegawaian, jadi tidak bisa mendaftar sendiri.
- **Role `siswa` dikecualikan** dari auto-taut: email akun siswa bersifat
  sintetis (`NIS@sekolahku.id`) dan tidak pernah terverifikasi Google.
- Password tetap dipertahankan sebagai cadangan. Akun orang tua hasil
  pendaftaran Google **tidak punya password** (`password_hash` NULL);
  password bisa dibuat lewat alur "Lupa password".
- **Satu email hanya boleh punya satu akun** (`users.email` UNIQUE). Guru
  yang sekaligus orang tua perlu memakai email berbeda bila ingin dua akun.

---

## 1. Yang perlu disiapkan di Google Cloud Console

Semua langkah di bawah dilakukan sekali oleh admin sekolah. Tidak perlu
verifikasi aplikasi oleh Google karena hanya memakai scope dasar
(`openid`, `email`, `profile`).

> **Catatan tampilan**: Google Cloud Console sekarang menampilkan halaman
> **Google Auth Platform** (tab: Overview, Branding, Audience, Clients, Data
> Access, Verification Center, Settings). Istilah "OAuth consent screen" dan
> "Credentials" pada panduan lama merujuk ke tab yang sama.

### 1.1 Buat project

1. Buka <https://console.cloud.google.com/>.
2. Klik pemilih project di kanan atas → **New Project**.
3. Nama: `sekolahku-prod` (bebas). Klik **Create**, lalu pilih project itu.

### 1.2 Tab **Branding** (dulu "OAuth consent screen")

1. Menu **APIs & Services → Google Auth Platform → Branding**.
2. Isi:
   - App name: `SDN 1 Kenanga` (nama yang dilihat pengguna di layar Google)
   - User support email: email admin sekolah
   - Developer contact: email admin sekolah
   - Homepage / Privacy policy / Terms: boleh dikosongkan (scope dasar tidak
     butuh review)
3. **Save**

### 1.3 Tab **Audience**

1. Menu **Google Auth Platform → Audience**.
2. **User type: External** → **Create**. (Internal hanya untuk akun Google
   Workspace milik sekolah sendiri — orang tua tidak bisa masuk.)
3. **Publish app** agar status berubah dari _Testing_ ke _In production_.
   Tanpa publish, hanya email yang terdaftar sebagai **test users** yang
   bisa login.

### 1.4 Tab **Data Access** (scope)

1. **Add or remove scopes** → centang:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
2. **Update** → **Save**.

> Scope `openid/email/profile` tidak sensitif, jadi tidak perlu review
> Google; status _In production_ langsung aktif. Tab **Verification Center**
> hanya dipakai untuk scope sensitif (Gmail/Drive) — jangan menambahkan.

### 1.5 Tab **Clients** (dulu "Credentials")

1. **Create client** → Application type: **Web application**.
2. Name: `Sekolahku Web`.
3. **Authorized JavaScript origins** (boleh kosong karena kita memakai
   redirect server-side; isi untuk kejelasan):
   - `https://sdn1kenanga.sch.id`
4. **Authorized redirect URIs** — harus **persis** sama dengan yang dipakai
   backend (`OAUTH_PUBLIC_BASE_URL` + `/api/auth/google/callback`):
   - `https://sdn1kenanga.sch.id/api/auth/google/callback` (produksi)
   - `http://localhost:3001/api/auth/google/callback` (dev lokal)
5. Klik **Create**. Salin **Client ID** dan **Client secret** (atau unduh
   file JSON).

> Google **menolak** redirect URI `http://` untuk host selain `localhost`.
> Jadi staging `http://100.65.59.66:3001` tidak bisa dipakai menguji login
> Google. Uji di produksi, atau jalankan `next dev` + tunnel ke
> `http://localhost:3001`.

---

## 2. Isi environment di server

Edit **hanya** file env di server (jangan commit secret):

```bash
nano /opt/sekolahku-prod/.env.prod
```

```dotenv
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
OAUTH_PUBLIC_BASE_URL=https://sdn1kenanga.sch.id
```

Untuk staging (`/opt/sekolahku-dev/.env.dev`) isi dengan Client ID dev dan
`OAUTH_PUBLIC_BASE_URL=http://localhost:3001`.

Container membaca env lewat `--env-file`, jadi **container harus dibuat
ulang** agar nilai baru terbaca:

```bash
systemctl --user stop sekolahku-prod.service
podman rm -f sekolahku-prod
systemctl --user start sekolahku-prod.service
```

Cek cepat tanpa login:

```bash
curl -s https://sdn1kenanga.sch.id/api/auth/google/status
# {"enabled":true}
```

`enabled:false` berarti kredensial belum terbaca (env salah nama / container
belum dibuat ulang).

---

## 3. Alur pengguna

### Semua role (guru, staff, admin)

1. Buka `/login`, klik **Masuk dengan Google**.
2. Pilih akun Google.
3. Bila email Google **sama dengan email akun sekolah** → akun langsung
   tertaut dan Anda masuk ke dashboard sesuai role.
4. Bila email **belum terdaftar** di sekolah → masuk dulu memakai nomor HP
   (username) + password, lalu buka **Profil → Keamanan → Hubungkan akun
   Google**. Satu klik lagi untuk menautkan; setelah itu login berikutnya
   cukup pakai tombol Google.

### Orang tua

1. Buka `/login` atau `/daftar-ortu`, klik **Daftar cepat dengan Google**.
2. Memilih akun Google → kembali ke `/daftar-ortu/google`.
3. Mengisi **NISN + tanggal lahir anak** + hubungan.
4. Sistem:
   - bila siswa **sudah** punya akun orang tua → identitas Google ditautkan
     ke akun itu (tidak ada akun ganda);
   - bila belum → akun `orangtua` baru dibuat tanpa password, ditautkan ke
     siswa, lalu langsung masuk ke portal `/parent`.
5. Admin menerima notifikasi in-app "Pendaftaran Akun Orang Tua (Google)".

### Akun lama (dibuat dengan nomor HP)

Masuk seperti biasa dengan nomor HP + password → **Profil → Keamanan →
Hubungkan akun Google**. Setelah itu bisa masuk lewat tombol Google.

---

## 4. Keamanan yang sudah diterapkan

| Aspek                        | Implementasi                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------- |
| CSRF / OAuth state           | `state` acak 24 byte di cookie HttpOnly, sekali pakai, 10 menit                  |
| Email belum terverifikasi    | `email_verified=false` → `403`, tidak bisa menautkan                             |
| Akun siswa                   | Tidak pernah ikut auto-taut (email sintetis)                                     |
| Auto-link ke akun privileged | Diizinkan, tetapi selalu dicatat di audit log + notifikasi ke superadmin         |
| Akun ganda                   | `users.email` UNIQUE + `user_identities` unik per `(provider, provider_user_id)` |
| Akun tertaut ke Google lain  | `409` — identitas tidak bisa dipindah diam-diam                                  |
| Tiket pendaftaran            | JWT HS256 15 menit, HttpOnly, hanya berlaku untuk `typ=google_ticket`            |
| Redirect terbuka             | `redirect` dibatasi path internal (`//evil.com` ditolak)                         |
| Rate limit                   | `POST /api/auth/google/complete` 5 permintaan / 15 menit per IP                  |
| Jejak audit                  | `login_google`, `signup_google`, `link_google` di `audit_logs`                   |
| CSP                          | Tidak berubah — tidak ada skrip Google yang dimuat (redirect penuh)              |

### Risiko yang perlu dipahami

- Siapa pun yang mengetahui **NISN + tanggal lahir** seorang siswa dapat
  mendaftar sebagai orang tua siswa tersebut. Mitigasi: notifikasi + audit ke
  admin, dan admin dapat melepas tautan lewat **Detail Siswa → Orang Tua**
  (`DELETE /api/master/students/:id/parents/:userId`).
- Auto-taut mempercayai email Google. Akun sekolah yang emailnya dipakai
  akun lain (mis. email bersama antar guru) akan menyebabkan masuk ke akun
  yang salah — karena itu **pastikan setiap akun punya email pribadi**.
- Google Workspace sekolah dapat membatasi akun mana yang boleh login;
  batasan serupa bisa ditambahkan nanti lewat parameter `hd=` bila diperlukan.

---

## 5. Troubleshooting

| Gejala                                        | Penyebab umum                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch` dari Google           | URI di Console tidak sama persis dengan `OAUTH_PUBLIC_BASE_URL + /api/auth/google/callback` |
| `enabled:false`                               | Env belum terbaca (container belum recreate) atau nama variabel salah                       |
| `Sesi OAuth tidak ditemukan`                  | Cookie diblokir (mode privasi ketat) atau pengguna membuka callback di tab/perangkat lain   |
| `Email Google Anda belum terverifikasi`       | Akun Google pengguna belum verifikasi email                                                 |
| `Email ini sudah tertaut ke akun lain`        | Akun Google sudah dipakai akun sekolah lain — minta admin melepas tautan                    |
| `Akun siswa belum dapat masuk memakai Google` | Role siswa memang tidak mendukung login Google                                              |
| Tombol Google tidak muncul                    | `/api/auth/google/status` mengembalikan `enabled:false`                                     |
| `App is blocked` / 403 dari Google            | Consent screen masih _Testing_ → publish app atau tambahkan email sebagai test user         |

---

## 6. Mencabut akses

1. Hapus baris identitas:
   ```sql
   DELETE FROM user_identities WHERE user_id = '<id-user>' AND provider = 'google';
   ```
2. Nonaktifkan akun bila perlu: `UPDATE users SET is_active = 0 WHERE id = '<id-user>';`
3. Mencabut akses aplikasi dari sisi pengguna: <https://myaccount.google.com/permissions>.

Terakhir diperbarui: 2026-10-22.
