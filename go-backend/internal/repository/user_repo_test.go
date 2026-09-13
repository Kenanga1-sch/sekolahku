package repository

import (
	"database/sql"
	"testing"
	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory db: %v", err)
	}

		// Create users table matching the actual schema expected by user_repo.go
		_, err = db.Exec(`
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT,
			email TEXT UNIQUE,
			email_verified INTEGER,
			image TEXT,
			username TEXT,
			password_hash TEXT,
			role TEXT NOT NULL DEFAULT 'user',
			full_name TEXT,
			phone TEXT,
			is_active INTEGER DEFAULT 1,
			must_change_password INTEGER DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create users table: %v", err)
	}

	return db
}

func TestUserRepository_GetUserByEmail(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	repo := NewUserRepository(db)
	
	// Seed a user with all expected columns
	_, err := db.Exec(`
		INSERT INTO users (id, name, email, role, password_hash, is_active) 
		VALUES (?, ?, ?, ?, ?, ?)`, 
		"user-1", "Test User", "test@example.com", "admin", "hashed_pass", 1)
	if err != nil {
		t.Fatalf("Failed to seed user: %v", err)
	}

	t.Run("Found", func(t *testing.T) {
		user, err := repo.GetUserByEmail("test@example.com")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if user == nil {
			t.Fatal("User should be found")
		}
		if user.ID != "user-1" {
			t.Errorf("Expected ID user-1, got %s", user.ID)
		}
		if user.Role != "admin" {
			t.Errorf("Expected role admin, got %s", user.Role)
		}
	})

	t.Run("Not Found", func(t *testing.T) {
		user, err := repo.GetUserByEmail("none@example.com")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if user != nil {
			t.Error("User should be nil")
		}
	})
}

func TestUserRepository_GetUserByID(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	repo := NewUserRepository(db)
	
	// Seed
	_, err := db.Exec(`INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)`, 
		"id-123", "John Doe", "john@example.com", "staff")
	if err != nil { t.Fatal(err) }

	t.Run("Exists", func(t *testing.T) {
		user, err := repo.GetUserByID("id-123")
		if err != nil { t.Fatal(err) }
		if user == nil || user.ID != "id-123" { t.Error("Failed to get correct user") }
		if user.Role != "staff" { t.Errorf("Expected staff, got %s", user.Role) }
	})

	t.Run("Not Exists", func(t *testing.T) {
		user, err := repo.GetUserByID("unknown")
		if err != nil { t.Fatal(err) }
		if user != nil { t.Error("Should be nil") }
	})
}

// Regresi: akun orang tua punya email NULL (login pakai nomor HP).
// Sebelumnya scan NULL ke string meledak -> login 500.
func TestUserRepository_EmailNullLoginViaUsername(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repo := NewUserRepository(db)

	_, err := db.Exec(`INSERT INTO users (id, name, email, username, role, password_hash, phone, is_active) VALUES (?, ?, NULL, ?, ?, ?, ?, 1)`,
		"parent-1", "Bapak Ani", "081234567890", "orangtua", "hash", "081234567890")
	if err != nil {
		t.Fatalf("seed: %v", err)
	}

	user, err := repo.GetUserByEmail("081234567890")
	if err != nil {
		t.Fatalf("login pakai username dengan email NULL tidak boleh error: %v", err)
	}
	if user == nil || user.ID != "parent-1" || user.Role != "orangtua" {
		t.Fatalf("user ortu harus ditemukan: %+v", user)
	}
	if user.Email != "" {
		t.Fatalf("email NULL harus jadi string kosong, dapat %q", user.Email)
	}

	byID, err := repo.GetUserByID("parent-1")
	if err != nil || byID == nil || byID.ID != "parent-1" {
		t.Fatalf("GetUserByID dengan email NULL: %+v %v", byID, err)
	}

	list, total, err := repo.GetUsersByRole(1, 10, "", "orangtua")
	if err != nil || total != 1 || len(list) != 1 {
		t.Fatalf("GetUsersByRole email NULL: total=%d len=%d err=%v", total, len(list), err)
	}
}
