# Sekolahku API Documentation

This document provides an overview of all available API endpoints in the Sekolahku application.

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

Most endpoints require authentication via session cookies (NextAuth).

### Headers

```
Cookie: next-auth.session-token=<token>
```

### Protected Routes

All routes under `/api/*` except `/api/auth/*`, `/api/health`, and `/api/spmb/register` require authentication.

---

## Google Sign-In / Sign-Up (semua role)

Login memakai cookie HttpOnly `session` (JWT). Google **hanya** dipakai
sebagai bukti kepemilikan email ??? hak akses tetap ditentukan `users.role`.

- **Login** untuk semua role: bila email Google sama dengan email akun
  sekolah (`users.email` UNIQUE), identitas otomatis ditautkan dan pengguna
  langsung masuk ke dashboard sesuai role (`staff` ??? `/inventaris`,
  `orangtua` ??? `/parent`, lainnya ??? `/overview`).
- **Role `siswa` dikecualikan** dari auto-taut: email akun siswa sintetis
  (`NIS@sekolahku.id`) dan tidak pernah terverifikasi Google.
- **Pendaftaran mandiri** (verifikasi NISN + tanggal lahir anak) hanya untuk
  peran **orang tua**. Akun guru/staff/admin dibuat admin dari data
  kepegawaian, jadi tidak bisa mendaftar sendiri.
- Password tetap dipertahankan sebagai cadangan; akun ortu hasil daftar
  Google tidak punya password (`password_hash` NULL).

Alur:

```
/login  --klik tombol-->  GET /api/auth/google/start
       --302 ke Google-->  accounts.google.com (consent)
       --302-->            GET /api/auth/google/callback
                             ?????? identitas sudah tertaut ??? sesi dibuat ??? dashboard sesuai role
                             ?????? email cocok dengan akun sekolah ??? AUTO-TAUT ??? sesi ??? dashboard
                             ?????? email baru ??? cookie tiket (15 mnt) ??? /daftar-ortu/google
/daftar-ortu/google  --NISN+tgl lahir-->  POST /api/auth/google/complete ??? sesi + /parent
```

#### GET /api/auth/google/status

Publik. Menentukan apakah tombol Google ditampilkan.

```json
{ "enabled": true }
```

`enabled=false` bila `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` kosong.

#### GET /api/auth/google/start

Publik. Query opsional: `redirect` (path internal; kosong = otomatis sesuai
role), `mode=link` (menautkan ke akun yang sedang login), `mode=signup`
(pendaftaran mandiri orang tua).

Menyetel cookie `oauth_state`, `oauth_redirect`, `oauth_mode` (HttpOnly,
SameSite=Lax, 10 menit) lalu 302 ke Google. `503` bila kredensial kosong.

#### GET /api/auth/google/callback

Publik. Memvalidasi `state` (harus sama dengan cookie, sekali pakai),
menukar `code` di `oauth2.googleapis.com/token`, lalu membaca
`www.googleapis.com/oauth2/v3/userinfo`.

| Kondisi                             | Respons                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `state` tidak cocok / cookie hilang | `400`                                                                         |
| `email_verified=false`              | `403`                                                                         |
| Tukar kode gagal                    | `502`                                                                         |
| Email milik akun siswa              | `403` (akun siswa tidak boleh auto-taut)                                      |
| Akun non-aktif                      | `403`                                                                         |
| Akun sudah tertaut ke Google lain   | `409`                                                                         |
| Identitas sudah tertaut             | `302` ke dashboard sesuai role + cookie `session`/`user_info`                 |
| Email cocok dengan akun sekolah     | `302` (auto-taut) + cookie `session`/`user_info`                              |
| Email baru                          | `302` ke `/daftar-ortu/google` + cookie `google_ticket` (15 menit)            |
| `mode=link`                         | `302` ke `redirect` (default `/profile?google=link`) + cookie `google_ticket` |

Auto-taut juga mengisi email akun yang masih kosong dan mencatat audit
`link_google`. Untuk role `admin`/`superadmin` dikirim notifikasi in-app ke
superadmin.

#### GET /api/auth/google/pending

Publik. Membaca cookie tiket; dipakai halaman penyelesaian untuk menampilkan
email/nama Google yang sedang menunggu verifikasi.

```json
{
  "success": true,
  "email": "ortu@gmail.com",
  "name": "Nama",
  "picture": "https://...",
  "matchedRole": "orangtua",
  "matchedName": "Orang Tua Contoh"
}
```

`matchedRole` = role akun sekolah yang memakai email sama (kosong bila email
belum terdaftar). `404` bila tiket tidak ada/kedaluwarsa.

#### POST /api/auth/google/complete

Publik, rate limit 5/15 menit per IP. **Khusus pendaftaran orang tua.**

```json
{ "nisn": "1234567890", "birthDate": "2015-05-01", "relation": "ibu" }
```

| Kondisi                                  | Respons                                            |
| ---------------------------------------- | -------------------------------------------------- |
| NISN/tanggal lahir tidak cocok           | `404`                                              |
| Email Google milik akun guru/staf        | `409` (akun sudah ada; masuk memakai akun itu)     |
| Identitas sudah tertaut ke akun non-ortu | `409`                                              |
| Siswa sudah punya akun ortu aktif        | `200` ??? identitas ditautkan ke akun itu          |
| Email sudah dipakai akun ortu lain       | `200` ??? ditautkan (orang tua banyak anak)        |
| Belum ada akun                           | `200` ??? akun `orangtua` baru, **tanpa password** |

Respons sukses: `{ "success": true, "user": {...}, "redirect": "/parent" }`
plus cookie `session` + `user_info`. Akun baru memicu notifikasi in-app ke
superadmin/admin dan audit log `signup_google`.

#### POST /api/auth/google/link

Wajib login, **semua role**. Menautkan identitas Google (dari cookie tiket)
ke akun yang sedang login ??? untuk akun lama berbasis nomor HP tanpa email.
Sesi yang aktif sudah membuktikan kepemilikan akun, jadi tidak perlu kode
verifikasi tambahan. Email akun yang masih kosong ikut diisi dari Google.

`409` bila akun Google sudah tertaut ke akun lain atau akun ini sudah punya
identitas Google berbeda.

#### GET /api/auth/google/link

Wajib login, semua role. Status tautan Google milik akun yang sedang login.

```json
{ "linked": true, "email": "guru@sekolah.sch.id" }
```

`linked=false` bila akun belum tertaut.

#### DELETE /api/auth/google/link

Wajib login, semua role. Melepas tautan Google dari akun yang sedang login
(untuk mengganti akun Google). `409` bila akun tidak punya password ??? akun
orang tua hasil daftar Google tidak bisa dilepas supaya tidak terkunci dari
akunnya. Audit log: `unlink_google`.

---

## Endpoints

### Health & Monitoring

#### GET /api/health

Health check endpoint for container orchestration.

**Response**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-23T12:00:00.000Z",
  "uptime": 3600,
  "version": "0.1.0",
  "checks": {
    "database": { "status": "pass", "latency": 5 },
    "memory": { "status": "pass", "used": 128, "total": 512, "percentage": 25 }
  },
  "circuits": {},
  "responseTime": "15ms"
}
```

**Status Codes**

| Code | Description                  |
| ---- | ---------------------------- |
| 200  | Healthy or degraded          |
| 503  | Unhealthy (critical failure) |

---

#### GET /api/metrics

Application metrics in Prometheus format.

**Query Parameters**

| Param  | Type   | Description                                      |
| ------ | ------ | ------------------------------------------------ |
| format | string | `json` for JSON format, omit for Prometheus text |

---

### Authentication

#### POST /api/auth/signin

Sign in with credentials.

#### POST /api/auth/signout

Sign out current user.

#### GET /api/auth/session

Get current session info.

---

### SPMB (Student Registration)

#### GET /api/spmb/periods

Get all SPMB periods.

#### POST /api/spmb/register

Register a new student (public endpoint).

**Request Body**

```json
{
  "fullName": "Nama Lengkap",
  "studentNik": "1234567890123456",
  "birthDate": "2015-01-01",
  "birthPlace": "Jakarta",
  "gender": "L",
  "parentName": "Nama Orang Tua",
  "parentPhone": "08123456789",
  "parentEmail": "email@example.com",
  "address": "Alamat lengkap"
}
```

#### GET /api/spmb/registrants

Get all registrants (admin only).

#### PUT /api/spmb/registrants/[id]

Update registrant status (admin only).

---

### Library

#### GET /api/perpustakaan/data

Get library data (items, members, or loans).

#### GET /api/perpustakaan/stats

Get library statistics.

#### POST /api/perpustakaan/items

Create a new library item.

#### POST /api/perpustakaan/loans

Create a new loan.

#### POST /api/perpustakaan/returns

Return a borrowed item.

---

### Tabungan (Savings)

#### GET /api/tabungan/siswa

Get student savings accounts.

#### POST /api/tabungan/transaksi

Create a new transaction.

---

### Users

#### GET /api/users

Get all users (admin only).

#### POST /api/users

Create a new user (admin only).

---

### Gallery

#### GET /api/gallery

Get gallery items.

#### POST /api/gallery/upload

Upload a new image (multipart/form-data).

---

## Error Responses

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "statusCode": 400
  }
}
```

### Common Error Codes

| Code                | HTTP Status | Description              |
| ------------------- | ----------- | ------------------------ |
| VALIDATION_ERROR    | 400         | Invalid input data       |
| UNAUTHORIZED        | 401         | Authentication required  |
| FORBIDDEN           | 403         | Insufficient permissions |
| NOT_FOUND           | 404         | Resource not found       |
| RATE_LIMIT_EXCEEDED | 429         | Too many requests        |
| INTERNAL_ERROR      | 500         | Server error             |

---

## Rate Limiting

| Endpoint Type  | Limit       | Window     |
| -------------- | ----------- | ---------- |
| Authentication | 5 requests  | 15 minutes |
| File Upload    | 10 requests | 10 minutes |
| Standard API   | 60 requests | 1 minute   |

Headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
