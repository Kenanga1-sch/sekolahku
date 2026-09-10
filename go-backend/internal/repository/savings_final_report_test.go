package repository

import (
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
)

func TestGetFinalReport_YearMemisahkanData(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 0)

	// Batas tahun WIB: 2026-01-01 00:00 WIB = 2025-12-31 17:00 UTC.
	y2026 := int64(1_768_447_200_000) // 2026-01-01T00:00:00+07:00
	y2025 := y2026 - 365*24*3_600_000

	// 2025: setor 3x1000
	for i := 0; i < 3; i++ {
		if _, err := db.Exec(`INSERT INTO tabungan_transaksi
			(id, siswa_id, user_id, tipe, nominal, status, created_at, updated_at)
			VALUES (?, 'st1', 'u1', 'setor', 1000, 'verified', ?, ?)`,
			"fy25_"+string(rune('a'+i)), y2025+int64(i)*3_600_000, y2025+int64(i)*3_600_000); err != nil {
			t.Fatal(err)
		}
	}
	// 2026: setor 2x1000, tarik 500
	for i := 0; i < 2; i++ {
		if _, err := db.Exec(`INSERT INTO tabungan_transaksi
			(id, siswa_id, user_id, tipe, nominal, status, created_at, updated_at)
			VALUES (?, 'st1', 'u1', 'setor', 1000, 'verified', ?, ?)`,
			"fy26_s"+string(rune('a'+i)), y2026+int64(i)*3_600_000, y2026+int64(i)*3_600_000); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(`INSERT INTO tabungan_transaksi
		(id, siswa_id, user_id, tipe, nominal, status, created_at, updated_at)
		VALUES ('fy26_t', 'st1', 'u1', 'tarik', 500, 'verified', ?, ?)`,
		y2026+3*3_600_000, y2026+3*3_600_000); err != nil {
		t.Fatal(err)
	}

	// Laporan 2026: hanya transaksi tahun itu.
	rep, err := repo.GetFinalReport("st1", "2026")
	if err != nil {
		t.Fatalf("GetFinalReport error: %v", err)
	}
	if rep == nil {
		t.Fatal("report tidak boleh nil")
	}
	if rep.TotalSetor != 2000 {
		t.Fatalf("2026: totalSetor seharusnya 2000 (bukan seluruh riwayat), dapat %d — parameter year tidak memfilter", rep.TotalSetor)
	}
	if rep.TotalTarik != 500 {
		t.Fatalf("2026: totalTarik seharusnya 500, dapat %d", rep.TotalTarik)
	}
	if len(rep.Transactions) != 3 {
		t.Fatalf("2026: seharusnya 3 transaksi tahun 2026, dapat %d", len(rep.Transactions))
	}

	// Laporan 2025: hanya 3 setoran tahun itu.
	rep25, err := repo.GetFinalReport("st1", "2025")
	if err != nil {
		t.Fatalf("GetFinalReport error: %v", err)
	}
	if rep25.TotalSetor != 3000 || rep25.TotalTarik != 0 {
		t.Fatalf("2025: seharusnya setor 3000 / tarik 0, dapat %d/%d", rep25.TotalSetor, rep25.TotalTarik)
	}
	if len(rep25.Transactions) != 3 {
		t.Fatalf("2025: seharusnya 3 transaksi, dapat %d", len(rep25.Transactions))
	}
}

func TestGetFinalReport_MonthlySummaryWIB(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 0)

	// Januari dan Februari 2026 WIB.
	jan := int64(1_768_447_200_000)      // 2026-01-01 00:00 WIB
	feb := jan + 31*24*3_600_000         // 2026-02-01 00:00 WIB

	if _, err := db.Exec(`INSERT INTO tabungan_transaksi
		(id, siswa_id, user_id, tipe, nominal, status, created_at, updated_at)
		VALUES ('m1', 'st1', 'u1', 'setor', 1000, 'verified', ?, ?)`, jan, jan); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO tabungan_transaksi
		(id, siswa_id, user_id, tipe, nominal, status, created_at, updated_at)
		VALUES ('m2', 'st1', 'u1', 'setor', 2000, 'verified', ?, ?)`, jan+3_600_000, jan+3_600_000); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO tabungan_transaksi
		(id, siswa_id, user_id, tipe, nominal, status, created_at, updated_at)
		VALUES ('m3', 'st1', 'u1', 'tarik', 500, 'verified', ?, ?)`, feb, feb); err != nil {
		t.Fatal(err)
	}

	rep, err := repo.GetFinalReport("st1", "2026")
	if err != nil {
		t.Fatalf("GetFinalReport error: %v", err)
	}
	if len(rep.MonthlySummary) != 2 {
		t.Fatalf("monthlySummary seharusnya 2 bulan (01, 02), dapat %d: %v", len(rep.MonthlySummary), rep.MonthlySummary)
	}
	janSum, ok := rep.MonthlySummary["01"]
	if !ok {
		t.Fatal("monthlySummary['01'] tidak ada")
	}
	if janSum.Setor != 3000 || janSum.Tarik != 0 || janSum.Saldo != 3000 {
		t.Fatalf("januari: setor/tarik/saldo seharusnya 3000/0/3000, dapat %d/%d/%d", janSum.Setor, janSum.Tarik, janSum.Saldo)
	}
	febSum, ok := rep.MonthlySummary["02"]
	if !ok {
		t.Fatal("monthlySummary['02'] tidak ada")
	}
	if febSum.Setor != 0 || febSum.Tarik != 500 || febSum.Saldo != 2500 {
		t.Fatalf("februari: setor/tarik/saldo seharusnya 0/500/2500, dapat %d/%d/%d", febSum.Setor, febSum.Tarik, febSum.Saldo)
	}
}

func TestGetFinalReport_SettlementKurangiHutang(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 2500)

	// Hutang aktif: 2 × Rp1.000 = 2.000, terbayar 500 -> sisa 1.500.
	if _, err := db.Exec(`INSERT INTO tabungan_hutang
		(id, siswa_id, nama_barang, kategori, nominal, jumlah, terbayar, dicatat_oleh, status, created_at, updated_at)
		VALUES ('h1', 'st1', 'Buku', 'ATK', 1000, 2, 500, 'u1', 'aktif', 1, 1)`); err != nil {
		t.Fatal(err)
	}

	rep, err := repo.GetFinalReport("st1", "2026")
	if err != nil {
		t.Fatalf("GetFinalReport error: %v", err)
	}
	if rep.Hutang.TotalHutangAktif != 1500 {
		t.Fatalf("hutang aktif seharusnya 1500 (2000-500), dapat %d", rep.Hutang.TotalHutangAktif)
	}
	if len(rep.Hutang.Rincian) != 1 {
		t.Fatalf("rincian hutang seharusnya 1 baris, dapat %d", len(rep.Hutang.Rincian))
	}
	if rep.Settlement.NetBalance != 1000 {
		t.Fatalf("netBalance seharusnya saldo 2500 - hutang 1500 = 1000, dapat %d", rep.Settlement.NetBalance)
	}
	// Sisa Rp1.000 masih diterima siswa -> SIAP_CAIR, bukan KURANG_BAYAR.
	if rep.Settlement.Status != models.SettlementSiapCair {
		t.Fatalf("status seharusnya SIAP_CAIR (net 1000 >= 0), dapat %s", rep.Settlement.Status)
	}
}

func TestGetFinalReport_SettlementKurangBayar(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	// Saldo 500, hutang sisa 1500 -> net -1000 = KURANG_BAYAR.
	seedSavingsFlow(t, db, 500)
	if _, err := db.Exec(`INSERT INTO tabungan_hutang
		(id, siswa_id, nama_barang, kategori, nominal, jumlah, terbayar, dicatat_oleh, status, created_at, updated_at)
		VALUES ('h1', 'st1', 'Buku', 'ATK', 1000, 2, 500, 'u1', 'aktif', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	rep, err := repo.GetFinalReport("st1", "2026")
	if err != nil {
		t.Fatalf("GetFinalReport error: %v", err)
	}
	if rep.Settlement.NetBalance != -1000 {
		t.Fatalf("netBalance seharusnya 500 - 1500 = -1000, dapat %d", rep.Settlement.NetBalance)
	}
	if rep.Settlement.Status != models.SettlementKurangBayar {
		t.Fatalf("status seharusnya KURANG_BAYAR, dapat %s", rep.Settlement.Status)
	}
}
