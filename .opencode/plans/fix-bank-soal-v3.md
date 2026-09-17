# Fix Bank Soal — Scan Bug + Tambah Kurikulum

## Masalah yang Ditemukan

### Bug Kritis #1: Scan `*time.Time` dari kolom INTEGER (root cause "Gagal membuat bab")

**Lokasi:** `go-backend/internal/repository/bank_soal_repo.go`

Semua model di `bank_soal.go` menggunakan `*time.Time` untuk field timestamp:
```go
CreatedAt *time.Time `json:"createdAt"`
```

Tapi di database, kolom `created_at`/`updated_at` bertipe `INTEGER` (Unix ms).

Di `bank_soal_repo.go`:
```go
err := r.DB.QueryRow(`SELECT ... b.created_at, b.updated_at ...`).Scan(
    ..., &b.OrderNumber, &b.CreatedAt, &b.UpdatedAt, ...
)
```

`Scan()` mencoba deserialize INTEGER ke `*time.Time` → **GAGAL** → 500 error.

**Konvensi codebase** (`utils.go:17`):
```go
func SafeTime(ni sql.NullInt64) *time.Time { ... }
```
Pakai `sql.NullInt64` di Scan, lalu convert pakai `SafeTime()`.

**Dampaknya:** Setiap endpoint yang baca/insert ke tabel bank_soal gagal:
- `POST /api/bank-soal/bab` → 500 (INSERT berhasil, tapi GetBab gagal)
- `GET /api/bank-soal/bab` → 500 (ListBabs scan gagal)
- Sama untuk banks, questions, sets, set_items, practices, practice_answers

### Request User: Tambah Kurikulum sebagai scope tambahan

User ingin soal bisa dikelompokkan berdasarkan **kurikulum** (selain mata pelajaran, kelas, bab).

Contoh nilai: "Kurikulum 2013", "Kurikulum Merdeka", "KTSP".

## Rencana Perbaikan

### Step 1: Fix Scan bug di `bank_soal_repo.go`

Ubah semua method yang scan timestamp:

**Pattern lama (BUG):**
```go
var b models.Bab
var subjectName, className sql.NullString
err := r.DB.QueryRow(`SELECT b.created_at, b.updated_at, ...`).
    Scan(..., &b.OrderNumber, &b.CreatedAt, &b.UpdatedAt, ...)
```

**Pattern baru (FIX):**
```go
var b models.Bab
var subjectName, className sql.NullString
var createdAt, updatedAt sql.NullInt64
err := r.DB.QueryRow(`SELECT b.created_at, b.updated_at, ...`).
    Scan(..., &b.OrderNumber, &createdAt, &updatedAt, ...)
b.CreatedAt = SafeTime(createdAt)
b.UpdatedAt = SafeTime(updatedAt)
```

**Model tetap `*time.Time`** (frontend sudah pakai ISO date string). Hanya repo yang perlu fix.

**Methods yang perlu di-fix:**
- `ListBabs` (L74-91)
- `GetBab` (L94-117)
- `ListBanks` (cari di file)
- `GetBank`
- `CreateBank`
- `ListQuestions`
- `GetQuestion`
- `CreateQuestion`
- `UpdateQuestion`
- `ListSets` (L469)
- `GetSet`
- `CreateSet`
- `ListSetItems`
- `AddSetItem`
- `BulkAddSetItems`
- `ListPractices` (L704)
- `GetPractice` (L732)
- `SubmitPractice` (scan answered_at di L832)
- `GetPracticeAnswers` (L832)

### Step 2: Tambah tabel `kurikulum` + FK di `bab` dan `question_banks`

**Migration baru `000050_kurikulum.up.sql`:**
```sql
CREATE TABLE IF NOT EXISTS kurikulum (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,         -- "Kurikulum 2013", "Kurikulum Merdeka", "KTSP"
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);

-- Seed default values
INSERT OR IGNORE INTO kurikulum (id, name, description, is_active, created_at, updated_at)
VALUES
    ('kur-1', 'Kurikulum 2013', 'Pelajaran Kurikulum 2013', 1, strftime('%s','now')*1000, strftime('%s','now')*1000),
    ('kur-2', 'Kurikulum Merdeka', 'Pelajaran Kurikulum Merdeka', 1, strftime('%s','now')*1000, strftime('%s','now')*1000);

-- Tambah kolom di bab (nullable, untuk backward compatibility)
ALTER TABLE bab ADD COLUMN kurikulum_id TEXT;
ALTER TABLE bab ADD COLUMN semester TEXT;     -- opsional: ganjil/genap

-- Tambah kolom di question_banks (nullable)
ALTER TABLE question_banks ADD COLUMN kurikulum_id TEXT;
ALTER TABLE question_banks ADD COLUMN semester TEXT;
```

**Migration down `000050_kurikulum.down.sql`:**
```sql
ALTER TABLE bab DROP COLUMN semester;
ALTER TABLE bab DROP COLUMN kurikulum_id;
ALTER TABLE question_banks DROP COLUMN semester;
ALTER TABLE question_banks DROP COLUMN kurikulum_id;
DROP TABLE kurikulum;
```

### Step 3: Backend — Update models

**`models/bank_soal.go`** tambah field di `Bab`:
```go
type Bab struct {
    ...
    KurikulumID *string `json:"kurikulumId,omitempty"`
    Semester    *string `json:"semester,omitempty"`
    KurikulumName *string `json:"kurikulumName,omitempty"`
}
```

Tambah `KurikulumID` & `Semester` di `QuestionBank`.

Tambah `CreateBabRequest` field `KurikulumID *string`, `Semester *string`.
Tambah `CreateQuestionBankRequest` field `KurikulumID *string`, `Semester *string`.

### Step 4: Backend — Repository updates

**ListBabs & ListBanks** — tambah filter & JOIN dengan tabel `kurikulum`:
```sql
SELECT b.id, b.subject_id, b.class_id, b.title, b.description, b.order_number,
       b.created_at, b.updated_at, b.kurikulum_id, b.semester,
       s.name, c.name, k.name
FROM bab b
LEFT JOIN subjects s ON b.subject_id = s.id
LEFT JOIN student_classes c ON b.class_id = c.id
LEFT JOIN kurikulum k ON b.kurikulum_id = k.id
WHERE ...
```

Tambah `kurikulumID` parameter ke `ListBabs` dan `ListBanks`.

### Step 5: Backend — New handlers

Tambah `KurikulumHandler` di `handlers/kurikulum_handler.go`:
```go
type KurikulumHandler struct {
    Repo *repository.KurikulumRepository
}
func (h *KurikulumHandler) ListKurikulum(c echo.Context) error
func (h *KurikulumHandler) CreateKurikulum(c echo.Context) error
func (h *KurikulumHandler) UpdateKurikulum(c echo.Context) error
func (h *KurikulumHandler) DeleteKurikulum(c echo.Context) error
```

Routes:
- `guruGroup.GET("/academic/kurikulum", h.Kurikulum.ListKurikulum)` — read-only untuk guru
- `adminGroup.POST("/academic/kurikulum", h.Kurikulum.CreateKurikulum)`
- `adminGroup.PUT("/academic/kurikulum/:id", h.Kurikulum.UpdateKurikulum)`
- `adminGroup.DELETE("/academic/kurikulum/:id", h.Kurikulum.DeleteKurikulum)`

### Step 6: Wire-up di `main.go` dan `routes.go`

- Tambah `Kurikulum: repository.NewKurikulumRepository(db)` di Repositories
- Tambah `Kurikulum: handlers.NewKurikulumHandler(repos.Kurikulum)` di AllHandlers

### Step 7: Frontend — Tambah UI Kurikulum di Bank Soal

**`tab-bab.tsx`:**
- Tambah dropdown "Kurikulum" sebelum dropdown "Mata Pelajaran"
- Tambah dropdown "Semester" (Ganjil/Genap, optional)
- Kirim `kurikulumId` dan `semester` di form submission
- Tambah badge kurikulum di card list

**`tab-soal.tsx`:**
- Tambah dropdown "Kurikulum" dan "Semester" di filter
- Kirim `kurikulumId` saat create question (via bank_id)

**`tab-paket.tsx`, `tab-cetak.tsx`:**
- Opsional: tambah kurikulum di info

### Step 8: Types & Build

- Update `types/index.ts` — tambah `kurikulumId`, `semester`, `kurikulumName`
- Tambah interface `Kurikulum`

### Step 9: Build & Deploy

1. `cd go-backend && go build -o ../sekolahku_linux ./cmd/api`
2. `npx tsc --noEmit`
3. `npx next build`
4. `node scripts/gen-sw-precache.cjs`
5. `DEPLOY_PASS='20216609' ./deploy.sh --frontend`
6. `DEPLOY_PASS='20216609' ./deploy.sh` (full: binary + DB + container)

## Files yang Diubah

### Backend (priority high)
- `go-backend/internal/repository/bank_soal_repo.go` — fix scan bug
- `go-backend/internal/models/bank_soal.go` — tambah field kurikulum
- `go-backend/internal/repository/bank_soal_repo.go` — tambah JOIN kurikulum
- `go-backend/internal/db/migrations/000050_kurikulum.up.sql` — tabel kurikulum + ALTER
- `go-backend/internal/db/migrations/000050_kurikulum.down.sql`
- `go-backend/internal/models/kurikulum.go` (baru)
- `go-backend/internal/repository/kurikulum_repo.go` (baru)
- `go-backend/internal/handlers/kurikulum_handler.go` (baru)
- `go-backend/cmd/api/main.go` — wire-up
- `go-backend/cmd/api/routes.go` — routes

### Frontend
- `app/(dashboard)/bank-soal/tab-bab.tsx` — tambah dropdown Kurikulum & Semester
- `app/(dashboard)/bank-soal/tab-soal.tsx` — tambah dropdown filter Kurikulum
- `types/index.ts` — tambah interface Kurikulum, field kurikulumId/semester
