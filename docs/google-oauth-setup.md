# Panduan Google Sign-In (Pendaftaran Akun Orang Tua)

Fitur ini memungkinkan orang tua mendaftar dan masuk memakai akun Google.
Google **hanya** membuktikan kepemilikan email; hak akses tetap ditentukan
role di tabel `users`, dan pendaftaran mandiri tetap wajib memverifikasi
**NISN + tanggal lahir anak** (sama seperti `/daftar-ortu`).

Akun hasil pendaftaran Google **tidak punya password** (`password_hash`
NULL). Password bisa dibuat kemudian lewat alur "Lupa password".

---

## 1. Yang perlu disiapkan di Google Cloud Console

Semua langkah di bawah dilakukan sekali oleh admin sekolah. Tidak perlu
verifikasi aplikasi oleh Google karena hanya memakai scope dasar
(`openid`, `email`, `profile`).

### 1.1 Buat project

1. Buka <https://console.cloud.google.com/>.
2. Klik pemilih project di kanan atas → **New Project**.
3. Nama: `sekolahku-prod` (bebas). Klik **Create**, lalu pilih project itu.

### 1.2 Konfigurasi OAuth consent screen

1. Menu **APIs & Services → OAuth consent screen**.
2. User type: **External** → **Create**.
3. Isi:
   - App name: `SDN 1 Kenanga` (nama yang dilihat pengguna di layar Google)
   - User support email: email admin sekolah
   - Developer contact: email admin sekolah
4. **Save and continue**.
5. Scopes → **Add or remove scopes**, centang:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

   Klik **Update** → **Save and continue**.

6. Test users (opsional saat status masih _Testing_): tambahkan email Google
   yang akan dipakai menguji.
7. Setelah selesai, klik **Publish app** agar semua orang tua bisa memakai
   (status berubah dari _Testing_ ke _In production_). Tanpa publish, hanya
   email yang terdaftar sebagai test user yang bisa login.

> Scope `openid/email/profile` tidak sensitif, jadi tidak perlu review Google.
> Status _In production_ langsung aktif.

### 1.3 Buat OAuth Client ID

1. Menu **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: `Sekolahku Web`.
4. **Authorized JavaScript origins** (boleh kosong, karena kita memakai
   redirect server-side; isi untuk kejelasan):
   - `https://sdn1kenanga.sch.id`
5. **Authorized redirect URIs** — harus **persis** sama dengan yang dipakai
   backend (`OAUTH_PUBLIC_BASE_URL` + `/api/auth/google/callback`):
   - `https://sdn1kenanga.sch.id/api/auth/google/callback` (produksi)
   - `http://localhost:3001/api/auth/google/callback` (dev lokal)
6. Klik **Create**. Salin **Client ID** dan **Client secret**.

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
cd /opt/sekolahku-prod && ./deploy.sh prod     # atau tunggu deploy berikutnya
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

### Pendaftaran baru

1. Orang tua membuka `/login` atau `/daftar-ortu`, klik **Lanjutkan dengan Google**.
2. Memilih akun Google → kembali ke `/daftar-ortu/google`.
3. Mengisi **NISN + tanggal lahir anak** + hubungan.
4. Sistem:
   - bila siswa **sudah** punya akun orang tua → identitas Google ditautkan
     ke akun itu (tidak ada akun ganda);
   - bila belum → akun `orangtua` baru dibuat tanpa password, ditautkan ke
     siswa, lalu langsung masuk ke portal `/parent`.
5. Admin menerima notifikasi in-app "Pendaftaran Akun Orang Tua (Google)".

### Login berikutnya

Klik tombol Google di `/login` → langsung masuk ke `/parent` (tanpa NISN).

### Akun lama (dibuat dengan nomor HP)

Masuk seperti biasa dengan nomor HP + password → **Profil → Akun Google →
Hubungkan akun Google**. Setelah itu bisa masuk lewat tombol Google.

---

## 4. Keamanan yang sudah diterapkan

| Aspek                        | Implementasi                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| CSRF / OAuth state           | `state` acak 24 byte di cookie HttpOnly, sekali pakai, 10 menit                               |
| Email belum terverifikasi    | `email_verified=false` → `403`, tidak bisa menautkan                                          |
| Auto-link ke akun privileged | Ditolak `409` bila email milik staf/admin                                                     |
| Akun ganda                   | Dicocokkan lewat `parent_students` + email; identitas unik per `(provider, provider_user_id)` |
| Tiket pendaftaran            | JWT HS256 15 menit, HttpOnly, hanya berlaku untuk `typ=google_ticket`                         |
| Redirect terbuka             | `redirect` dibatasi path internal (`//evil.com` ditolak)                                      |
| Rate limit                   | `POST /api/auth/google/complete` 5 permintaan / 15 menit per IP                               |
| Jejak audit                  | `login_google`, `signup_google`, `link_google` di `audit_logs`                                |
| CSP                          | Tidak berubah — tidak ada skrip Google yang dimuat (redirect penuh)                           |

### Risiko yang perlu dipahami

- Siapa pun yang mengetahui **NISN + tanggal lahir** seorang siswa dapat
  mendaftar sebagai orang tua siswa tersebut. Mitigasi: notifikasi + audit ke
  admin, dan admin dapat melepas tautan lewat **Detail Siswa → Orang Tua**
  (`DELETE /api/master/students/:id/parents/:userId`).
- Google Workspace sekolah dapat membatasi akun mana yang boleh login;
  batasan serupa bisa ditambahkan nanti lewat parameter `hd=` bila diperlukan.

---

## 5. Troubleshooting

| Gejala                                              | Penyebab umum                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch` dari Google                 | URI di Console tidak sama persis dengan `OAUTH_PUBLIC_BASE_URL + /api/auth/google/callback` |
| `enabled:false`                                     | Env belum terbaca (container belum recreate) atau nama variabel salah                       |
| `Sesi OAuth tidak ditemukan`                        | Cookie diblokir (mode privasi ketat) atau pengguna membuka callback di tab/perangkat lain   |
| `Email Google Anda belum terverifikasi`             | Akun Google pengguna belum verifikasi email                                                 |
| `Email ini sudah terdaftar sebagai akun staf/admin` | Email dipakai akun pegawai — minta admin menautkan manual                                   |
| Tombol Google tidak muncul                          | `/api/auth/google/status` mengembalikan `enabled:false`                                     |

---

## 6. Mencabut akses

1. Hapus baris identitas:
   ```sql
   DELETE FROM user_identities WHERE user_id = '<id-user>' AND provider = 'google';
   ```
2. Nonaktifkan akun bila perlu: `UPDATE users SET is_active = 0 WHERE id = '<id-user>';`
3. Mencabut akses aplikasi dari sisi pengguna: <https://myaccount.google.com/permissions>.

Terakhir diperbarui: 2026-10-21.
