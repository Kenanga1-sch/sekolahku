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
| Code | Description |
|------|-------------|
| 200 | Healthy or degraded |
| 503 | Unhealthy (critical failure) |

---

#### GET /api/metrics

Application metrics in Prometheus format.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
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
