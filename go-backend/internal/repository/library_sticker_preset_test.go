package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

// setupStickerPresetTestDB membangun skema preset DARI FILE MIGRASI ASLI
// (000058) plus tabel users minimal, karena ListStickerPresets mem-JOIN users
// untuk menampilkan nama pembuat.
func setupStickerPresetTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file:stickerpreset?mode=memory&cache=shared")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })

	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT)`); err != nil {
		t.Fatalf("users table: %v", err)
	}
	if _, err := db.Exec(`INSERT OR IGNORE INTO users (id, name) VALUES ('user-1', 'Pustakawan Budi')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	applyMigrationFile(t, db, "000058_library_sticker_presets.up.sql")
	return db
}

func TestStickerPreset_CreateListUpdateDelete(t *testing.T) {
	db := setupStickerPresetTestDB(t)
	repo := NewLibraryStickerPresetRepository(db)

	created, err := repo.CreateStickerPreset(stickerPreset(t), "user-1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.ID == "" {
		t.Fatal("create tidak mengembalikan id")
	}

	presets, err := repo.ListStickerPresets()
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(presets) != 1 {
		t.Fatalf("preset %d, diharapkan 1", len(presets))
	}
	// Nama pembuat harus terisi dari JOIN users.
	if presets[0].CreatedByName != "Pustakawan Budi" {
		t.Errorf("createdByName = %q, diharapkan %q", presets[0].CreatedByName, "Pustakawan Budi")
	}

	// Update nama + ukuran.
	upd := stickerPreset(t)
	upd.Name = "Nama Baru"
	upd.LabelWidth = 40
	updated, err := repo.UpdateStickerPreset(created.ID, upd)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Name != "Nama Baru" || updated.LabelWidth != 40 {
		t.Errorf("update tidak diterapkan: %+v", updated)
	}

	// Pastikan perubahan benar-benar tersimpan.
	presets, _ = repo.ListStickerPresets()
	if len(presets) != 1 || presets[0].Name != "Nama Baru" {
		t.Fatalf("update tidak persisten: %+v", presets)
	}

	if err := repo.DeleteStickerPreset(created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	presets, _ = repo.ListStickerPresets()
	if len(presets) != 0 {
		t.Fatalf("setelah delete masih ada %d preset", len(presets))
	}
}

func TestStickerPreset_Validation(t *testing.T) {
	db := setupStickerPresetTestDB(t)
	repo := NewLibraryStickerPresetRepository(db)

	cases := map[string]func(p *models.StickerPreset){
		"nama kosong":           func(p *models.StickerPreset) {},
		"lebar label nol":       func(p *models.StickerPreset) { p.LabelWidth = 0 },
		"label melebihi kertas": func(p *models.StickerPreset) { p.LabelWidth = 999 },
		"font terlalu besar":    func(p *models.StickerPreset) { p.FontSize = 40 },
		"gap negatif":           func(p *models.StickerPreset) { p.GapX = -1 },
	}

	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			p := stickerPreset(t)
			if name == "nama kosong" {
				p.Name = "   "
			}
			mutate(&p)
			if _, err := repo.CreateStickerPreset(p, "user-1"); err == nil {
				t.Errorf("kasus %q seharusnya ditolak", name)
			}
		})
	}
}

func TestStickerPreset_UpdateDeleteNotFound(t *testing.T) {
	db := setupStickerPresetTestDB(t)
	repo := NewLibraryStickerPresetRepository(db)

	if _, err := repo.UpdateStickerPreset("tidak-ada", stickerPreset(t)); err == nil {
		t.Error("update id tak dikenal seharusnya error")
	}
	if err := repo.DeleteStickerPreset("tidak-ada"); err == nil {
		t.Error("delete id tak dikenal seharusnya error")
	}
}

// stickerPreset mengembalikan preset valid untuk dipakai sebagai basis uji.
func stickerPreset(t *testing.T) models.StickerPreset {
	t.Helper()
	return models.StickerPreset{
		Name:        "Preset Uji",
		PaperWidth:  210,
		PaperHeight: 297,
		LabelWidth:  63.7,
		LabelHeight: 33.2,
		GapX:        2.5,
		GapY:        2.5,
		FontSize:    11,
	}
}
