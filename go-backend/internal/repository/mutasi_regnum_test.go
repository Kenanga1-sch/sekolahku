package repository

import (
	"database/sql"
	"strings"
	"sync"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func newMutasiRegTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`CREATE TABLE mutasi_requests (
		id TEXT PRIMARY KEY,
		registration_number TEXT,
		student_name TEXT,
		nisn TEXT,
		gender TEXT,
		origin_school TEXT,
		origin_school_address TEXT,
		origin_nis TEXT,
		origin_class TEXT,
		target_grade INTEGER,
		parent_name TEXT,
		whatsapp_number TEXT,
		approval_no TEXT,
		approval_date TEXT,
		status_approval TEXT DEFAULT 'pending',
		status_delivery TEXT DEFAULT 'unsent',
		target_class_id TEXT,
		created_at INTEGER,
		updated_at INTEGER
	)`); err != nil {
		t.Fatal(err)
	}
	// :memory: memberi DB terpisah per koneksi; max-open=1 paksa koneksi tunggal
	// sehingga skema konsisten & mutex cukup untuk serialisasi (seperti prod).
	db.SetMaxOpenConns(1)
	return db
}

func testMutasiReq() models.MutasiRequest {
	return models.MutasiRequest{
		StudentName:    "Ani Mutasi",
		NISN:           "0098765432",
		Gender:         "P",
		OriginSchool:   "SDN Asal",
		TargetGrade:    2,
		ParentName:     "Bapak Ani",
		WhatsappNumber: "081234567890",
	}
}

// Nomor registrasi harus unik walau diproduksi bersamaan.
func TestCreateMutasiRequestConcurrentUniqueRegNum(t *testing.T) {
	db := newMutasiRegTestDB(t)
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE students (
		id TEXT PRIMARY KEY, nisn TEXT, full_name TEXT, status TEXT, is_active INTEGER DEFAULT 1
	)`); err != nil {
		t.Fatal(err)
	}
	repo := NewMutasiRepository(db)

	const n = 10
	var wg sync.WaitGroup
	results := make([]string, n)
	errs := make([]error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results[i], errs[i] = repo.CreateMutasiRequest(testMutasiReq())
		}(i)
	}
	wg.Wait()

	seen := map[string]bool{}
	for i, regNum := range results {
		if errs[i] != nil {
			t.Fatalf("request %d gagal: %v", i, errs[i])
		}
		if seen[regNum] {
			t.Fatalf("nomor registrasi duplikat: %s", regNum)
		}
		seen[regNum] = true
	}
}

// GenerateRegistrationNumber harus mengembalikan urutan tanpa gap besar.
func TestGenerateRegistrationNumberSequential(t *testing.T) {
	db := newMutasiRegTestDB(t)
	defer db.Close()
	repo := NewMutasiRepository(db)

	first := repo.GenerateRegistrationNumber()
	if !strings.HasPrefix(first, "MUT-") {
		t.Fatalf("format tidak sesuai: %s", first)
	}
	if _, err := repo.CreateMutasiRequest(testMutasiReq()); err != nil {
		t.Fatal(err)
	}
	second := repo.GenerateRegistrationNumber()
	if first == second {
		t.Fatalf("nomor tidak bertambah: %s", second)
	}
}

// Duplikat NISN saat approval harus ditolak, bukan dibiarkan diam.
func TestUpdateMutasiRequestStatusRejectsExistingNISN(t *testing.T) {
	db := newMutasiRegTestDB(t)
	defer db.Close()

	schema := []string{
		`CREATE TABLE students (
			id TEXT PRIMARY KEY, nisn TEXT, full_name TEXT, gender TEXT,
			class_name TEXT, class_id TEXT, status TEXT, qr_code TEXT,
			is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER
		)`,
		`CREATE TABLE mutasi_logs (
			id TEXT PRIMARY KEY, mutasi_type TEXT, student_id TEXT,
			student_name TEXT, nisn TEXT, gender TEXT, origin_or_destination TEXT,
			origin_nis TEXT, origin_class TEXT, approval_date TEXT, approval_no TEXT,
			letter_no TEXT, destination_class TEXT, mutation_date INTEGER,
			reason TEXT, created_at INTEGER
		)`,
		`CREATE TABLE student_classes (
			id TEXT PRIMARY KEY, name TEXT, grade INTEGER, academic_year TEXT
		)`,
		`CREATE TABLE student_class_history (
			id TEXT PRIMARY KEY, student_id TEXT, class_id TEXT, class_name TEXT,
			academic_year TEXT, grade INTEGER, status TEXT, record_date INTEGER
		)`,
	}
	for _, s := range schema {
		if _, err := db.Exec(s); err != nil {
			t.Fatal(err)
		}
	}

	repo := NewMutasiRepository(db)
	req := testMutasiReq()
	regNum, err := repo.CreateMutasiRequest(req)
	if err != nil {
		t.Fatal(err)
	}

	var id string
	if err := db.QueryRow("SELECT id FROM mutasi_requests WHERE registration_number = ?", regNum).Scan(&id); err != nil {
		t.Fatal(err)
	}

	if _, err := db.Exec("INSERT INTO students (id, nisn, full_name, status, is_active) VALUES ('sx', ?, 'Sudah Ada', 'active', 1)", req.NISN); err != nil {
		t.Fatal(err)
	}

	classID := "class-1"
	err = repo.UpdateMutasiRequestStatus(id, "principal_approved", &classID)
	if err == nil || !strings.Contains(err.Error(), "sudah terdaftar") {
		t.Fatalf("expected NISN-duplicate rejection, got: %v", err)
	}
}

// GetMutasiRequestByNISN harus mendeteksi NISN yang sedang dalam proses.
func TestGetMutasiRequestByNISNDetectsPendingRequest(t *testing.T) {
	db := newMutasiRegTestDB(t)
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE students (
		id TEXT PRIMARY KEY, nisn TEXT, full_name TEXT, status TEXT, is_active INTEGER DEFAULT 1
	)`); err != nil {
		t.Fatal(err)
	}
	repo := NewMutasiRepository(db)

	if id, err := repo.GetMutasiRequestByNISN("0098765432"); err != nil || id != "" {
		t.Fatalf("expected empty, got id=%s err=%v", id, err)
	}

	if _, err := repo.CreateMutasiRequest(testMutasiReq()); err != nil {
		t.Fatal(err)
	}
	if id, err := repo.GetMutasiRequestByNISN("0098765432"); err != nil || id == "" {
		t.Fatalf("expected pending request id, got id=%s err=%v", id, err)
	}

	// Setelah ditolak, NISN bebas lagi
	if _, err := db.Exec("UPDATE mutasi_requests SET status_approval = 'rejected'"); err != nil {
		t.Fatal(err)
	}
	if id, err := repo.GetMutasiRequestByNISN("0098765432"); err != nil || id != "" {
		t.Fatalf("expected free after rejection, got id=%s err=%v", id, err)
	}
}
