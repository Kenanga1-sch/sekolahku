package repository

import (
	"testing"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

// TestAuditFindsMissingNumbers adalah inti pemeriksaan fisik: dari nomor yang
// dipindai, nomor yang tidak ikut harus dilaporkan sebagai temuan.
func TestAuditFindsMissingNumbers(t *testing.T) {
	r := setupBatchTestDB(t)
	when := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	inTrx(t, r, 6, when, nil)

	all, err := r.GetItemUnits("it-1", 2026, false)
	if err != nil {
		t.Fatalf("units: %v", err)
	}
	if len(all) != 6 {
		t.Fatalf("harus ada 6 unit, dapat %d", len(all))
	}

	// Petugas memindai 1,2,3,5,6 — nomor 4 tidak ada di rak.
	scanned := map[int]bool{1: true, 2: true, 3: true, 5: true, 6: true}
	var missing []int
	for _, u := range all {
		if !scanned[u.UnitNo] {
			missing = append(missing, u.UnitNo)
		}
	}
	if len(missing) != 1 || missing[0] != 4 {
		t.Fatalf("yang hilang harus [4], dapat %v", missing)
	}
}

// TestAuditCompleteWhenAllScanned memastikan hasil dinyatakan lengkap bila
// seluruh nomor ditemukan.
func TestAuditCompleteWhenAllScanned(t *testing.T) {
	r := setupBatchTestDB(t)
	when := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	inTrx(t, r, 3, when, nil)

	all, err := r.GetItemUnits("it-1", 2026, false)
	if err != nil {
		t.Fatalf("units: %v", err)
	}
	scanned := map[int]bool{}
	for _, u := range all {
		scanned[u.UnitNo] = true
	}
	missing := 0
	for _, u := range all {
		if !scanned[u.UnitNo] {
			missing++
		}
	}
	if missing != 0 {
		t.Errorf("harusnya lengkap, masih ada %d yang hilang", missing)
	}
}

// TestAuditIssuedUnitsStillCounted memastikan bungkus yang sudah keluar tetap
// dihitung sebagai milik barang ini — pemeriksaan melaporkannya, bukan
// menganggapnya hilang begitu saja.
func TestAuditIssuedUnitsStillCounted(t *testing.T) {
	r := setupBatchTestDB(t)
	when := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	inTrx(t, r, 5, when, nil)
	outTrx(t, r, 1, when, "Perpustakaan", []int{3})

	all, err := r.GetItemUnits("it-1", 2026, false)
	if err != nil {
		t.Fatalf("units: %v", err)
	}
	if len(all) != 5 {
		t.Errorf("bungkus yang sudah keluar tetap tercatat: dapat %d, mau 5", len(all))
	}

	// Nomor 3 tercatat keluar ke perpustakaan.
	var found *models.ItemUnit
	for i := range all {
		if all[i].UnitNo == 3 {
			found = &all[i]
		}
	}
	if found == nil || found.Status != models.ItemUnitIssued {
		t.Fatal("nomor 3 harus berstatus ISSUED")
	}
	if found.IssuedTo == nil || *found.IssuedTo != "Perpustakaan" {
		t.Errorf("nomor 3 harus tercatat ke Perpustakaan, dapat %v", derefStr(found.IssuedTo))
	}
}
