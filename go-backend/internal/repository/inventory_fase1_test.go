package repository

import (
	"database/sql"
	"testing"
)

func setupInvDB(t *testing.T) *sql.DB {
	t.Helper()
	return setupInventorySchemaFromMigrations(t)
}

func TestGetRecentAuditShape(t *testing.T) {
	db := setupInvDB(t)
	defer db.Close()
	r := &InventoryRepository{DB: db}

	db.Exec(`INSERT INTO users (id, name, role) VALUES ('u1','Budi','guru')`)
	db.Exec(`INSERT INTO inventory_audit VALUES ('a1','CREATE','ASSET','asset-xyz-1234','[]','u1',1700000000000)`)
	db.Exec(`INSERT INTO inventory_audit VALUES ('a2','UPDATE','ROOM',NULL,NULL,NULL,0)`)

	got, err := r.GetRecentAudit(10)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 rows, got %d", len(got))
	}
	// Terbaru dulu
	if got[0].ID != "a1" {
		t.Errorf("want a1 first, got %s", got[0].ID)
	}
	if got[0].Action != "CREATE" || got[0].Entity != "ASSET" {
		t.Errorf("bad action/entity: %+v", got[0])
	}
	if got[0].UserName != "Budi" {
		t.Errorf("want Budi, got %q", got[0].UserName)
	}
	if got[0].Time == "" {
		t.Errorf("Time must not be empty (was scanned from note before)")
	}
	// Baris tanpa entity_id / user / created_at tidak boleh bikin error
	if got[1].EntityID != "" || got[1].UserName != "" {
		t.Errorf("nulls should be empty strings: %+v", got[1])
	}
}

func TestGetStatsPropagatesError(t *testing.T) {
	db := setupInvDB(t)
	defer db.Close()
	r := &InventoryRepository{DB: db}

	// Happy path: tabel ada, kosong
	st, err := r.GetStats()
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if st == nil || st.TotalAssets != 0 {
		t.Fatalf("want zero stats, got %+v", st)
	}

	// Tabel dihapus => error harus dikembalikan, BUKAN statistik nol
	db.Exec("DROP TABLE inventory_assets")
	st2, err := r.GetStats()
	if err == nil {
		t.Fatal("expected error when table missing, got nil")
	}
	if st2 != nil {
		t.Errorf("want nil stats on error, got %+v", st2)
	}
}
