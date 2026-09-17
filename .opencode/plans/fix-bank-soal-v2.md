# Fix Bank Soal — Route Conflict + Binary Deploy

## Masalah yang Ditemukan

### 1. Binary tidak ter-deploy (KRITIS)
- `deploy.sh` sync `sekolahku_linux` ke server
- Tapi saya build ke `dist/api` → binary baru **tidak sampai ke produksi**
- `sekolahku_linux` masih binary lama (15 Sep 01:18)

### 2. Route conflict subjects/classes (KRITIS)
- `adminGroup.GET("/academic/subjects")` didaftarkan di line 216
- `guruGroup.GET("/academic/subjects")` didaftarkan di line 221
- Echo router: route pertama yang match menang
- Guru kena route admin → 403 → dropdown kosong

### 3. Student routes belum ada
- `studentGroup.GET("/me/sets")` dan `studentGroup.GET("/me/sets/:id/items")` belum di-deploy
- Siswa tidak bisa melihat paket soal

## Rencana Perbaikan

### Step 1: Fix routes.go
Hapus `adminGroup.GET("/academic/subjects")` dan `adminGroup.GET("/academic/classes")`.
GuruGroup sudah include admin+guru+staff, jadi cukup pakai guruGroup untuk GET.

**Sebelum:**
```go
adminGroup.GET("/academic/subjects", h.Academic.GetSubjects)  // line 216
adminGroup.POST("/academic/subjects", h.Academic.CreateSubject)
adminGroup.PUT("/academic/subjects/:id", h.Academic.UpdateSubject)
adminGroup.DELETE("/academic/subjects/:id", h.Academic.DeleteSubject)
adminGroup.GET("/academic/classes", h.Academic.GetClasses)     // line 220
guruGroup.GET("/academic/subjects", h.Academic.GetSubjects)   // line 221
guruGroup.GET("/academic/classes", h.Academic.GetClasses)     // line 222
```

**Sesudah:**
```go
guruGroup.GET("/academic/subjects", h.Academic.GetSubjects)   // pindah ke atas
adminGroup.POST("/academic/subjects", h.Academic.CreateSubject)
adminGroup.PUT("/academic/subjects/:id", h.Academic.UpdateSubject)
adminGroup.DELETE("/academic/subjects/:id", h.Academic.DeleteSubject)
guruGroup.GET("/academic/classes", h.Academic.GetClasses)     // pindah ke atas
```

### Step 2: Build sebagai sekolahku_linux
```bash
cd go-backend && go build -o ../sekolahku_linux ./cmd/api
```
Dockerfile expects `sekolahku_linux` di root.

### Step 3: Full deploy
```bash
DEPLOY_PASS='20216609' ./deploy.sh
```

## File yang Diubah
- `go-backend/cmd/api/routes.go` — reorder subjects/classes GET routes
- Binary: `sekolahku_linux` (rebuild)
