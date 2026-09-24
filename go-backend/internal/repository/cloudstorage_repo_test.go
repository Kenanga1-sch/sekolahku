package repository

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/sekolahku/go-backend/internal/models"
)

func setupCloudTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE cloud_files (
			id TEXT PRIMARY KEY,
			owner_id TEXT NOT NULL,
			name TEXT NOT NULL,
			parent_id TEXT,
			is_folder INTEGER NOT NULL DEFAULT 0,
			file_id TEXT,
			message_id INTEGER,
			mime_type TEXT,
			size INTEGER NOT NULL DEFAULT 0,
			encrypted INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0,
			deleted_at INTEGER,
			share_token TEXT,
			share_expires_at INTEGER,
			is_starred INTEGER NOT NULL DEFAULT 0,
			accessed_at INTEGER,
			sort_order INTEGER NOT NULL DEFAULT 0,
			share_kind TEXT
		);
		CREATE UNIQUE INDEX idx_cloud_files_unique_name
			ON cloud_files(owner_id, name, COALESCE(parent_id, ''))
			WHERE deleted_at IS NULL;
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

func mkFile(owner, id, name string, folder bool) *models.CloudFile {
	return &models.CloudFile{
		ID:        id,
		OwnerID:   owner,
		Name:      name,
		IsFolder:  folder,
		CreatedAt: 1,
		UpdatedAt: 1,
	}
}

// TestCloudOwnerIsolation memastikan user tidak bisa membaca file user lain.
func TestCloudOwnerIsolation(t *testing.T) {
	db := setupCloudTestDB(t)
	defer db.Close()
	repo := NewCloudStorageRepository(db)

	if err := repo.Create(mkFile("userA", "a1", "docA.pdf", false)); err != nil {
		t.Fatalf("create A: %v", err)
	}

	// userB tidak boleh melihat file userA.
	if _, err := repo.GetFile("userB", "a1"); err != ErrCloudNotFound {
		t.Fatalf("userB membaca file userA: err=%v, want ErrCloudNotFound", err)
	}
	// userA sendiri boleh.
	if _, err := repo.GetFile("userA", "a1"); err != nil {
		t.Fatalf("userA membaca file sendiri: %v", err)
	}
	// List userB kosong.
	files, err := repo.ListFiles("userB", nil, 0, 0)
	if err != nil {
		t.Fatalf("list userB: %v", err)
	}
	if len(files) != 0 {
		t.Fatalf("userB melihat %d file userA", len(files))
	}
}

// TestCloudUniqueNameConstraint memastikan nama kembar di folder sama ditolak
// oleh unique index.
func TestCloudUniqueNameConstraint(t *testing.T) {
	db := setupCloudTestDB(t)
	defer db.Close()
	repo := NewCloudStorageRepository(db)

	if err := repo.Create(mkFile("u", "1", "sama.pdf", false)); err != nil {
		t.Fatalf("create 1: %v", err)
	}
	err := repo.Create(mkFile("u", "2", "sama.pdf", false))
	if err == nil {
		t.Fatal("nama kembar seharusnya ditolak")
	}
	if !IsCloudUniqueConstraint(err) {
		t.Fatalf("error bukan unique constraint: %v", err)
	}
}

// TestCloudTrashAndRestore menguji soft delete + restore.
func TestCloudTrashAndRestore(t *testing.T) {
	db := setupCloudTestDB(t)
	defer db.Close()
	repo := NewCloudStorageRepository(db)

	_ = repo.Create(mkFile("u", "1", "x.pdf", false))
	if err := repo.SoftDelete("u", "1", 999); err != nil {
		t.Fatalf("soft delete: %v", err)
	}
	if _, err := repo.GetFile("u", "1"); err != ErrCloudNotFound {
		t.Fatalf("file terhapus masih terlihat: %v", err)
	}
	trash, err := repo.ListTrash("u")
	if err != nil || len(trash) != 1 {
		t.Fatalf("trash salah: n=%d err=%v", len(trash), err)
	}
	if err := repo.Restore("u", "1", 1000); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if _, err := repo.GetFile("u", "1"); err != nil {
		t.Fatalf("file belum pulih: %v", err)
	}
}

// TestCloudSafeDeleteNameReuse memastikan nama bisa dipakai lagi setelah
// item dengan nama itu dihapus (unique index parsial mengabaikan trash).
func TestCloudSafeDeleteNameReuse(t *testing.T) {
	db := setupCloudTestDB(t)
	defer db.Close()
	repo := NewCloudStorageRepository(db)

	_ = repo.Create(mkFile("u", "1", "laporan.pdf", false))
	if err := repo.SoftDelete("u", "1", 999); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if err := repo.Create(mkFile("u", "2", "laporan.pdf", false)); err != nil {
		t.Fatalf("nama setelah delete seharusnya bisa dipakai: %v", err)
	}
}

func TestUniqueCloudName(t *testing.T) {
	used := map[string]bool{"file.pdf": true, "file (1).pdf": true}
	got := UniqueCloudName(used, "file.pdf")
	if got != "file (2).pdf" {
		t.Fatalf("UniqueCloudName = %q, want %q", got, "file (2).pdf")
	}
	if n := UniqueCloudName(map[string]bool{}, "baru.txt"); n != "baru.txt" {
		t.Fatalf("nama tanpa konflik berubah: %q", n)
	}
}
