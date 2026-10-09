package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

// setupKioskTestDB menyediakan skema minimal untuk menguji alur scan kiosk:
// anggota (siswa), aset + katalog, kunjungan, dan peminjaman.
func setupKioskTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	schema := `
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			nisn TEXT, nis TEXT, qr_code TEXT,
			full_name TEXT, class_name TEXT, photo TEXT,
			status TEXT, is_active INTEGER
		);
		CREATE TABLE users (
			id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT, image TEXT
		);
		CREATE TABLE library_members (
			id TEXT PRIMARY KEY,
			student_id TEXT UNIQUE,
			user_id TEXT,
			employee_id TEXT,
			max_borrow_limit INTEGER DEFAULT 3,
			is_active INTEGER DEFAULT 1,
			created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE employee_details (
			id TEXT PRIMARY KEY, name TEXT, nip TEXT, nuptk TEXT,
			qr_code TEXT, category TEXT, user_id TEXT, photo_url TEXT
		);
		CREATE TABLE library_catalog (
			id TEXT PRIMARY KEY, isbn TEXT, title TEXT, author TEXT,
			publisher TEXT, year INTEGER, category TEXT, description TEXT,
			cover TEXT, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE library_assets (
			id TEXT PRIMARY KEY, catalog_id TEXT, status TEXT DEFAULT 'AVAILABLE',
			location TEXT, condition TEXT, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE library_visits (
			id TEXT PRIMARY KEY, member_id TEXT, date TEXT, time TEXT,
			timestamp INTEGER, guest_name TEXT, guest_institution TEXT, guest_purpose TEXT,
			created_at INTEGER
		);
		CREATE TABLE library_loans (
			id TEXT PRIMARY KEY, member_id TEXT, item_id TEXT,
			borrow_date INTEGER, due_date INTEGER, return_date INTEGER,
			is_returned INTEGER, status TEXT, fine_amount INTEGER, fine_paid INTEGER,
			overdue_at INTEGER, notes TEXT, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE library_qr_codes (
			code TEXT PRIMARY KEY, batch_id TEXT, created_at INTEGER
		);

		INSERT INTO students (id, nisn, qr_code, full_name, class_name, status, is_active)
			VALUES ('stu-1', '999111', 'QR-STU-001', 'Siswa Satu', 'Kelas 6A', 'active', 1);
		INSERT INTO library_members (id, student_id, max_borrow_limit, is_active, created_at, updated_at)
			VALUES ('lib_stu-1', 'stu-1', 3, 1, 1710000000000, 1710000000000);
		INSERT INTO library_catalog (id, isbn, title, author, created_at, updated_at)
			VALUES ('cat-1', '978-001', 'Buku Satu', 'Penulis A', 1710000000000, 1710000000000);
		INSERT INTO library_assets (id, catalog_id, status, created_at, updated_at)
			VALUES ('asset-1', 'cat-1', 'AVAILABLE', 1710000000000, 1710000000000);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to create kiosk schema: %v", err)
	}
	return db
}

func kioskJSON(t *testing.T, h *LibraryHandler, path, body string) (int, map[string]interface{}) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e := echo.New()
	ctx := e.NewContext(req, rec)

	_ = h.KioskScanComplete(ctx)

	var resp map[string]interface{}
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	return rec.Code, resp
}

// TestKioskScanCompleteBookQRNotPanic memastikan scan QR BUKU di kiosk tidak
// menyebabkan panic. Sebelumnya GetMemberByCode mengembalikan (nil, nil) untuk
// kode tak dikenal, lalu handler langsung deref member.ID → panic 500, dan
// branch item tidak pernah tercapai.
func TestKioskScanCompleteBookQRNotPanic(t *testing.T) {
	db := setupKioskTestDB(t)
	defer db.Close()
	h := NewLibraryHandler(repository.NewLibraryRepository(db), nil)

	code, resp := kioskJSON(t, h, "/api/kiosk/scan-complete", `{"code":"asset-1"}`)

	if code != http.StatusOK {
		t.Fatalf("expected 200 for book QR scan, got %d: %v", code, resp)
	}
	if resp["type"] != "item" {
		t.Fatalf("expected type=item for book QR, got %v", resp["type"])
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected item data, got %v", resp["data"])
	}
	if data["id"] != "asset-1" {
		t.Fatalf("expected asset id asset-1, got %v", data["id"])
	}
}

// TestKioskScanCompleteUnknownQR memastikan kode tak dikenal mengembalikan
// error yang jelas, bukan panic.
func TestKioskScanCompleteUnknownQR(t *testing.T) {
	db := setupKioskTestDB(t)
	defer db.Close()
	h := NewLibraryHandler(repository.NewLibraryRepository(db), nil)

	code, resp := kioskJSON(t, h, "/api/kiosk/scan-complete", `{"code":"TIDAK-ADA"}`)

	if code != http.StatusOK {
		t.Fatalf("expected 200 with type=error, got %d: %v", code, resp)
	}
	if resp["type"] != "error" {
		t.Fatalf("expected type=error, got %v", resp["type"])
	}
}

// TestKioskScanCompleteMemberQR memastikan scan QR anggota mencatat kunjungan
// dan mengembalikan data member.
func TestKioskScanCompleteMemberQR(t *testing.T) {
	db := setupKioskTestDB(t)
	defer db.Close()
	repo := repository.NewLibraryRepository(db)
	h := NewLibraryHandler(repo, nil)

	code, resp := kioskJSON(t, h, "/api/kiosk/scan-complete", `{"code":"QR-STU-001"}`)

	if code != http.StatusOK {
		t.Fatalf("expected 200 for member QR scan, got %d: %v", code, resp)
	}
	if resp["type"] != "member" {
		t.Fatalf("expected type=member, got %v", resp["type"])
	}
	visitStatus, _ := resp["visitStatus"].(map[string]interface{})
	if visitStatus == nil || visitStatus["isFirstVisit"] != true {
		t.Fatalf("expected first visit recorded, got %v", resp["visitStatus"])
	}

	// Kunjungan harus tercatat di DB.
	visited, err := repo.HasVisitedToday("lib_stu-1")
	if err != nil {
		t.Fatalf("HasVisitedToday returned error: %v", err)
	}
	if !visited {
		t.Fatalf("expected visit to be recorded in DB")
	}
}

// TestKioskScanBookQRIdentifiesItem memastikan KioskScan (mode default) bisa
// mengidentifikasi QR buku. Sebelumnya branch item tidak tercapai.
func TestKioskScanBookQRIdentifiesItem(t *testing.T) {
	db := setupKioskTestDB(t)
	defer db.Close()
	h := NewLibraryHandler(repository.NewLibraryRepository(db), nil)

	req := httptest.NewRequest(http.MethodPost, "/api/kiosk/scan", strings.NewReader(`{"code":"asset-1"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := echo.New().NewContext(req, rec)

	if err := h.KioskScan(ctx); err != nil {
		t.Fatalf("KioskScan returned error: %v", err)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if resp["type"] != "item" {
		t.Fatalf("expected type=item for book QR, got %v", resp["type"])
	}
}

func kioskTransaction(t *testing.T, h *LibraryHandler, body string) (int, map[string]interface{}) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/kiosk/transaction", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := echo.New().NewContext(req, rec)

	_ = h.KioskTransaction(ctx)

	var resp map[string]interface{}
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	return rec.Code, resp
}

// TestKioskTransactionReturnByItem menguji pengembalian 1-request milik kiosk:
// cari pinjaman aktif via item_id + kembalikan, lengkap dengan nama peminjam
// untuk pesan sukses. Permintaan kedua harus melapor tidak ada pinjaman aktif
// (bukan 500) supaya operator mendapat pesan yang jelas.
func TestKioskTransactionReturnByItem(t *testing.T) {
	db := setupKioskTestDB(t)
	defer db.Close()
	repo := repository.NewLibraryRepository(db)
	h := NewLibraryHandler(repo, nil)

	if _, err := db.Exec(`UPDATE library_assets SET status = 'BORROWED' WHERE id = 'asset-1'`); err != nil {
		t.Fatalf("gagal menandai aset dipinjam: %v", err)
	}
	// due_date di tahun 2100 → tidak telat, fine_amount 0.
	if _, err := db.Exec(`
		INSERT INTO library_loans (id, member_id, item_id, borrow_date, due_date, is_returned, status, fine_amount, fine_paid, created_at, updated_at)
		VALUES ('loan-1', 'lib_stu-1', 'asset-1', 1710000000000, 4102444800000, 0, 'borrowed', 0, 0, 1710000000000, 1710000000000)`); err != nil {
		t.Fatalf("gagal seeding loan: %v", err)
	}

	code, resp := kioskTransaction(t, h, `{"type":"return-by-item","itemId":"asset-1"}`)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %v", code, resp)
	}
	if resp["success"] != true {
		t.Fatalf("expected success=true, got %v", resp)
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data object, got %v", resp["data"])
	}
	if data["memberName"] != "Siswa Satu" {
		t.Fatalf("expected memberName 'Siswa Satu', got %v", data["memberName"])
	}
	if data["title"] != "Buku Satu" {
		t.Fatalf("expected title 'Buku Satu', got %v", data["title"])
	}
	if fine, _ := data["fineAmount"].(float64); fine != 0 {
		t.Fatalf("expected fineAmount 0, got %v", data["fineAmount"])
	}

	var status string
	if err := db.QueryRow(`SELECT status FROM library_assets WHERE id = 'asset-1'`).Scan(&status); err != nil {
		t.Fatalf("gagal cek status aset: %v", err)
	}
	if status != "AVAILABLE" {
		t.Fatalf("expected asset AVAILABLE after return, got %s", status)
	}
	var returned int
	if err := db.QueryRow(`SELECT is_returned FROM library_loans WHERE id = 'loan-1'`).Scan(&returned); err != nil {
		t.Fatalf("gagal cek loan: %v", err)
	}
	if returned != 1 {
		t.Fatalf("expected loan is_returned=1, got %d", returned)
	}

	// Ulangi: pinjaman sudah tidak ada → success=false + pesan jelas (bukan 500).
	code2, resp2 := kioskTransaction(t, h, `{"type":"return-by-item","itemId":"asset-1"}`)
	if code2 != http.StatusOK {
		t.Fatalf("expected 200 on repeat, got %d: %v", code2, resp2)
	}
	if resp2["success"] != false {
		t.Fatalf("expected success=false on repeat, got %v", resp2)
	}
	if resp2["message"] != "Data peminjaman tidak ditemukan" {
		t.Fatalf("unexpected message: %v", resp2["message"])
	}
}
