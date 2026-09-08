package repository

import (
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
)

// TestItemRoomIDRoundTrip menjaga agar inventory_items.room_id benar-benar
// ditulis dan dibaca lewat jalur repository, bukan hanya lewat SQL langsung.
//
// Celah yang pernah terjadi: migrasi 000035 menambahkan kolom room_id dan
// ItemRoomID membacanya, tetapi CreateItem/UpdateItem tidak pernah menulis
// kolom itu dan GetItems tidak pernah membacanya. Kolomnya selalu NULL,
// sehingga ItemRoomID selalu jatuh ke pencocokan location dengan nama ruangan
// — persis kerentanan yang ingin dihapus migrasi tersebut. Test yang ada
// men-seed room_id lewat SQL sehingga celah ini tidak terlihat.
func TestItemRoomIDRoundTrip(t *testing.T) {
	db := setupInventorySchemaFromMigrations(t)
	defer db.Close()
	repo := &InventoryRepository{DB: db}

	room := "r-1"
	created, err := repo.CreateItem(models.InventoryItem{
		Name:         "Spidol Papan",
		Category:     "ATK",
		Unit:         "Pcs",
		CurrentStock: 10,
		Location:     &room,
		RoomID:       &room,
	})
	if err != nil {
		t.Fatalf("CreateItem: %v", err)
	}
	if created == nil {
		t.Fatal("CreateItem mengembalikan nil")
	}
	if created.RoomID == nil || *created.RoomID != room {
		t.Fatalf("room_id tidak tersimpan: dapat %v, mau %q", deref(created.RoomID), room)
	}

	// Lewat daftar item (jalur GET).
	items, _, err := repo.GetItems(1, 50, "", "")
	if err != nil {
		t.Fatalf("GetItems: %v", err)
	}
	var found *models.InventoryItem
	for idx := range items {
		if items[idx].ID == created.ID {
			found = &items[idx]
		}
	}
	if found == nil {
		t.Fatal("item tidak muncul di GetItems")
	}
	if found.RoomID == nil || *found.RoomID != room {
		t.Fatalf("GetItems tidak mengembalikan room_id: %v", deref(found.RoomID))
	}

	// Scope PIC harus membaca room_id, bukan menebak dari nama lokasi.
	got, err := ItemRoomID(db, created.ID)
	if err != nil {
		t.Fatalf("ItemRoomID: %v", err)
	}
	if got != room {
		t.Fatalf("ItemRoomID = %q, mau %q", got, room)
	}

	// Pembaruan ke ruangan lain harus benar-benar berpindah.
	other := "r-2"
	updated, err := repo.UpdateItem(created.ID, models.InventoryItem{
		Name:         "Spidol Papan",
		Category:     "ATK",
		Unit:         "Pcs",
		CurrentStock: 10,
		RoomID:       &other,
	})
	if err != nil {
		t.Fatalf("UpdateItem: %v", err)
	}
	if updated == nil || updated.RoomID == nil || *updated.RoomID != other {
		t.Fatalf("room_id tidak terbarukan: %v", derefPtr(updated))
	}
	got2, err := ItemRoomID(db, created.ID)
	if err != nil {
		t.Fatalf("ItemRoomID setelah update: %v", err)
	}
	if got2 != other {
		t.Fatalf("ItemRoomID = %q, mau %q", got2, other)
	}
}

// TestItemRoomIDFallsBackToLocation memastikan data lama (room_id kosong,
// location berisi nama ruangan) tetap terlindungi dan tidak tiba-tiba menjadi
// stok umum hanya karena kolom barunya kosong.
func TestItemRoomIDFallsBackToLocation(t *testing.T) {
	db := setupInventoryScopeTestDB(t)
	defer db.Close()

	// i-2 dibuat dengan location "Gudang" dan room_id NULL: bukan nama
	// ruangan, jadi memang stok umum.
	if _, err := db.Exec(`INSERT INTO inventory_items (id, name, location, room_id) VALUES ('i-3', 'Kapur', 'Kelas 1', NULL)`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	got, err := ItemRoomID(db, "i-3")
	if err != nil {
		t.Fatalf("ItemRoomID: %v", err)
	}
	if got != "r-1" {
		t.Fatalf("fallback location gagal: dapat %q, mau r-1", got)
	}
}

func deref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

func derefPtr(i *models.InventoryItem) string {
	if i == nil {
		return "<item nil>"
	}
	return deref(i.RoomID)
}
