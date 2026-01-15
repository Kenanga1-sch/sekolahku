# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most API endpoints require authentication via PocketBase token.

---

## SPMB Endpoints

### Register New Student
```http
POST /api/spmb/register
Content-Type: application/json

{
  "student_name": "John Doe",
  "student_nik": "1234567890123456",
  "birth_date": "2018-05-15",
  "birth_place": "Jakarta",
  "gender": "L",
  "parent_name": "Parent Name",
  "parent_phone": "081234567890",
  "parent_email": "parent@example.com",
  "address": "Jl. Contoh No. 123",
  "home_lat": -6.2088,
  "home_lng": 106.8456,
  "distance_to_school": 1.5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "registration_number": "SPMB20260001",
    "id": "abc123",
    "status": "pending",
    "is_in_zone": true
  }
}
```

### Check Registration Status
```http
GET /api/spmb/status?registration_number=SPMB20260001
```

### Upload Documents
```http
POST /api/spmb/upload
Content-Type: multipart/form-data

registrant_id: abc123
document_type: birth_certificate
file: [binary]
```

---

## Health Check

### Server Health
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T12:00:00Z",
  "uptime": 3600,
  "memory": {
    "used": 128,
    "total": 512,
    "unit": "MB"
  }
}
```

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message description"
}
```

### Error Codes
| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Rate Limiting

- Registration: 10 requests per hour per IP
- General API: 100 requests per minute per IP

---

## PocketBase Collections

### Core Collections
| Collection | Description |
|------------|-------------|
| `users` | User accounts |
| `spmb_registrants` | SPMB registrations |
| `spmb_periods` | Registration periods |
| `announcements` | News/announcements |
| `school_settings` | School configuration |

### Library Collections
| Collection | Description |
|------------|-------------|
| `library_items` | Books/items |
| `library_members` | Library members |
| `library_loans` | Loan records |
| `library_visits` | Visit logs |

### Inventory Collections
| Collection | Description |
|------------|-------------|
| `inventory_assets` | Asset items |
| `inventory_rooms` | Room locations |
| `inventory_opname` | Stock opname records |
| `inventory_audit` | Audit log |
