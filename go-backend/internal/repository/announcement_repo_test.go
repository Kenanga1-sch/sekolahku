package repository

import (
	"database/sql"
	"strings"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/sekolahku/go-backend/internal/models"
)

func setupAnnouncementTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	// :memory: + modernc sqlite: koneksi baru berarti database baru.
	db.SetMaxOpenConns(1)

	_, err = db.Exec(`
		CREATE TABLE announcements (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			content TEXT,
			excerpt TEXT,
			category TEXT,
			thumbnail TEXT,
			is_published INTEGER DEFAULT 0,
			is_featured INTEGER DEFAULT 0,
			published_at INTEGER,
			created_at INTEGER,
			updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

// TestAnnouncementContentIsSanitizedOnCreate memastikan script yang dikirim
// klien dibuang sebelum masuk database.
func TestAnnouncementContentIsSanitizedOnCreate(t *testing.T) {
	db := setupAnnouncementTestDB(t)
	defer db.Close()

	repo := NewAnnouncementRepository(db)

	dirty := `<p>Pengumuman resmi</p><script>fetch('//evil.tld')</script><img src=x onerror="alert(1)">`
	id, err := repo.CreateAnnouncement(models.CreateAnnouncementRequest{
		Title:   "Uji",
		Slug:    "uji-sanitize",
		Content: strPtr(dirty),
	})
	if err != nil {
		t.Fatalf("CreateAnnouncement: %v", err)
	}

	var stored string
	if err := db.QueryRow(`SELECT content FROM announcements WHERE id = ?`, id).Scan(&stored); err != nil {
		t.Fatalf("scan: %v", err)
	}

	if strings.Contains(strings.ToLower(stored), "<script") {
		t.Errorf("script tidak boleh tersimpan, got: %s", stored)
	}
	if strings.Contains(strings.ToLower(stored), "onerror") {
		t.Errorf("onerror tidak boleh tersimpan, got: %s", stored)
	}
	if !strings.Contains(stored, "Pengumuman resmi") {
		t.Errorf("konten sah harus tetap tersimpan, got: %s", stored)
	}
}

// TestAnnouncementContentSanitizedOnUpdate memastikan jalur update juga
// dibersihkan, bukan hanya create.
func TestAnnouncementContentSanitizedOnUpdate(t *testing.T) {
	db := setupAnnouncementTestDB(t)
	defer db.Close()

	repo := NewAnnouncementRepository(db)

	id, err := repo.CreateAnnouncement(models.CreateAnnouncementRequest{
		Title:   "Awal",
		Slug:    "uji-update",
		Content: strPtr("<p>lama</p>"),
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	err = repo.UpdateAnnouncement(id, models.CreateAnnouncementRequest{
		Title:   "Baru",
		Slug:    "uji-update",
		Content: strPtr(`<p>baru</p><iframe src="https://evil.tld"></iframe>`),
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}

	var stored string
	if err := db.QueryRow(`SELECT content FROM announcements WHERE id = ?`, id).Scan(&stored); err != nil {
		t.Fatalf("scan: %v", err)
	}
	if strings.Contains(strings.ToLower(stored), "<iframe") {
		t.Errorf("iframe tidak boleh tersimpan setelah update, got: %s", stored)
	}
	if !strings.Contains(stored, "baru") {
		t.Errorf("konten update hilang, got: %s", stored)
	}
}

// TestAnnouncementNilContentStaysNull memastikan field kosong TIDAK berubah
// menjadi string kosong — sanitasi harus mempertahankan NULL.
func TestAnnouncementNilContentStaysNull(t *testing.T) {
	db := setupAnnouncementTestDB(t)
	defer db.Close()

	repo := NewAnnouncementRepository(db)

	id, err := repo.CreateAnnouncement(models.CreateAnnouncementRequest{
		Title: "Tanpa konten",
		Slug:  "uji-null",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	var content sql.NullString
	if err := db.QueryRow(`SELECT content FROM announcements WHERE id = ?`, id).Scan(&content); err != nil {
		t.Fatalf("scan: %v", err)
	}
	if content.Valid {
		t.Errorf("content seharusnya NULL, got %q", content.String)
	}
}

// TestAnnouncementRichFormattingPreserved memastikan gaya surat/pengumuman
// (rata teks, warna, tabel) tidak dibuang oleh sanitasi.
func TestAnnouncementRichFormattingPreserved(t *testing.T) {
	db := setupAnnouncementTestDB(t)
	defer db.Close()

	repo := NewAnnouncementRepository(db)

	in := `<table style="width:100%"><tbody><tr><td colspan="2" style="text-align:center">Nomor</td></tr></tbody></table>`
	id, err := repo.CreateAnnouncement(models.CreateAnnouncementRequest{
		Title:   "Format",
		Slug:    "uji-format",
		Content: strPtr(in),
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	var stored string
	if err := db.QueryRow(`SELECT content FROM announcements WHERE id = ?`, id).Scan(&stored); err != nil {
		t.Fatalf("scan: %v", err)
	}
	for _, want := range []string{"colspan", "text-align:center", "<table"} {
		if !strings.Contains(stored, want) {
			t.Errorf("formatting %q hilang dari hasil simpan:\n%s", want, stored)
		}
	}
}
