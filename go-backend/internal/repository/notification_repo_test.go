package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func TestNotifyRoles_FanOutKepadaAdminSaja(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	// :memory: SQLite hidup per-connection — kunci pool ke satu koneksi
	// agar DDL dan query berikutnya menempel pada database yang sama.
	db.SetMaxOpenConns(1)
	defer db.Close()
	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT)`,
		`INSERT INTO users (id, role) VALUES ('a1','admin'), ('a2','superadmin'), ('g1','guru'), ('b1','bendahara')`,
		`CREATE TABLE admin_notifications (
			id TEXT PRIMARY KEY, user_id TEXT, type TEXT, category TEXT,
			title TEXT, message TEXT, target_url TEXT, is_read INTEGER DEFAULT 0,
			metadata TEXT, created_at INTEGER
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatal(err)
		}
	}
	repo := NewNotificationRepository(db)

	err = repo.NotifyRoles(models.Notification{
		Type: "info", Category: "kontak", Title: "Pesan masuk baru", Message: "tes",
	}, "admin", "superadmin")
	if err != nil {
		t.Fatalf("NotifyRoles: %v", err)
	}

	// Hanya 2 admin yang menerima — bukan guru/bendahara, bukan broadcast.
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM admin_notifications`).Scan(&count)
	if count != 2 {
		t.Fatalf("harus 2 notifikasi, ada %d", count)
	}
	var nullBroadcast int
	db.QueryRow(`SELECT COUNT(*) FROM admin_notifications WHERE user_id IS NULL`).Scan(&nullBroadcast)
	if nullBroadcast != 0 {
		t.Fatal("tidak boleh ada broadcast")
	}
	var guru int
	db.QueryRow(`SELECT COUNT(*) FROM admin_notifications WHERE user_id = 'g1'`).Scan(&guru)
	if guru != 0 {
		t.Fatal("guru tidak boleh menerima notifikasi pengaduan")
	}

	// GetStats per user bekerja.
	s, _ := repo.GetStats("a1")
	if s.UnreadCount != 1 {
		t.Fatalf("unread a1 harus 1, ada %d", s.UnreadCount)
	}
}
