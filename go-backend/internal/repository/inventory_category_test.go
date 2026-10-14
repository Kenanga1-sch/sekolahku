package repository

import (
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
)

// strPtr dan intPtr sudah didefinisikan di file test lain dalam paket ini
// (eoffice_repo_test.go / alumni_repo.go), jadi tidak didefinisikan ulang.

// TestCategoryCRUDRoundTrip memastikan kategori terkelola (migrasi 000085)
// bisa dibuat, dibaca, diubah, dan dihapus lewat repository.
func TestCategoryCRUDRoundTrip(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	repo := &InventoryRepository{DB: db}

	created, err := repo.CreateCategory(models.InventoryCategory{
		Name:       "Alat Olahraga",
		CodePrefix: strPtr("or"), // sengaja huruf kecil: harus dinormalkan jadi kapital
		Kind:       "ASSET",
		SortOrder:  15,
	})
	if err != nil {
		t.Fatalf("CreateCategory: %v", err)
	}
	if created.CodePrefix == nil || *created.CodePrefix != "OR" {
		t.Fatalf("code_prefix harus dinormalkan jadi OR, dapat %v", created.CodePrefix)
	}

	// Muncul di daftar kind ASSET.
	list, err := repo.ListCategories("ASSET")
	if err != nil {
		t.Fatalf("ListCategories: %v", err)
	}
	found := false
	for _, c := range list {
		if c.ID == created.ID {
			found = true
		}
	}
	if !found {
		t.Fatal("kategori baru tidak muncul di ListCategories(ASSET)")
	}

	// Duplikat nama (beda kapitalisasi) harus ditolak.
	if _, err := repo.CreateCategory(models.InventoryCategory{
		Name: "ALAT OLAHRAGA", Kind: "ASSET",
	}); err == nil {
		t.Fatal("duplikat nama kategori seharusnya ditolak")
	}

	// Update.
	updated, err := repo.UpdateCategory(created.ID, models.InventoryCategory{
		Name: "Peralatan Olahraga", CodePrefix: strPtr("PO"), Kind: "ASSET", SortOrder: 16,
	})
	if err != nil {
		t.Fatalf("UpdateCategory: %v", err)
	}
	if updated.Name != "Peralatan Olahraga" || updated.CodePrefix == nil || *updated.CodePrefix != "PO" {
		t.Fatalf("update kategori gagal: %+v", updated)
	}

	// Delete (soft) lalu tidak muncul lagi.
	if err := repo.DeleteCategory(created.ID); err != nil {
		t.Fatalf("DeleteCategory: %v", err)
	}
	list2, _ := repo.ListCategories("ASSET")
	for _, c := range list2 {
		if c.ID == created.ID {
			t.Fatal("kategori terhapus masih muncul di daftar")
		}
	}
	// Delete id yang tak ada -> ErrInventoryNotFound.
	if err := repo.DeleteCategory(created.ID); err != ErrInventoryNotFound {
		t.Fatalf("delete kedua harus ErrInventoryNotFound, dapat %v", err)
	}
}

// TestSeedCategoriesPresent memastikan seed migrasi 000085 ada, sehingga UI
// langsung berfungsi tanpa admin harus mengetik kategori.
func TestSeedCategoriesPresent(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	repo := &InventoryRepository{DB: db}

	assetCats, err := repo.ListCategories("ASSET")
	if err != nil {
		t.Fatalf("ListCategories ASSET: %v", err)
	}
	if len(assetCats) == 0 {
		t.Fatal("seed kategori aset kosong")
	}
	itemCats, err := repo.ListCategories("ITEM")
	if err != nil {
		t.Fatalf("ListCategories ITEM: %v", err)
	}
	if len(itemCats) == 0 {
		t.Fatal("seed kategori barang kosong")
	}

	// Buku harus punya prefix BK (contoh permintaan: INV/BK-2026-01).
	prefix, ok := repo.GetCategoryPrefixByName("Buku", "ASSET")
	if !ok || prefix != "BK" {
		t.Fatalf("prefix Buku harus BK, dapat %q ok=%v", prefix, ok)
	}
}

// TestAutoCodeAssetPerCategory memastikan kode aset di-generate otomatis dengan
// format INV/{PREFIX}-{TAHUN}-{URUT} dan urutannya per kategori (reset tahun).
func TestAutoCodeAssetPerCategory(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	repo := &InventoryRepository{DB: db}

	// Buku (prefix BK), tahun anggaran 2026.
	room := "r-1"
	mk := func(cat string, year int) *models.InventoryAsset {
		id, err := repo.CreateAsset(models.InventoryAsset{
			Name: "Aset " + cat, Category: cat, FiscalYear: intPtr(year),
			Quantity: 1, ConditionGood: 1, RoomID: &room,
		})
		if err != nil {
			t.Fatalf("CreateAsset(%s): %v", cat, err)
		}
		a, err := repo.GetAssetByID(id)
		if err != nil {
			t.Fatalf("GetAssetByID: %v", err)
		}
		return a
	}

	a1 := mk("Buku", 2026)
	if a1.Code == nil || *a1.Code != "INV/BK-26-01" {
		t.Fatalf("kode buku pertama = %v, mau INV/BK-26-01", deref(a1.Code))
	}
	a2 := mk("Buku", 2026)
	if a2.Code == nil || *a2.Code != "INV/BK-26-02" {
		t.Fatalf("kode buku kedua = %v, mau INV/BK-26-02", deref(a2.Code))
	}
	// Kategori lain punya urutan sendiri (mulai dari 01).
	e1 := mk("Elektronik", 2026)
	if e1.Code == nil || *e1.Code != "INV/EL-26-01" {
		t.Fatalf("kode elektronik = %v, mau INV/EL-26-01", deref(e1.Code))
	}
	// Tahun berbeda me-reset urutan.
	b27 := mk("Buku", 2027)
	if b27.Code == nil || *b27.Code != "INV/BK-27-01" {
		t.Fatalf("kode buku 2027 = %v, mau INV/BK-27-01", deref(b27.Code))
	}
}

// TestAutoCodeRespectsManualCode memastikan kode manual yang dikirim pemanggil
// TIDAK ditimpa oleh generator.
func TestAutoCodeRespectsManualCode(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	repo := &InventoryRepository{DB: db}

	room := "r-1"
	id, err := repo.CreateAsset(models.InventoryAsset{
		Name: "Aset Manual", Category: "Buku", Code: strPtr("INV/MANUAL-1"),
		Quantity: 1, ConditionGood: 1, RoomID: &room,
	})
	if err != nil {
		t.Fatalf("CreateAsset: %v", err)
	}
	a, _ := repo.GetAssetByID(id)
	if a.Code == nil || *a.Code != "INV/MANUAL-1" {
		t.Fatalf("kode manual tertimpa: %v", deref(a.Code))
	}
}

// TestAutoCodeItem memastikan penomoran otomatis juga berlaku untuk barang
// habis pakai, dengan prefix kategori ITEM (mis. ATK).
func TestAutoCodeItem(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	repo := &InventoryRepository{DB: db}

	it, err := repo.CreateItem(models.InventoryItem{
		Name: "Spidol", Category: "Alat Tulis Kantor", Unit: "Pcs",
		CurrentStock: 5, FiscalYear: intPtr(2026),
	})
	if err != nil {
		t.Fatalf("CreateItem: %v", err)
	}
	if it.Code == nil || *it.Code != "INV/ATK-26-01" {
		t.Fatalf("kode item = %v, mau INV/ATK-26-01", deref(it.Code))
	}
}

// TestPreviewNextCode memastikan preview kode berikutnya konsisten dengan yang
// akan ditetapkan saat simpan (dengan catatan nomor final bisa berbeda bila
// ada penyimpanan bersamaan).
func TestPreviewNextCode(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	repo := &InventoryRepository{DB: db}

	code, err := repo.PreviewNextCode("ASSET", "Buku", 2026)
	if err != nil {
		t.Fatalf("PreviewNextCode: %v", err)
	}
	if code != "INV/BK-26-01" {
		t.Fatalf("preview = %q, mau INV/BK-26-01", code)
	}
}

// TestAssetAcquisitionFieldsRoundTrip memastikan kolom data perolehan baru
// benar-benar ditulis dan dibaca lewat repository.
func TestAssetAcquisitionFieldsRoundTrip(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	repo := &InventoryRepository{DB: db}

	room := "r-1"
	id, err := repo.CreateAsset(models.InventoryAsset{
		Name: "Laptop", Category: "Elektronik", Code: strPtr("INV/EL-26-99"),
		Quantity: 1, ConditionGood: 1, RoomID: &room,
		Supplier: strPtr("Toko Komputer Jaya"), InvoiceNo: strPtr("INV-2026-777"),
		SerialNumber: strPtr("SN-ABC-123"), Brand: strPtr("Asus"), Model: strPtr("X441"),
		AcquisitionType: strPtr("Pembelian"),
	})
	if err != nil {
		t.Fatalf("CreateAsset: %v", err)
	}
	a, err := repo.GetAssetByID(id)
	if err != nil {
		t.Fatalf("GetAssetByID: %v", err)
	}
	if deref(a.Supplier) != "Toko Komputer Jaya" || deref(a.InvoiceNo) != "INV-2026-777" ||
		deref(a.SerialNumber) != "SN-ABC-123" || deref(a.Brand) != "Asus" ||
		deref(a.Model) != "X441" || deref(a.AcquisitionType) != "Pembelian" {
		t.Fatalf("data perolehan tidak round-trip: %+v", a)
	}

	// Update harus benar-benar mengubah.
	a.Supplier = strPtr("CV Sumber Rejeki")
	a.AcquisitionType = strPtr("Hibah")
	if err := repo.UpdateAsset(id, *a); err != nil {
		t.Fatalf("UpdateAsset: %v", err)
	}
	got, _ := repo.GetAssetByID(id)
	if deref(got.Supplier) != "CV Sumber Rejeki" || deref(got.AcquisitionType) != "Hibah" {
		t.Fatalf("update data perolehan gagal: %+v", got)
	}
}

// TestTransactionSupplierRoundTrip memastikan penyedia & nomor nota pada
// mutasi barang masuk tersimpan dan terbaca.
func TestTransactionSupplierRoundTrip(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	repo := &InventoryRepository{DB: db}

	it, err := repo.CreateItem(models.InventoryItem{
		Name: "Pulpen", Category: "Alat Tulis Kantor", Unit: "Box", CurrentStock: 0,
	})
	if err != nil {
		t.Fatalf("CreateItem: %v", err)
	}
	err = repo.CreateTransaction(models.InventoryTransaction{
		ItemID: it.ID, Type: "IN", Quantity: 3,
		Supplier: strPtr("Toko ATK Barokah"), InvoiceNo: strPtr("N-2026-05"),
	})
	if err != nil {
		t.Fatalf("CreateTransaction: %v", err)
	}
	trx, err := repo.GetTransactions(10, it.ID, "")
	if err != nil {
		t.Fatalf("GetTransactions: %v", err)
	}
	if len(trx) != 1 {
		t.Fatalf("mau 1 transaksi, dapat %d", len(trx))
	}
	if deref(trx[0].Supplier) != "Toko ATK Barokah" || deref(trx[0].InvoiceNo) != "N-2026-05" {
		t.Fatalf("supplier/nota tidak round-trip: %+v", trx[0])
	}
}
