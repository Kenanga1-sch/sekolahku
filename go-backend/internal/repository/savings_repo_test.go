package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupSavingsTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory db: %v", err)
	}

	// Create tables
	_, err = db.Exec(`
		CREATE TABLE tabungan_kelas (
			id TEXT PRIMARY KEY,
			nama TEXT,
			wali_kelas TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE tabungan_siswa (
			id TEXT PRIMARY KEY,
			nisn TEXT,
			nama TEXT,
			kelas_id TEXT,
			saldo_terakhir INTEGER DEFAULT 0,
			qr_code TEXT,
			foto TEXT,
			is_active INTEGER DEFAULT 1,
			created_at INTEGER,
			updated_at INTEGER,
			FOREIGN KEY(kelas_id) REFERENCES tabungan_kelas(id)
		);
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT
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
	`)
	if err != nil {
		t.Fatalf("Failed to create tables: %v", err)
	}

	return db
}

func TestSavingsRepository_KelasCRUD(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)

	t.Run("Create", func(t *testing.T) {
		err := repo.CreateKelas("Kelas 1", nil)
		if err != nil {
			t.Errorf("Create failed: %v", err)
		}
	})

	t.Run("GetAll", func(t *testing.T) {
		res, err := repo.GetAllKelas()
		if err != nil {
			t.Fatal(err)
		}
		if len(res) == 0 {
			t.Error("Should have at least 1 class")
		}
	})
}

func TestSavingsRepository_SiswaLookup(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)

	// Seed class and student
	_, _ = db.Exec(`INSERT INTO tabungan_kelas (id, nama) VALUES (?, ?)`, "k1", "Kelas 1")
	_, err := db.Exec(`INSERT INTO tabungan_siswa (id, nisn, nama, kelas_id, qr_code) VALUES (?, ?, ?, ?, ?)`,
		"s1", "12345678", "Siswa A", "k1", "QR-123")
	if err != nil {
		t.Fatal(err)
	}

	t.Run("ByQR Found", func(t *testing.T) {
		res, err := repo.GetSiswaByQR("QR-123")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if res == nil || res.Nama != "Siswa A" {
			t.Error("Failed to get correct student")
		}
	})

	t.Run("ByID Found", func(t *testing.T) {
		res, err := repo.GetSiswaByQR("s1")
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

func seedSavingsFlow(t *testing.T, db *sql.DB, saldo int) {
	t.Helper()
	_, err := db.Exec(`INSERT INTO tabungan_kelas (id, nama) VALUES (?, ?)`, "k1", "Kelas 1")
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO users (id, name) VALUES (?, ?), (?, ?)`, "u1", "Guru", "bendahara", "Bendahara")
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO tabungan_siswa (id, nisn, nama, kelas_id, saldo_terakhir, qr_code) VALUES (?, ?, ?, ?, ?, ?)`,
		"s1", "12345678", "Siswa A", "k1", saldo, "QR-123")
	if err != nil {
		t.Fatal(err)
	}
}

func TestSavingsRepository_CreateTransaksiPreventsPendingOverdraw(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 10000)

	err := repo.CreateTransaksi(models.CreateTransaksiRequest{
		SiswaID: "s1",
		Type:    "tarik",
		Nominal: 8000,
		UserID:  "u1",
	})
	if err != nil {
		t.Fatalf("first withdrawal should be accepted: %v", err)
	}

	err = repo.CreateTransaksi(models.CreateTransaksiRequest{
		SiswaID: "s1",
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
		SiswaID: "s1",
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
	if err := db.QueryRow(`SELECT saldo_terakhir FROM tabungan_siswa WHERE id = 's1'`).Scan(&saldo); err != nil {
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
