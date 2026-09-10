package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

// setupSavingsTestDB creates the single-source schema:
// students is the identity authority; tabungan_siswa is an extension (student_id + saldo).
func setupSavingsTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			nisn TEXT,
			nis TEXT,
			full_name TEXT,
			birth_date TEXT,
			class_id TEXT,
			class_name TEXT,
			qr_code TEXT,
			photo TEXT,
			status TEXT DEFAULT 'active',
			is_active INTEGER DEFAULT 1,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT
		);
		CREATE TABLE tabungan_siswa (
			id TEXT PRIMARY KEY,
			student_id TEXT UNIQUE NOT NULL REFERENCES students(id),
			saldo_terakhir INTEGER DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE tabungan_transaksi (
			id TEXT PRIMARY KEY,
			siswa_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			setoran_id TEXT,
			tipe TEXT NOT NULL,
			nominal INTEGER NOT NULL,
			status TEXT DEFAULT 'pending',
			catatan TEXT,
			verified_by TEXT,
			verified_at INTEGER,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE tabungan_setoran (
			id TEXT PRIMARY KEY,
			guru_id TEXT NOT NULL,
			bendahara_id TEXT,
			tipe TEXT NOT NULL,
			total_nominal INTEGER NOT NULL,
			nominal_fisik INTEGER,
			selisih INTEGER,
			status TEXT DEFAULT 'pending',
			catatan TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE tabungan_brankas (
			id TEXT PRIMARY KEY,
			nama TEXT NOT NULL,
			tipe TEXT NOT NULL,
			saldo INTEGER DEFAULT 0,
			pic_id TEXT,
			updated_at INTEGER
		);
		CREATE TABLE tabungan_brankas_transaksi (
			id TEXT PRIMARY KEY,
			tipe TEXT NOT NULL,
			nominal INTEGER NOT NULL,
			user_id TEXT,
			catatan TEXT,
			created_at INTEGER
		);
		CREATE TABLE tabungan_hutang (
			id TEXT PRIMARY KEY,
			siswa_id TEXT NOT NULL,
			nama_barang TEXT,
			kategori TEXT,
			nominal INTEGER NOT NULL DEFAULT 0,
			jumlah INTEGER NOT NULL DEFAULT 1,
			terbayar INTEGER NOT NULL DEFAULT 0,
			dicatat_oleh TEXT,
			status TEXT DEFAULT 'aktif',
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE tabungan_hutang_pembayaran (
			id TEXT PRIMARY KEY,
			hutang_id TEXT NOT NULL,
			nominal INTEGER NOT NULL,
			metode TEXT,
			transaksi_id TEXT,
			dicatat_oleh TEXT,
			created_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("Failed to create tables: %v", err)
	}

	return db
}

func seedSavingsFlow(t *testing.T, db *sql.DB, saldo int) {
	t.Helper()
	_, err := db.Exec(`INSERT INTO students (id, nisn, full_name, class_name, qr_code, status, is_active)
		VALUES (?, ?, ?, ?, ?, 'active', 1)`, "st1", "12345678", "Siswa A", "Kelas 1", "QR-123")
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO users (id, name) VALUES (?, ?), (?, ?)`, "u1", "Guru", "bendahara", "Bendahara")
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO tabungan_siswa (id, student_id, saldo_terakhir) VALUES (?, ?, ?)`,
		"sav_st1", "st1", saldo)
	if err != nil {
		t.Fatal(err)
	}
}

func TestSavingsRepository_SiswaLookup(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 0)

	t.Run("ByQR Found", func(t *testing.T) {
		res, err := repo.GetSiswaByQR("QR-123")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if res == nil || res.Nama != "Siswa A" {
			t.Error("Failed to get correct student")
		}
	})

	t.Run("ByStudentID Found", func(t *testing.T) {
		res, err := repo.GetSiswaByQR("st1")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if res == nil || res.Nama != "Siswa A" {
			t.Error("Failed to get correct student")
		}
	})

	t.Run("ByNISN Found", func(t *testing.T) {
		res, err := repo.GetSiswaByQR("12345678")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if res == nil || res.Nama != "Siswa A" {
			t.Error("Failed to get correct student by NISN")
		}
	})

	t.Run("Not Found", func(t *testing.T) {
		res, err := repo.GetSiswaByQR("unknown")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if res != nil {
			t.Error("Should be nil")
		}
	})
}

func TestSavingsRepository_CreateTransaksiPreventsPendingOverdraw(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 10000)

	err := repo.CreateTransaksi(models.CreateTransaksiRequest{
		SiswaID: "st1",
		Type:    "tarik",
		Nominal: 8000,
		UserID:  "u1",
	})
	if err != nil {
		t.Fatalf("first withdrawal should be accepted: %v", err)
	}

	err = repo.CreateTransaksi(models.CreateTransaksiRequest{
		SiswaID: "st1",
		Tipe:    "tarik",
		Nominal: 3000,
		UserID:  "u1",
	})
	if err == nil {
		t.Fatal("second withdrawal should fail because collected withdrawals exceed available balance")
	}
}

func TestSavingsRepository_VerifySetoranUpdatesBalanceOnce(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 10000)

	if err := repo.CreateTransaksi(models.CreateTransaksiRequest{
		SiswaID: "st1",
		Tipe:    "setor",
		Nominal: 5000,
		UserID:  "u1",
	}); err != nil {
		t.Fatalf("create transaction failed: %v", err)
	}
	if err := repo.CreateSetoran(models.CreateSetoranRequest{GuruID: "u1"}); err != nil {
		t.Fatalf("create setoran failed: %v", err)
	}

	var setoranID string
	if err := db.QueryRow(`SELECT id FROM tabungan_setoran LIMIT 1`).Scan(&setoranID); err != nil {
		t.Fatal(err)
	}

	nominalFisik := 5000
	if err := repo.VerifySetoran(models.VerifySetoranRequest{
		SetoranID:    setoranID,
		BendaharaID:  "bendahara",
		Status:       "verified",
		NominalFisik: &nominalFisik,
	}); err != nil {
		t.Fatalf("verify setoran failed: %v", err)
	}

	var saldo, kas int
	if err := db.QueryRow(`SELECT saldo_terakhir FROM tabungan_siswa WHERE student_id = 'st1'`).Scan(&saldo); err != nil {
		t.Fatal(err)
	}
	if saldo != 15000 {
		t.Fatalf("expected saldo 15000, got %d", saldo)
	}
	if err := db.QueryRow(`SELECT saldo FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1`).Scan(&kas); err != nil {
		t.Fatal(err)
	}
	if kas != 5000 {
		t.Fatalf("expected cash vault 5000, got %d", kas)
	}

	if err := repo.VerifySetoran(models.VerifySetoranRequest{
		SetoranID:    setoranID,
		BendaharaID:  "bendahara",
		Status:       "verified",
		NominalFisik: &nominalFisik,
	}); err == nil {
		t.Fatal("second verification should fail")
	}
}

func TestSavingsRepository_EnsureSiswaAndSync(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)

	_, err := db.Exec(`INSERT INTO students (id, nisn, full_name, status, is_active)
		VALUES ('st2', '999', 'Siswa Baru', 'active', 1)`)
	if err != nil {
		t.Fatal(err)
	}

	count, err := repo.SyncFromStudents()
	if err != nil {
		t.Fatalf("sync failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 new savings row, got %d", count)
	}

	// Idempotent
	count, err = repo.SyncFromStudents()
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("second sync should add 0, got %d", count)
	}

	// EnsureSiswa for a student without row
	_, err = db.Exec(`INSERT INTO students (id, nisn, full_name, status, is_active)
		VALUES ('st3', '888', 'Siswa C', 'active', 1)`)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.EnsureSiswa("st3"); err != nil {
		t.Fatalf("ensure failed: %v", err)
	}
	res, err := repo.GetSiswaByQR("st3")
	if err != nil || res == nil {
		t.Fatalf("student st3 should have savings row: %v", err)
	}

	// Inactive student should not get a row
	_, err = db.Exec(`INSERT INTO students (id, nisn, full_name, status, is_active)
		VALUES ('st4', '777', 'Siswa Nonaktif', 'mutasi_keluar', 0)`)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.EnsureSiswa("st4"); err != nil {
		t.Fatalf("ensure failed: %v", err)
	}
	res, _ = repo.GetSiswaByQR("st4")
	if res != nil {
		t.Fatal("inactive student should not appear in savings lookup")
	}
}
