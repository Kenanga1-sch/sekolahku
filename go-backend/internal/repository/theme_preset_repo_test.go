package repository

import (
	"database/sql"
	"encoding/json"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupThemePresetTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE saved_themes (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			brand_theme TEXT NOT NULL,
			is_default BOOLEAN NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
	`)
	if err != nil {
		t.Fatalf("failed to create saved_themes schema: %v", err)
	}

	return db
}

func themeJSON(t *testing.T, primary string) string {
	t.Helper()
	raw := map[string]string{"primary": primary, "secondary": "#98D8D0", "radius": "0.75rem"}
	b, err := json.Marshal(raw)
	if err != nil {
		t.Fatalf("failed to marshal theme: %v", err)
	}
	return string(b)
}

func TestThemePresetRepositoryCRUD(t *testing.T) {
	db := setupThemePresetTestDB(t)
	defer db.Close()

	repo := NewThemePresetRepository(db)

	// Create
	created, err := repo.Create(models.SavedThemeRequest{
		Name:        "Teal Uji",
		Description: "preset uji",
		BrandTheme:  themeJSON(t, "#0A3D4A"),
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if created.Name != "Teal Uji" || created.IsDefault {
		t.Fatalf("unexpected created preset: %+v", created)
	}

	// GetAll memuat preset yang baru dibuat
	list, err := repo.GetAll()
	if err != nil {
		t.Fatalf("getall failed: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 preset, got %d", len(list))
	}

	// GetByID mengembalikan JSON utuh
	got, err := repo.GetByID(created.ID)
	if err != nil {
		t.Fatalf("getbyid failed: %v", err)
	}
	var theme map[string]string
	if err := json.Unmarshal([]byte(got.BrandTheme), &theme); err != nil {
		t.Fatalf("brand_theme bukan JSON valid: %v", err)
	}
	if theme["primary"] != "#0A3D4A" {
		t.Fatalf("brand_theme primary salah: %q", theme["primary"])
	}

	// Update
	updated, err := repo.Update(created.ID, models.SavedThemeRequest{
		Name:        "Teal Uji v2",
		Description: "diperbarui",
		BrandTheme:  themeJSON(t, "#10606F"),
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if updated.Name != "Teal Uji v2" {
		t.Fatalf("update tidak tersimpan: %+v", updated)
	}

	// Create menolak nama kosong
	if _, err := repo.Create(models.SavedThemeRequest{Name: " ", BrandTheme: themeJSON(t, "#000000")}); err == nil {
		t.Fatal("expected error for empty name")
	}

	// Delete
	if err := repo.Delete(created.ID); err != nil {
		t.Fatalf("delete failed: %v", err)
	}
	if _, err := repo.GetByID(created.ID); err == nil {
		t.Fatal("expected error after delete")
	}

	// Delete preset tidak ada → error
	if err := repo.Delete("preset-tidak-ada"); err == nil {
		t.Fatal("expected error deleting missing preset")
	}
}

func TestThemePresetRepositoryIsDefaultOrder(t *testing.T) {
	db := setupThemePresetTestDB(t)
	defer db.Close()

	repo := NewThemePresetRepository(db)

	// Seed gaya migration: 1 default + 1 biasa
	_, err := db.Exec(`
		INSERT INTO saved_themes (id, name, description, brand_theme, is_default, created_at, updated_at) VALUES
		('preset-biasa', 'Biasa', '', '{"primary":"#1E40AF"}', 0, 1, 1),
		('preset-default', 'Default', '', '{"primary":"#0A3D4A"}', 1, 2, 2)
	`)
	if err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	list, err := repo.GetAll()
	if err != nil {
		t.Fatalf("getall failed: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 presets, got %d", len(list))
	}
	if !list[0].IsDefault || list[0].ID != "preset-default" {
		t.Fatalf("preset default harus diurutan pertama: %+v", list[0])
	}
}
