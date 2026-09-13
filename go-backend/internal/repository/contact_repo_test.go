package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupContactTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	_, err = db.Exec(`
		CREATE TABLE contact_messages (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT,
			phone TEXT,
			subject TEXT,
			message TEXT NOT NULL,
			category TEXT NOT NULL DEFAULT 'lainnya',
			status TEXT NOT NULL DEFAULT 'baru',
			ticket TEXT,
			is_read BOOLEAN DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE contact_attachments (
			id TEXT PRIMARY KEY,
			message_id TEXT NOT NULL,
			kind TEXT NOT NULL DEFAULT 'evidence',
			file_kind TEXT NOT NULL DEFAULT 'image',
			file_path TEXT NOT NULL,
			original_name TEXT,
			file_size INTEGER NOT NULL DEFAULT 0,
			mime_type TEXT,
			uploaded_by TEXT,
			created_at INTEGER NOT NULL DEFAULT 0
		);
	`)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return db
}

func TestContactFlow_AnonimTiketStatus(t *testing.T) {
	db := setupContactTestDB(t)
	defer db.Close()
	repo := NewContactRepository(db)

	// Pengaduan anonim: nama/email/phone kosong.
	id, ticket, err := repo.CreateMessage(models.SubmitContactRequest{
		Category: "pengaduan",
		Message:  "Ada teman kelas yang sering dipermalukan di depan kelas.",
	})
	if err != nil {
		t.Fatalf("CreateMessage: %v", err)
	}
	if id == "" || len(ticket) != 6 {
		t.Fatalf("id/ticket tidak wajar: %q %q", id, ticket)
	}

	// Nama kosong tercatat sebagai Anonim.
	var name string
	if err := db.QueryRow(`SELECT name FROM contact_messages WHERE id = ?`, id).Scan(&name); err != nil {
		t.Fatalf("query name: %v", err)
	}
	if name != "Anonim" {
		t.Fatalf("nama kosong harus jadi Anonim, got %q", name)
	}

	// Cek status publik mengembalikan kategori+status tanpa isi pesan.
	v, err := repo.GetStatusByTicket(ticket)
	if err != nil || v == nil {
		t.Fatalf("GetStatusByTicket: %v %v", v, err)
	}
	if v.Category != "pengaduan" || v.Status != "baru" {
		t.Fatalf("status awal salah: %+v", v)
	}

	// Admin menandai diproses -> status berubah dan terhitung sudah dibaca.
	if err := repo.UpdateStatus(id, "diproses"); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}
	v, err = repo.GetStatusByTicket(ticket)
	if err != nil || v == nil {
		t.Fatalf("GetStatusByTicket(2): %v", err)
	}
	if v.Status != "diproses" {
		t.Fatalf("status harus diproses, got %q", v.Status)
	}

	// Tiket tak dikenal -> nil tanpa error.
	v, err = repo.GetStatusByTicket("zzzzzz")
	if err != nil || v != nil {
		t.Fatalf("tiket tak dikenal harus nil,nil; got %v %v", v, err)
	}
}

func TestContactMessages_FilterKategori(t *testing.T) {
	db := setupContactTestDB(t)
	defer db.Close()
	repo := NewContactRepository(db)

	if _, _, err := repo.CreateMessage(models.SubmitContactRequest{Name: "A", Category: "kritik", Message: "m"}); err != nil {
		t.Fatal(err)
	}
	if _, _, err := repo.CreateMessage(models.SubmitContactRequest{Name: "B", Category: "pengaduan", Message: "m"}); err != nil {
		t.Fatal(err)
	}
	if _, _, err := repo.CreateMessage(models.SubmitContactRequest{Name: "C", Category: "pengaduan", Message: "m"}); err != nil {
		t.Fatal(err)
	}

	all, total, err := repo.GetMessages(1, 20, "")
	if err != nil || total != 3 || len(all) != 3 {
		t.Fatalf("tanpa filter: total=%d len=%d err=%v", total, len(all), err)
	}
	pengaduan, total, err := repo.GetMessages(1, 20, "pengaduan")
	if err != nil || total != 2 || len(pengaduan) != 2 {
		t.Fatalf("filter pengaduan: total=%d len=%d err=%v", total, len(pengaduan), err)
	}
	for _, m := range pengaduan {
		if m.Category != "pengaduan" {
			t.Fatalf("bocor kategori lain: %+v", m)
		}
	}
}
