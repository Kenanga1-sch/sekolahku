package repository

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func setupUserSoftDeleteTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		t.Fatalf("pragma: %v", err)
	}
	stmts := []string{
		`CREATE TABLE users (
			id TEXT PRIMARY KEY, name TEXT, full_name TEXT, email TEXT UNIQUE,
			username TEXT UNIQUE, password_hash TEXT, role TEXT DEFAULT 'user',
			phone TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER,
			updated_at INTEGER, image TEXT, email_verified INTEGER,
			must_change_password INTEGER DEFAULT 0
		)`,
		`CREATE TABLE audit_logs (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), action TEXT, resource TEXT, details TEXT, ip_address TEXT, user_agent TEXT, created_at INTEGER)`,
		`CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), title TEXT, message TEXT, is_read INTEGER DEFAULT 0, created_at INTEGER)`,
		`CREATE TABLE admin_notifications (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, created_at INTEGER)`,
		`CREATE TABLE disposisi (id TEXT PRIMARY KEY, from_user_id TEXT REFERENCES users(id), to_user_id TEXT REFERENCES users(id), surat_id TEXT, catatan TEXT, created_at INTEGER)`,
		`CREATE TABLE school_documents (id TEXT PRIMARY KEY, created_by TEXT REFERENCES users(id), title TEXT, created_at INTEGER)`,
		`CREATE TABLE employee_details (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), name TEXT, email TEXT, role TEXT, nip TEXT, phone TEXT)`,
		`CREATE TABLE surat_keluar (id TEXT PRIMARY KEY, created_by TEXT REFERENCES users(id), nomor TEXT, created_at INTEGER)`,
		`CREATE TABLE tabungan_brankas_transaksi (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), type TEXT, amount INTEGER, created_at INTEGER)`,
		`CREATE TABLE tabungan_setoran (id TEXT PRIMARY KEY, guru_id TEXT REFERENCES users(id), bendahara_id TEXT REFERENCES users(id), amount INTEGER, created_at INTEGER)`,
		`CREATE TABLE tabungan_transaksi (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), type TEXT, amount INTEGER, created_at INTEGER)`,
		`CREATE TABLE announcements (id TEXT PRIMARY KEY, author_id TEXT, title TEXT, content TEXT, created_at INTEGER)`,
		`CREATE TABLE finance_transactions (id TEXT PRIMARY KEY, created_by TEXT, type TEXT, amount INTEGER, created_at INTEGER)`,
		`CREATE TABLE library_members (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, member_code TEXT)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec: %v\nSQL: %s", err, s)
		}
	}
	return db
}

func insertTestUser(t *testing.T, db *sql.DB, id, name, email string) {
	t.Helper()
	_, err := db.Exec(
		`INSERT INTO users (id, name, email, role, is_active, must_change_password, created_at, updated_at) VALUES (?,?,?,?,1,0,1000,1000)`,
		id, name, email, "guru",
	)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
}

func TestCountUserReferences_Empty(t *testing.T) {
	db := setupUserSoftDeleteTestDB(t)
	defer db.Close()
	repo := NewUserRepository(db)
	insertTestUser(t, db, "u1", "Guru A", "a@test.com")

	refs, err := repo.CountUserReferences("u1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(refs) != 0 {
		t.Fatalf("expected 0 refs, got %d: %v", len(refs), refs)
	}
}

func TestCountUserReferences_WithRefs(t *testing.T) {
	db := setupUserSoftDeleteTestDB(t)
	defer db.Close()
	repo := NewUserRepository(db)
	insertTestUser(t, db, "u1", "Guru A", "a@test.com")

	db.Exec(`INSERT INTO audit_logs (id, user_id, action, resource, created_at) VALUES ('a1','u1','login','auth',1000)`)
	db.Exec(`INSERT INTO audit_logs (id, user_id, action, resource, created_at) VALUES ('a2','u1','logout','auth',1001)`)
	db.Exec(`INSERT INTO notifications (id, user_id, title, message, created_at) VALUES ('n1','u1','Hi','msg',1000)`)

	refs, err := repo.CountUserReferences("u1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if refs["catatan audit"] != 2 {
		t.Errorf("expected 2 audit refs, got %d", refs["catatan audit"])
	}
	if refs["notifikasi"] != 1 {
		t.Errorf("expected 1 notification ref, got %d", refs["notifikasi"])
	}
	if len(refs) != 2 {
		t.Errorf("expected exactly 2 ref types, got %d: %v", len(refs), refs)
	}
}

func TestSetUserActive(t *testing.T) {
	db := setupUserSoftDeleteTestDB(t)
	defer db.Close()
	repo := NewUserRepository(db)
	insertTestUser(t, db, "u1", "Guru A", "a@test.com")

	if err := repo.SetUserActive("u1", false); err != nil {
		t.Fatalf("deactivate: %v", err)
	}
	u, _ := repo.GetUserByID("u1")
	if u.IsActive {
		t.Fatal("expected user to be inactive")
	}

	if err := repo.SetUserActive("u1", true); err != nil {
		t.Fatalf("reactivate: %v", err)
	}
	u, _ = repo.GetUserByID("u1")
	if !u.IsActive {
		t.Fatal("expected user to be active")
	}
}

func TestSetUserActive_NotFound(t *testing.T) {
	db := setupUserSoftDeleteTestDB(t)
	defer db.Close()
	repo := NewUserRepository(db)

	err := repo.SetUserActive("nonexistent", false)
	if err != sql.ErrNoRows {
		t.Fatalf("expected ErrNoRows, got %v", err)
	}
}

func TestDeleteUser_FKConstraint(t *testing.T) {
	db := setupUserSoftDeleteTestDB(t)
	defer db.Close()
	repo := NewUserRepository(db)
	insertTestUser(t, db, "u1", "Guru A", "a@test.com")
	db.Exec(`INSERT INTO audit_logs (id, user_id, action, resource, created_at) VALUES ('a1','u1','login','auth',1000)`)

	err := repo.DeleteUser("u1")
	if err == nil {
		t.Fatal("expected FK constraint error, got nil")
	}
}

func TestDeleteUser_NoRefs(t *testing.T) {
	db := setupUserSoftDeleteTestDB(t)
	defer db.Close()
	repo := NewUserRepository(db)
	insertTestUser(t, db, "u1", "Guru A", "a@test.com")

	err := repo.DeleteUser("u1")
	if err != nil {
		t.Fatalf("expected clean delete, got %v", err)
	}
	u, _ := repo.GetUserByID("u1")
	if u != nil {
		t.Fatal("expected user to be deleted")
	}
}

func TestDeleteUser_CascadeLibraryMembers(t *testing.T) {
	db := setupUserSoftDeleteTestDB(t)
	defer db.Close()
	repo := NewUserRepository(db)
	insertTestUser(t, db, "u1", "Siswa A", "a@test.com")
	db.Exec(`INSERT INTO library_members (id, user_id, member_code) VALUES ('m1','u1','LIB-001')`)

	err := repo.DeleteUser("u1")
	if err != nil {
		t.Fatalf("library_members is ON DELETE CASCADE, should not block: %v", err)
	}
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM library_members WHERE user_id='u1'`).Scan(&count)
	if count != 0 {
		t.Fatalf("expected library_members to be cascaded, got %d", count)
	}
}