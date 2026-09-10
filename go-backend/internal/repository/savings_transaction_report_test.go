package repository

import (
	"fmt"
	"testing"
)

func TestGetTransactions_MelampauiBatas(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 0)

	// 150 transaksi — melebihi batas limit yang dipotong GetTransactions (100).
	base := int64(1_700_000_000_000)
	for i := 0; i < 150; i++ {
		if _, err := db.Exec(`INSERT INTO tabungan_transaksi
			(id, siswa_id, user_id, tipe, nominal, status, created_at, updated_at)
			VALUES (?, 'st1', 'u1', 'setor', 1000, 'verified', ?, ?)`,
			fmt.Sprintf("trx%03d", i), base+int64(i)*3_600_000, base+int64(i)*3_600_000); err != nil {
			t.Fatalf("seed gagal: %v", err)
		}
	}

	// Panggilan persis seperti halaman laporan: fetchAll, semua transaksi diharapkan.
	// Dulu halaman mengirim perPage=10000 dan repo memotong ke 100 diam-diam.
	items, total, err := repo.GetTransactions("", "", "", "", "", 0, 0, 10000, true)
	if err != nil {
		t.Fatalf("GetTransactions error: %v", err)
	}
	if total != 150 {
		t.Fatalf("total seharusnya 150, dapat %d — total tidak boleh bohong bila data dipotong", total)
	}
	if len(items) != 150 {
		t.Fatalf("seharusnya semua 150 baris diambil bila limit=10000 diminta lewat jalur laporan, dapat %d", len(items))
	}
}

func TestGetTransactions_BatasNormal(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 0)

	base := int64(1_700_000_000_000)
	for i := 0; i < 150; i++ {
		if _, err := db.Exec(`INSERT INTO tabungan_transaksi
			(id, siswa_id, user_id, tipe, nominal, status, created_at, updated_at)
			VALUES (?, 'st1', 'u1', 'setor', 1000, 'verified', ?, ?)`,
			fmt.Sprintf("tx%03d", i), base+int64(i)*3_600_000, base+int64(i)*3_600_000); err != nil {
			t.Fatalf("seed gagal: %v", err)
		}
	}

	// Panggilan riwayat biasa: limit 20. Total tetap harus dilaporkan sejati.
	items, total, err := repo.GetTransactions("", "", "", "", "", 0, 0, 20, false)
	if err != nil {
		t.Fatalf("GetTransactions error: %v", err)
	}
	if len(items) != 20 {
		t.Fatalf("limit 20 seharusnya mengembalikan 20 baris, dapat %d", len(items))
	}
	if total != 150 {
		t.Fatalf("total tetap 150 walaupun hanya 20 baris yang diminta, dapat %d", total)
	}
}
