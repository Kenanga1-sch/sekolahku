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

## Google Sign-In / Sign-Up (orang tua)

Login memakai cookie HttpOnly `session` (JWT). Google **hanya** dipakai
sebagai bukti kepemilikan email — hak akses tetap ditentukan `users.role`,
dan pendaftaran mandiri tetap wajib memverifikasi NISN + tanggal lahir anak.

Alur:

```
/login  --klik tombol-->  GET /api/auth/google/start
       --302 ke Google-->  accounts.google.com (consent)
       --302-->            GET /api/auth/google/callback
                             ├─ identitas sudah tertaut → sesi dibuat → redirect /parent
                             └─ identitas baru → cookie tiket (15 mnt) → /daftar-ortu/google
/daftar-ortu/google  --NISN+tgl lahir-->  POST /api/auth/google/complete → sesi + /parent
```

#### GET /api/auth/google/status

Publik. Menentukan apakah tombol Google ditampilkan.

```json
{ "enabled": true }
```

`enabled=false` bila `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` kosong.

#### GET /api/auth/google/start

Publik. Query opsional: `redirect` (path internal, default `/parent`),
`mode=link` (menautkan ke akun yang sedang login).

Menyetel cookie `oauth_state`, `oauth_redirect`, `oauth_mode` (HttpOnly,
SameSite=Lax, 10 menit) lalu 302 ke Google. `503` bila kredensial kosong.

#### GET /api/auth/google/callback

Publik. Memvalidasi `state` (harus sama dengan cookie, sekali pakai),
menukar `code` di `oauth2.googleapis.com/token`, lalu membaca
`www.googleapis.com/oauth2/v3/userinfo`.

| Kondisi                             | Respons                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `state` tidak cocok / cookie hilang | `400`                                                              |
| `email_verified=false`              | `403`                                                              |
| Tukar kode gagal                    | `502`                                                              |
| Identitas sudah tertaut             | `302` ke `redirect` + cookie `session`/`user_info`                 |
| Identitas baru                      | `302` ke `/daftar-ortu/google` + cookie `google_ticket` (15 menit) |
| `mode=link`                         | `302` ke `/parent/profil?google=link` + cookie `google_ticket`     |

#### GET /api/auth/google/pending

Publik. Membaca cookie tiket; dipakai halaman penyelesaian untuk menampilkan
email/nama Google yang sedang menunggu verifikasi.

```json
{
  "success": true,
  "email": "ortu@gmail.com",
  "name": "Nama",
  "picture": "https://..."
}
```

`404` bila tiket tidak ada/kedaluwarsa.

#### POST /api/auth/google/complete

Publik, rate limit 5/15 menit per IP.

```json
{ "nisn": "1234567890", "birthDate": "2015-05-01", "relation": "ibu" }
```

| Kondisi                                | Respons                                           |
| -------------------------------------- | ------------------------------------------------- |
| NISN/tanggal lahir tidak cocok         | `404`                                             |
| Email Google milik akun **staf/admin** | `409` (tidak pernah auto-link ke akun privileged) |
| Siswa sudah punya akun ortu aktif      | `200` — identitas ditautkan ke akun itu           |
| Email sudah dipakai akun ortu lain     | `200` — ditautkan (orang tua banyak anak)         |
| Belum ada akun                         | `200` — akun `orangtua` baru, **tanpa password**  |

Respons sukses: `{ "success": true, "user": {...}, "redirect": "/parent" }`
plus cookie `session` + `user_info`. Akun baru memicu notifikasi in-app ke
superadmin/admin dan audit log `signup_google`.

#### POST /api/auth/google/link

Wajib login, role `orangtua`. Menautkan identitas Google (dari cookie tiket)
ke akun yang sedang login — untuk akun lama berbasis nomor HP tanpa email.

`409` bila akun Google sudah tertaut ke akun lain atau akun ini sudah punya
identitas Google berbeda.

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
