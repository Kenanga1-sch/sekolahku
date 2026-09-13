package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupPushTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`
		CREATE TABLE push_subscriptions (
			id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE,
			p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT,
			created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0,
			last_used_at INTEGER
		)
	`); err != nil {
		t.Fatalf("create: %v", err)
	}
	return db
}

func TestPushSubscription_UpsertDedup(t *testing.T) {
	db := setupPushTestDB(t)
	defer db.Close()
	repo := NewPushRepository(db)

	sub := models.PushSubscribeRequest{Endpoint: "https://push.example/abc", P256dh: "k1", Auth: "a1", UserAgent: "ua1"}
	if err := repo.Upsert("u1", sub); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	// Endpoint sama, user berbeda (mis. HP berganti akun) -> tetap satu baris,
	// user_id diperbarui.
	if err := repo.Upsert("u2", sub); err != nil {
		t.Fatalf("upsert2: %v", err)
	}

	var count int
	db.QueryRow(`SELECT COUNT(*) FROM push_subscriptions`).Scan(&count)
	if count != 1 {
		t.Fatalf("endpoint duplikat harus jadi 1 baris, ada %d", count)
	}
	var owner string
	db.QueryRow(`SELECT user_id FROM push_subscriptions WHERE endpoint = ?`, sub.Endpoint).Scan(&owner)
	if owner != "u2" {
		t.Fatalf("kepemilikan harus berpindah ke u2, dapat %q", owner)
	}

	// User bisa punya beberapa perangkat.
	if err := repo.Upsert("u2", models.PushSubscribeRequest{Endpoint: "https://push.example/def", P256dh: "k2", Auth: "a2"}); err != nil {
		t.Fatal(err)
	}
	n, err := repo.CountByUser("u2")
	if err != nil || n != 2 {
		t.Fatalf("u2 harus punya 2 perangkat, dapat %d (%v)", n, err)
	}

	list, err := repo.ListByUser("u2")
	if err != nil || len(list) != 2 {
		t.Fatalf("ListByUser: %d %v", len(list), err)
	}
	if list[0].Endpoint == "" || list[0].P256dh == "" || list[0].Auth == "" {
		t.Fatalf("data subscription tidak lengkap: %+v", list[0])
	}
}

func TestPushSubscription_DeleteByEndpointTerbatasPemilik(t *testing.T) {
	db := setupPushTestDB(t)
	defer db.Close()
	repo := NewPushRepository(db)

	sub := models.PushSubscribeRequest{Endpoint: "https://push.example/x", P256dh: "k", Auth: "a"}
	if err := repo.Upsert("u1", sub); err != nil {
		t.Fatal(err)
	}

	// User lain mencoba menghapus -> tidak boleh, baris tetap ada.
	if err := repo.DeleteByEndpoint("u2", sub.Endpoint); err != nil {
		t.Fatalf("delete: %v", err)
	}
	n, _ := repo.CountByUser("u1")
	if n != 1 {
		t.Fatal("user lain tidak boleh menghapus subscription orang")
	}

	// Pemilik menghapus -> hilang.
	if err := repo.DeleteByEndpoint("u1", sub.Endpoint); err != nil {
		t.Fatal(err)
	}
	n, _ = repo.CountByUser("u1")
	if n != 0 {
		t.Fatal("subscription milik sendiri harus terhapus")
	}
}

func TestPushSubscription_TouchDanDeleteByID(t *testing.T) {
	db := setupPushTestDB(t)
	defer db.Close()
	repo := NewPushRepository(db)

	if err := repo.Upsert("u1", models.PushSubscribeRequest{Endpoint: "https://push.example/t", P256dh: "k", Auth: "a"}); err != nil {
		t.Fatal(err)
	}
	list, _ := repo.ListByUser("u1")
	if len(list) != 1 {
		t.Fatal("harus 1 subscription")
	}
	if err := repo.Touch(list[0].ID); err != nil {
		t.Fatalf("touch: %v", err)
	}
	list, _ = repo.ListByUser("u1")
	if list[0].LastUsedAt == nil {
		t.Fatal("last_used_at harus terisi setelah Touch")
	}
	if err := repo.DeleteByID(list[0].ID); err != nil {
		t.Fatalf("delete by id: %v", err)
	}
	n, _ := repo.CountByUser("u1")
	if n != 0 {
		t.Fatal("harus terhapus")
	}
}
