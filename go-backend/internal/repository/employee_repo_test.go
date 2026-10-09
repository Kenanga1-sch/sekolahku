package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupEmployeeTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE employee_details (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			nip TEXT,
			nuptk TEXT,
			nik TEXT,
			employment_status TEXT,
			job_type TEXT,
			join_date TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			category TEXT,
			degree TEXT,
			quote TEXT,
			photo_url TEXT,
			display_order INTEGER,
			name_without_degree TEXT,
			name TEXT,
			email TEXT,
			role TEXT,
			phone TEXT,
			qr_code TEXT
		);
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT,
			email TEXT,
			full_name TEXT,
			role TEXT,
			is_active INTEGER DEFAULT 1
		);
	`)
	if err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	return db
}

// Catatan fixture: name = TANPA gelar, degree terpisah — persis pola data
// produksi. FullName (json) harus berisi gabungan "Nama, Gelar".
func TestEmployeeRepositoryGetEmployeesByIDsOrderAndNulls(t *testing.T) {
	db := setupEmployeeTestDB(t)
	defer db.Close()
	repo := NewEmployeeRepository(db)

	_, err := db.Exec(`
		INSERT INTO employee_details (id, name, email, role, nip, photo_url, job_type, employment_status, degree, user_id) VALUES
			('emp-1', 'Budi', 'budi@sekolah.id', 'guru', '197001011990031001', '/uploads/staff/budi.jpg', 'Guru Kelas', 'PNS', 'S.Pd', 'user-1'),
			('emp-2', 'Siti Aminah', 'siti@sekolah.id', 'staff', NULL, NULL, NULL, NULL, NULL, NULL);
	`)
	if err != nil {
		t.Fatal(err)
	}

	result, err := repo.GetEmployeesByIDs([]string{"emp-2", "emp-1", "tidak-ada"})
	if err != nil {
		t.Fatalf("GetEmployeesByIDs returned error: %v", err)
	}
	if len(result) != 2 || result[0].ID != "emp-2" || result[1].ID != "emp-1" {
		t.Fatalf("expected selected order preserved and unknown id skipped, got %#v", result)
	}
	if result[0].NIP != nil || result[0].PhotoUrl != nil {
		t.Fatalf("expected NULL columns to stay nil, got %#v", result[0])
	}
	if result[1].NIP == nil || *result[1].NIP != "197001011990031001" {
		t.Fatalf("expected NIP populated, got %#v", result[1].NIP)
	}
	if result[1].PhotoUrl == nil || *result[1].PhotoUrl != "/uploads/staff/budi.jpg" {
		t.Fatalf("expected photo_url populated, got %#v", result[1].PhotoUrl)
	}
	if !result[1].HasAccount || result[1].UserID == nil || *result[1].UserID != "user-1" {
		t.Fatalf("expected account linkage from user_id, got %#v", result[1])
	}
	if result[0].HasAccount {
		t.Fatalf("expected no account linkage without user_id")
	}

	// FullName = gabungan name+degree; Name tetap tanpa gelar.
	if result[1].FullName == nil || *result[1].FullName != "Budi, S.Pd" {
		t.Fatalf("expected FullName 'Budi, S.Pd', got %#v", result[1].FullName)
	}
	if result[1].Name != "Budi" {
		t.Fatalf("Name must stay without degree, got %q", result[1].Name)
	}
	if result[0].FullName == nil || *result[0].FullName != "Siti Aminah" {
		t.Fatalf("expected FullName = name when no degree, got %#v", result[0].FullName)
	}

	empty, err := repo.GetEmployeesByIDs(nil)
	if err != nil {
		t.Fatalf("GetEmployeesByIDs(nil) returned error: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("expected empty slice for no ids, got %#v", empty)
	}
}

func TestEmployeeRepositoryGetEmployeesFullNameAndWithoutAccountDegree(t *testing.T) {
	db := setupEmployeeTestDB(t)
	defer db.Close()
	repo := NewEmployeeRepository(db)

	_, err := db.Exec(`
		INSERT INTO employee_details (id, name, email, role, degree, user_id, display_order) VALUES
			('emp-linked', 'Rusmaningsih', 'rus@sekolah.id', 'guru', 'S.Pd.SD.', 'user-9', 1),
			('emp-free', 'Umar Said', 'umar@sekolah.id', 'support', 'S.Kom.', NULL, 2);
	`)
	if err != nil {
		t.Fatal(err)
	}

	// GetEmployees (list) → FullName gabungan.
	list, err := repo.GetEmployees(1, 10, "")
	if err != nil {
		t.Fatalf("GetEmployees returned error: %v", err)
	}
	if len(list.Data) == 0 {
		t.Fatal("expected employees")
	}
	found := false
	for _, e := range list.Data {
		if e.ID == "emp-linked" {
			found = true
			if e.FullName == nil || *e.FullName != "Rusmaningsih, S.Pd.SD." {
				t.Fatalf("expected FullName with degree, got %#v", e.FullName)
			}
		}
	}
	if !found {
		t.Fatal("emp-linked not found in list")
	}

	// GetEmployeesWithoutAccount → SELECT degree + FullName terisi.
	free, err := repo.GetEmployeesWithoutAccount()
	if err != nil {
		t.Fatalf("GetEmployeesWithoutAccount returned error: %v", err)
	}
	if len(free) != 1 || free[0].ID != "emp-free" {
		t.Fatalf("expected only unlinked employee, got %#v", free)
	}
	if free[0].Degree == nil || *free[0].Degree != "S.Kom." {
		t.Fatalf("expected degree selected, got %#v", free[0].Degree)
	}
	if free[0].FullName == nil || *free[0].FullName != "Umar Said, S.Kom." {
		t.Fatalf("expected FullName with degree, got %#v", free[0].FullName)
	}
}

// UpdateEmployee harus men_sinkronkan users.name/full_name = "Nama, Gelar"
// untuk akun ter-link (bug: gelar tidak pernah ikut di konsumen users).
func TestEmployeeRepositoryUpdateEmployeeSyncsUserName(t *testing.T) {
	db := setupEmployeeTestDB(t)
	defer db.Close()
	repo := NewEmployeeRepository(db)

	_, err := db.Exec(`
		INSERT INTO users (id, name, full_name, role) VALUES ('user-1', 'Badrudin', 'Badrudin', 'guru');
		INSERT INTO employee_details (id, name, email, role, degree, user_id) VALUES
			('emp-1', 'Badrudin', 'bad@sekolah.id', 'guru', 'S.Pd.', 'user-1');
	`)
	if err != nil {
		t.Fatal(err)
	}

	deg := "S.Pd., M.Pd"
	req := models.CreateEmployeeRequest{FullName: "Badrudin", Email: "bad@sekolah.id", Role: "guru", Degree: &deg}
	if err := repo.UpdateEmployee("emp-1", req); err != nil {
		t.Fatalf("UpdateEmployee returned error: %v", err)
	}

	var name, fullName string
	if err := db.QueryRow(`SELECT name, full_name FROM users WHERE id = 'user-1'`).Scan(&name, &fullName); err != nil {
		t.Fatal(err)
	}
	if name != "Badrudin, S.Pd., M.Pd" || fullName != name {
		t.Fatalf("users.name/full_name tidak sinkron: %q / %q", name, fullName)
	}
}

// LinkEmployeeToUser menyalin nama+gelar GTK ke users saat akun dibuat.
func TestUserRepositoryLinkEmployeeToUserSyncsName(t *testing.T) {
	db := setupEmployeeTestDB(t)
	defer db.Close()
	userRepo := NewUserRepository(db)

	_, err := db.Exec(`
		INSERT INTO users (id, name, full_name, role) VALUES ('user-new', 'user baru', 'user baru', 'guru');
		INSERT INTO employee_details (id, name, email, role, degree) VALUES
			('emp-x', 'Noni Puspa Rany', 'noni@sekolah.id', 'guru', 'S.Pd.');
	`)
	if err != nil {
		t.Fatal(err)
	}

	if err := userRepo.LinkEmployeeToUser("emp-x", "user-new"); err != nil {
		t.Fatalf("LinkEmployeeToUser returned error: %v", err)
	}

	var name string
	if err := db.QueryRow(`SELECT name FROM users WHERE id = 'user-new'`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Noni Puspa Rany, S.Pd." {
		t.Fatalf("users.name tidak digabung, got %q", name)
	}
	var userID string
	if err := db.QueryRow(`SELECT user_id FROM employee_details WHERE id = 'emp-x'`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if userID != "user-new" {
		t.Fatalf("user_id tidak tertaut, got %q", userID)
	}
}

func TestNewEmployeeQRCodeFallbackOrder(t *testing.T) {
	nip := " 197001011990031001 "
	nuptk := "1234567890123456"
	empty := "   "

	if got := NewEmployeeQRCode(&nip, &nuptk, "emp-1"); got != "GTK-197001011990031001" {
		t.Fatalf("NIP diprioritaskan & ditrim, got %q", got)
	}
	if got := NewEmployeeQRCode(nil, &nuptk, "emp-1"); got != "GTK-1234567890123456" {
		t.Fatalf("fallback NUPTK, got %q", got)
	}
	if got := NewEmployeeQRCode(&empty, &empty, "emp-1"); got != "GTK-EMP-1" {
		t.Fatalf("fallback id (upper), got %q", got)
	}
	if got := NewEmployeeQRCode(nil, nil, "emp-2"); got != "GTK-EMP-2" {
		t.Fatalf("fallback id saat keduanya nil, got %q", got)
	}
}

// CreateEmployee harus mengisi qr_code stabil (GTK-{NIP}).
func TestEmployeeRepositoryCreateEmployeeSetsQrCode(t *testing.T) {
	db := setupEmployeeTestDB(t)
	defer db.Close()
	repo := NewEmployeeRepository(db)

	nip := "197001011990031001"
	id, err := repo.CreateEmployee(models.CreateEmployeeRequest{
		FullName: "Budi", Email: "budi@sekolah.id", Role: "guru", NIP: &nip,
	})
	if err != nil {
		t.Fatalf("CreateEmployee returned error: %v", err)
	}
	var qr string
	if err := db.QueryRow(`SELECT qr_code FROM employee_details WHERE id = ?`, id).Scan(&qr); err != nil {
		t.Fatal(err)
	}
	if qr != "GTK-197001011990031001" {
		t.Fatalf("qr_code tidak terisi saat create, got %q", qr)
	}
}

// UpdateEmployee: backfill qr_code bila kosong, TAPI tidak menimpa yang sudah ada
// (stabilitas kartu lama).
func TestEmployeeRepositoryUpdateEmployeeQrBackfillOnlyWhenEmpty(t *testing.T) {
	db := setupEmployeeTestDB(t)
	defer db.Close()
	repo := NewEmployeeRepository(db)

	// Baris lama tanpa qr_code (data sebelum kolom ada).
	_, err := db.Exec(`INSERT INTO employee_details (id, name, email, role) VALUES ('emp-old', 'Tua', 'tua@sekolah.id', 'guru')`)
	if err != nil {
		t.Fatal(err)
	}
	nipOld := "198001012000031002"
	if err := repo.UpdateEmployee("emp-old", models.CreateEmployeeRequest{FullName: "Tua", Email: "tua@sekolah.id", Role: "guru", NIP: &nipOld}); err != nil {
		t.Fatalf("UpdateEmployee error: %v", err)
	}
	var qr string
	if err := db.QueryRow(`SELECT qr_code FROM employee_details WHERE id='emp-old'`).Scan(&qr); err != nil {
		t.Fatal(err)
	}
	if qr != "GTK-198001012000031002" {
		t.Fatalf("qr_code harus ter-backfill dari NIP, got %q", qr)
	}

	// Update lagi dengan NIP berbeda — qr_code TIDAK boleh berubah.
	nipBaru := "199901012022031009"
	if err := repo.UpdateEmployee("emp-old", models.CreateEmployeeRequest{FullName: "Tua", Email: "tua@sekolah.id", Role: "guru", NIP: &nipBaru}); err != nil {
		t.Fatalf("UpdateEmployee error: %v", err)
	}
	if err := db.QueryRow(`SELECT qr_code FROM employee_details WHERE id='emp-old'`).Scan(&qr); err != nil {
		t.Fatal(err)
	}
	if qr != "GTK-198001012000031002" {
		t.Fatalf("qr_code tidak boleh ditimpa saat update, got %q", qr)
	}
}
