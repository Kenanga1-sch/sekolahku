# API Documentation

Base URL: `/api`

## SPMB Registration

### Register New Student

```http
POST /api/spmb/register
Content-Type: application/json
```

**Request Body:**

```json
{
  "student_name": "John Doe",
  "student_nik": "1234567890123456",
  "birth_date": "2015-05-15",
  "birth_place": "Jakarta",
  "gender": "male",
  "previous_school": "TK Harapan Bangsa",
  "parent_name": "Jane Doe",
  "parent_phone": "081234567890",
  "parent_email": "jane@example.com",
  "address": "Jl. Contoh No. 123",
  "home_lat": -6.123456,
  "home_lng": 106.789012,
  "distance_to_school": 1.5
}
```

**Response (Success):**

```json
{
  "success": true,
  "data": {
    "registration_number": "SPMB20240001",
    "id": "abc123",
    "status": "pending",
    "is_in_zone": true
  }
}
```

---

### Check Registration Status

```http
GET /api/spmb/status?number=SPMB20240001
```

**Response:**

```json
{
  "success": true,
  "data": {
    "registration_number": "SPMB20240001",
    "student_name": "John Doe",
    "status": "pending",
    "status_label": "Menunggu Verifikasi",
    "is_in_zone": true,
    "distance_to_school": 1.5,
    "registered_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### Upload Document

```http
POST /api/spmb/upload
Content-Type: multipart/form-data
```

**Form Data:**

- `registrant_id`: string
- `document_type`: "kk" | "akta" | "foto"
- `file`: File (PDF, JPG, PNG, max 2MB)

---

### Update Registrant Status (Admin)

```http
PATCH /api/spmb/registrants/{id}
Content-Type: application/json
```

**Request Body:**

```json
{
  "status": "verified",
  "notes": "Dokumen lengkap dan valid"
}
```

---

## School Settings

### Get Settings

```http
GET /api/settings
```

### Update Settings

```http
PUT /api/settings
Content-Type: application/json
```

**Request Body:**

```json
{
  "school_name": "SD Negeri 1",
  "npsn": "12345678",
  "address": "Jl. Pendidikan No. 123",
  "phone": "(021) 1234-5678",
  "email": "info@sdnegeri1.sch.id",
  "school_lat": -6.2,
  "school_lng": 106.816666,
  "max_distance": 3
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**

- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error
