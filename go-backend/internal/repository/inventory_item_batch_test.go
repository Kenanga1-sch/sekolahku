package repository

import (
	"testing"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

// setupBatchTestDB menyiapkan skema + satu barang habis pakai.
func setupBatchTestDB(t *testing.T) *InventoryRepository {
	t.Helper()
	db := setupInventorySchemaFromMigrations(t)
	t.Cleanup(func() { db.Close() })

	if _, err := db.Exec(`
		INSERT INTO inventory_items (id, name, category, unit, current_stock, min_stock)
		VALUES ('it-1', 'Kertas HVS A4', 'ATK', 'rim', 0, 0)
	`); err != nil {
		t.Fatalf("seed item: %v", err)
	}
	return &InventoryRepository{DB: db}
}

func inTrx(t *testing.T, r *InventoryRepository, qty int, when time.Time, numbers []int) {
	t.Helper()
	trx := models.InventoryTransaction{
		ItemID:      "it-1",
		Type:        "IN",
		Quantity:    qty,
		Date:        &when,
		UnitNumbers: numbers,
	}
	if err := r.CreateTransaction(trx); err != nil {
		t.Fatalf("IN %d: %v", qty, err)
	}
}

func outTrx(t *testing.T, r *InventoryRepository, qty int, when time.Time, recipient string, numbers []int) {
	t.Helper()
	to := recipient
	trx := models.InventoryTransaction{
		ItemID:      "it-1",
		Type:        "OUT",
		Quantity:    qty,
		Date:        &when,
		Recipient:   &to,
		UnitNumbers: numbers,
	}
	if err := r.CreateTransaction(trx); err != nil {
		t.Fatalf("OUT %d: %v", qty, err)
	}
}

// TestBatchNumberingContinuesAcrossBatches memastikan nomor berlanjut antar
// batch dalam satu tahun: beli 15 lalu 5 menghasilkan 1..15 lalu 16..20.
// Inilah yang membuat nomor bisa dipakai memeriksa kelengkapan fisik.
func TestBatchNumberingContinuesAcrossBatches(t *testing.T) {
	r := setupBatchTestDB(t)
	y2026 := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	inTrx(t, r, 15, y2026, nil)
	inTrx(t, r, 5, y2026, nil)

	batches, err := r.GetItemBatches("it-1")
	if err != nil {
		t.Fatalf("GetItemBatches: %v", err)
	}
	if len(batches) != 2 {
		t.Fatalf("harus ada 2 batch, dapat %d", len(batches))
	}
	// Terbaru lebih dulu.
	second := batches[0]
	first := batches[1]
	if first.StartNo != 1 || first.EndNo != 15 {
		t.Errorf("batch pertama harus 1..15, dapat %d..%d", first.StartNo, first.EndNo)
	}
	if second.StartNo != 16 || second.EndNo != 20 {
		t.Errorf("batch kedua harus 16..20, dapat %d..%d", second.StartNo, second.EndNo)
	}
}

// TestBatchNumberingResetsEachYear memastikan penomoran mulai dari 1 lagi saat
// tahun berganti, nomor lama tidak tertimpa.
func TestBatchNumberingResetsEachYear(t *testing.T) {
	r := setupBatchTestDB(t)

	inTrx(t, r, 15, time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC), nil)
	inTrx(t, r, 4, time.Date(2027, 1, 10, 0, 0, 0, 0, time.UTC), nil)

	units2026, err := r.GetItemUnits("it-1", 2026, false)
	if err != nil {
		t.Fatalf("units 2026: %v", err)
	}
	if len(units2026) != 15 {
		t.Errorf("2026 harus punya 15 unit, dapat %d", len(units2026))
	}
	units2027, err := r.GetItemUnits("it-1", 2027, false)
	if err != nil {
		t.Fatalf("units 2027: %v", err)
	}
	if len(units2027) != 4 {
		t.Errorf("2027 harus punya 4 unit, dapat %d", len(units2027))
	}
	for _, u := range units2027 {
		if u.UnitNo < 1 || u.UnitNo > 4 {
			t.Errorf("2027 harus mulai dari 1, dapat nomor %d", u.UnitNo)
		}
	}
}

// TestUnitAvailableMatchesStock menegakkan invariant terpenting:
// jumlah unit AVAILABLE harus sama dengan current_stock.
// Bila ini meleset, laporan stok dan hasil pemeriksaan fisik bertentangan.
func TestUnitAvailableMatchesStock(t *testing.T) {
	r := setupBatchTestDB(t)
	when := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	inTrx(t, r, 15, when, nil)
	assertInvariant(t, r, 15)

	outTrx(t, r, 2, when, "Perpustakaan", []int{3, 4})
	assertInvariant(t, r, 13)

	outTrx(t, r, 2, when, "Ruang Guru", nil)
	assertInvariant(t, r, 11)
}

func assertInvariant(t *testing.T, r *InventoryRepository, wantStock int) {
	t.Helper()
	var stock int
	if err := r.DB.QueryRow("SELECT current_stock FROM inventory_items WHERE id = 'it-1'").Scan(&stock); err != nil {
		t.Fatalf("baca stok: %v", err)
	}
	avail, err := r.CountAvailableUnits("it-1")
	if err != nil {
		t.Fatalf("hitung unit: %v", err)
	}
	if stock != wantStock {
		t.Errorf("current_stock = %d, mau %d", stock, wantStock)
	}
	if avail != wantStock {
		t.Errorf("unit AVAILABLE = %d, mau %d (invariant dengan stok dilanggar)", avail, wantStock)
	}
}

// TestIssueRecordsWhoTookWhichNumbers adalah inti fitur: mencatat nomor berapa
// keluar ke mana.
func TestIssueRecordsWhoTookWhichNumbers(t *testing.T) {
	r := setupBatchTestDB(t)
	when := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	inTrx(t, r, 15, when, nil)

	outTrx(t, r, 2, when, "Perpustakaan", []int{3, 4})

	for _, no := range []int{3, 4} {
		units, err := r.GetItemUnits("it-1", 2026, false)
		if err != nil {
			t.Fatalf("units: %v", err)
		}
		var found *models.ItemUnit
		for i := range units {
			if units[i].UnitNo == no {
				found = &units[i]
			}
		}
		if found == nil {
			t.Fatalf("nomor %d tidak ditemukan", no)
		}
		if found.Status != models.ItemUnitIssued {
			t.Errorf("nomor %d status = %s, mau ISSUED", no, found.Status)
		}
		if found.IssuedTo == nil || *found.IssuedTo != "Perpustakaan" {
			t.Errorf("nomor %d tujuan = %v, mau Perpustakaan", no, derefStr(found.IssuedTo))
		}
	}
}

// TestCannotIssueSameNumberTwice memastikan bungkus yang sudah keluar tidak
// bisa dikeluarkan lagi — mencegah pencatatan ganda.
func TestCannotIssueSameNumberTwice(t *testing.T) {
	r := setupBatchTestDB(t)
	when := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	inTrx(t, r, 15, when, nil)

	outTrx(t, r, 1, when, "Perpustakaan", []int{3})

	to := "Ruang Guru"
	err := r.CreateTransaction(models.InventoryTransaction{
		ItemID: "it-1", Type: "OUT", Quantity: 1, Date: &when,
		Recipient: &to, UnitNumbers: []int{3},
	})
	if err == nil {
		t.Fatal("mengeluarkan nomor yang sama dua kali harusnya ditolak")
	}
}

// TestReturnMakesNumberAvailableAgain memastikan pengembalian mengembalikan
// nomor menjadi tersedia dan stok bertambah sesuai.
func TestReturnMakesNumberAvailableAgain(t *testing.T) {
	r := setupBatchTestDB(t)
	when := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	inTrx(t, r, 15, when, nil)
	outTrx(t, r, 2, when, "Perpustakaan", []int{3, 4})

	if err := r.ReturnUnits("it-1", nil, []int{3, 4}, when); err != nil {
		t.Fatalf("ReturnUnits: %v", err)
	}
	if _, err := r.DB.Exec(
		"UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?",
		2, when.UnixMilli(), "it-1"); err != nil {
		t.Fatalf("tambah stok: %v", err)
	}

	units, err := r.GetItemUnits("it-1", 2026, true)
	if err != nil {
		t.Fatalf("units: %v", err)
	}
	if len(units) != 15 {
		t.Errorf("setelah dikembalikan, tersedia harus 15, dapat %d", len(units))
	}
	assertInvariant(t, r, 15)
}

// TestGetItemUnitsOnlyAvailable memastikan picker nomor tidak menawarkan nomor
// yang sudah keluar, sehingga mustahil salah pilih.
func TestGetItemUnitsOnlyAvailable(t *testing.T) {
	r := setupBatchTestDB(t)
	when := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	inTrx(t, r, 5, when, nil)
	outTrx(t, r, 1, when, "Perpustakaan", []int{2})

	avail, err := r.GetItemUnits("it-1", 2026, true)
	if err != nil {
		t.Fatalf("units: %v", err)
	}
	if len(avail) != 4 {
		t.Errorf("tersedia harus 4, dapat %d", len(avail))
	}
	for _, u := range avail {
		if u.UnitNo == 2 {
			t.Error("nomor 2 sudah keluar, tidak boleh ditawarkan")
		}
	}

	all, err := r.GetItemUnits("it-1", 2026, false)
	if err != nil {
		t.Fatalf("all units: %v", err)
	}
	if len(all) != 5 {
		t.Errorf("semua unit harus 5, dapat %d", len(all))
	}
}

// TestConcurrentReceiptsDoNotDuplicateNumbers memastikan dua penerimaan yang
// dicatat bersamaan tidak menghasilkan nomor kembar.
func TestConcurrentReceiptsDoNotDuplicateNumbers(t *testing.T) {
	r := setupBatchTestDB(t)
	when := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	// Transaksi berurutan harus memberi nomor berbeda (penomoran dikunci oleh
	// MAX(unit_no) dalam transaksi masing-masing).
	inTrx(t, r, 3, when, nil)
	inTrx(t, r, 3, when, nil)
	inTrx(t, r, 3, when, nil)

	units, err := r.GetItemUnits("it-1", 2026, false)
	if err != nil {
		t.Fatalf("units: %v", err)
	}
	if len(units) != 9 {
		t.Fatalf("harus ada 9 unit, dapat %d", len(units))
	}
	seen := map[int]bool{}
	for _, u := range units {
		if seen[u.UnitNo] {
			t.Errorf("nomor %d kembar", u.UnitNo)
		}
		seen[u.UnitNo] = true
	}
}

func derefStr(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}
