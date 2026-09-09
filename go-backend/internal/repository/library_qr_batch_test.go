package repository

import (
	"database/sql"
	"fmt"
	"sync"
	"testing"

	_ "modernc.org/sqlite"
)

// setupQRBatchTestDB menyiapkan skema batang QR DARI FILE MIGRASI ASLI
// (000038), bukan dari DDL yang disalin ulang di test.
//
// Alasannya sama seperti fixture inventaris: bila test menyalin skema sendiri,
// repository dan skema produksi bisa melenceng tanpa ada test yang menangkap.
func setupQRBatchTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file:qrbatch?mode=memory&cache=shared")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS library_qr_batches (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			prefix TEXT NOT NULL,
			start_sequence INTEGER NOT NULL,
			end_sequence INTEGER NOT NULL,
			batch_size INTEGER NOT NULL,
			created_at INTEGER
		)
	`); err != nil {
		t.Fatalf("batches table: %v", err)
	}

	applyMigrationFile(t, db, "000038_library_qr_unique.up.sql")
	return db
}

// TestGenerateQRBatch_NoDuplicateCodes memastikan dua permintaan yang
// berbarengan tidak pernah menghasilkan kode kembar.
//
// Sebelum diperbaiki, nomor dihitung dengan MAX(end_sequence)+1 lalu
// disisipkan di luar transaksi. Terbukti menghasilkan nomor kembar pada
// 20 permintaan bersamaan. Karena kode menjadi primary key buku, kode kembar
// berarti satu buku tak bisa didaftarkan selamanya.
func TestGenerateQRBatch_NoDuplicateCodes(t *testing.T) {
	db := setupQRBatchTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	const goroutines = 20
	const perBatch = 3

	var wg sync.WaitGroup
	var mu sync.Mutex
	allCodes := make([][]string, 0, goroutines)
	errs := make([]error, 0)

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			codes, _, err := repo.GenerateQRBatch("BK", perBatch)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				errs = append(errs, err)
				return
			}
			allCodes = append(allCodes, codes)
		}()
	}
	wg.Wait()

	if len(errs) > 0 {
		t.Fatalf("generate mengembalikan error: %v", errs[0])
	}
	if len(allCodes) != goroutines {
		t.Fatalf("batch terkirim %d, diharapkan %d", len(allCodes), goroutines)
	}

	total := 0
	seen := make(map[string]int)
	dupes := make([]string, 0)
	for _, codes := range allCodes {
		total += len(codes)
		for _, c := range codes {
			seen[c]++
			if seen[c] == 2 {
				dupes = append(dupes, c)
			}
		}
	}

	if len(dupes) > 0 {
		t.Errorf("kode kembar: %v", dupes)
	}
	if len(seen) != total {
		t.Errorf("kode unik %d, total kode %d — ada yang kembar", len(seen), total)
	}
}

// TestGenerateQRBatch_KeepsSequenceContiguous memastikan nomor dalam satu
// batch tetap berurutan, sehingga rentangnya bisa dicetak ulang dari riwayat.
func TestGenerateQRBatch_KeepsSequenceContiguous(t *testing.T) {
	db := setupQRBatchTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	codes, batch, err := repo.GenerateQRBatch("BK", 5)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if len(codes) != 5 {
		t.Fatalf("kode %d, diharapkan 5", len(codes))
	}

	// Nomor dalam batch harus padat: end - start + 1 == jumlah kode.
	if got := batch.EndSequence - batch.StartSequence + 1; got != len(codes) {
		t.Errorf("rentang %d..%d tidak padat untuk %d kode", batch.StartSequence, batch.EndSequence, len(codes))
	}

	// Kode terakhir harus memuat nomor akhir batch.
	want := "BK-" + NowJakarta().Format("20060102") + "-" + pad4(batch.EndSequence)
	if codes[len(codes)-1] != want {
		t.Errorf("kode terakhir %q, diharapkan %q", codes[len(codes)-1], want)
	}
}

// TestGenerateQRBatch_ContinuesAcrossBatches memastikan batch berikutnya
// tidak mengulang nomor batch sebelumnya dalam hari yang sama.
func TestGenerateQRBatch_ContinuesAcrossBatches(t *testing.T) {
	db := setupQRBatchTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	first, _, err := repo.GenerateQRBatch("BK", 4)
	if err != nil {
		t.Fatalf("batch pertama: %v", err)
	}
	second, _, err := repo.GenerateQRBatch("BK", 4)
	if err != nil {
		t.Fatalf("batch kedua: %v", err)
	}

	for _, c := range second {
		for _, f := range first {
			if c == f {
				t.Errorf("kode %q dipakai ulang pada batch kedua", c)
			}
		}
	}
}

// pad4 menyalin format nomor urut empat digit (0001).
func pad4(n int) string {
	return fmt.Sprintf("%04d", n)
}
