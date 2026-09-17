# Fix Bank Soal Module — API Prefix & Route Access

## Root Cause
Semua API call di modul bank-soal dan praktik **tidak memiliki prefix `/api/`**.
Backend route ada di `/api/bank-soal/bab`, tapi frontend memanggil `/bank-soal/bab`.

## Changes

### 1. Frontend — Tambah `/api/` prefix (6 files)

**`app/(dashboard)/bank-soal/tab-bab.tsx`** (6 perubahan):
- L76: `/bank-soal/bab?...` → `/api/bank-soal/bab?...`
- L87: `/academic/subjects` → `/api/academic/subjects`
- L94: `/academic/classes` → `/api/academic/classes`
- L123: `/bank-soal/bab/${editingId}` → `/api/bank-soal/bab/${editingId}`
- L126: `/bank-soal/bab` → `/api/bank-soal/bab`
- L142: `/bank-soal/bab/${id}` → `/api/bank-soal/bab/${id}`

**`app/(dashboard)/bank-soal/tab-soal.tsx`** (5 perubahan):
- L108: `/bank-soal/banks?limit=100` → `/api/bank-soal/banks?limit=100`
- L121: `/bank-soal/questions?...` → `/api/bank-soal/questions?...`
- L166: `/bank-soal/questions/${editingId}` → `/api/bank-soal/questions/${editingId}`
- L169: `/bank-soal/questions` → `/api/bank-soal/questions`
- L185: `/bank-soal/questions/${id}` → `/api/bank-soal/questions/${id}`

**`app/(dashboard)/bank-soal/tab-paket.tsx`** (4 perubahan):
- L65: `/bank-soal/sets?limit=100` → `/api/bank-soal/sets?limit=100`
- L76: `/bank-soal/banks?limit=100` → `/api/bank-soal/banks?limit=100`
- L106: `/bank-soal/sets` → `/api/bank-soal/sets`
- L121: `/bank-soal/sets/${id}` → `/api/bank-soal/sets/${id}`

**`app/(dashboard)/bank-soal/tab-cetak.tsx`** (2 perubahan):
- L70: `/bank-soal/banks?limit=100` → `/api/bank-soal/banks?limit=100`
- L83: `/bank-soal/questions?...` → `/api/bank-soal/questions?...`

**`app/(dashboard)/praktik/tab-daftar-soal.tsx`** (3 perubahan):
- L44: `/bank-soal/sets?limit=100` → `/api/student/me/sets?limit=100`
- L55: `/student/me/practices?limit=100` → `/api/student/me/practices?limit=100`
- L68: `/student/me/practices` → `/api/student/me/practices`

**`app/(dashboard)/praktik/page.tsx`** (3 perubahan):
- L54: `/student/me/practices/${practiceId}` → `/api/student/me/practices/${practiceId}`
- L64: `/bank-soal/sets/${practiceData.setId}/items` → `/api/student/me/sets/${practiceData.setId}/items`
- L107: `/student/me/practices/${practiceId}/submit` → `/api/student/me/practices/${practiceId}/submit`

### 2. Backend — Tambah route untuk siswa (`routes.go`)

Tambahkan ke `studentGroup` (setelah line 685):
```go
// Bank Soal: Siswa melihat paket soal
studentGroup.GET("/me/sets", h.BankSoal.ListSets)
studentGroup.GET("/me/sets/:id/items", h.BankSoal.ListSetItems)
```

### 3. Backend — Tambah route guru untuk subjects/classes (`routes.go`)

Tambahkan ke `guruGroup` (setelah line 226):
```go
guruGroup.GET("/academic/subjects", h.Academic.GetSubjects)
guruGroup.GET("/academic/classes", h.Academic.GetClasses)
```

### 4. Build & Deploy

1. `cd go-backend && go build -o ../dist/api ./cmd/api`
2. `npx tsc --noEmit`
3. `npx next build`
4. `node scripts/gen-sw-precache.cjs`
5. `DEPLOY_PASS='20216609' ./deploy.sh --frontend` (frontend)
6. `DEPLOY_PASS='20216609' ./deploy.sh` (full: binary + DB + container)
