package repository

import (
	"encoding/json"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
)

// TestPublicLabelFieldSafety memastikan respons endpoint publik TIDAK memuat
// field sensitif. Endpoint ini sengaja tanpa autentikasi, jadi harga dan
// catatan internal tidak boleh terbawa.
func TestPublicLabelFieldSafety(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	seedInventoryBase(t, db)
	r := newRepo(db)

	resp, err := r.GetPublicAssetLabel("a-1", 3)
	if err != nil {
		t.Fatalf("GetPublicAssetLabel: %v", err)
	}

	raw, err := json.Marshal(resp)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}

	for _, banned := range []string{"price", "notes", "user_id", "created_at", "updated_at", "userId", "createdAt"} {
		if _, ok := m[banned]; ok {
			t.Errorf("field sensitif %q bocor di respons publik", banned)
		}
	}

	if resp.Name != "Proyektor" {
		t.Errorf("name: got %q", resp.Name)
	}
	if resp.UnitNumber != 3 {
		t.Errorf("unitNumber: got %d", resp.UnitNumber)
	}
	if resp.Condition == nil || resp.Condition.Good != 5 {
		t.Errorf("condition.good: got %+v", resp.Condition)
	}
}

func TestPublicLabelItemAndMissing(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	seedInventoryBase(t, db)
	r := newRepo(db)

	// Item (barang habis pakai)
	resp, err := r.GetPublicItemLabel("i-1", 7, "")
	if err != nil {
		t.Fatalf("GetPublicItemLabel: %v", err)
	}
	if resp.Type != "item" || resp.UnitNumber != 7 {
		t.Errorf("type/unitNumber: %+v", resp)
	}

	// ID tidak dikenal harus ErrInventoryNotFound (404, bukan 500)
	if _, err := r.GetPublicAssetLabel("tidak-ada", 1); err == nil {
		t.Error("aset tak dikenal harus error")
	}

	// Aset ter-soft-delete tidak boleh muncul ke publik
	if err := r.DeleteAsset("a-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := r.GetPublicAssetLabel("a-1", 1); err == nil {
		t.Error("aset terhapus masih tampil ke publik")
	}
}

// TestAssetLabelFieldsRoundTrip memastikan kolom label tersimpan dan terbaca
// kembali lewat Create/Get biasa.
// assetLabelSpec membuat InventoryAsset dengan kolom label terisi.
func assetLabelSpec(name string, funding *string, year *int, photo *string) models.InventoryAsset {
	return models.InventoryAsset{
		Name:          name,
		Category:      "Test",
		Quantity:      10,
		FundingSource: funding,
		FiscalYear:    year,
		PhotoUrl:      photo,
	}
}

func TestAssetLabelFieldsRoundTrip(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	seedInventoryBase(t, db)
	r := newRepo(db)

	funding := "BOSP Kinerja"
	year := 2026
	photo := "/uploads/inventory/foto-uji.jpg"

	id, err := r.CreateAsset(assetLabelSpec("Sapu Lantai", &funding, &year, &photo))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := r.GetAssetByID(id)
	if err != nil || got == nil {
		t.Fatalf("get: %v %v", got, err)
	}
	if got.FundingSource == nil || *got.FundingSource != funding {
		t.Errorf("fundingSource: got %v", got.FundingSource)
	}
	if got.FiscalYear == nil || *got.FiscalYear != year {
		t.Errorf("fiscalYear: got %v", got.FiscalYear)
	}
	if got.PhotoUrl == nil || *got.PhotoUrl != photo {
		t.Errorf("photoUrl: got %v", got.PhotoUrl)
	}
}
