package repository

import (
	"testing"
)

func TestGetStatement_ObjekLengkap(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	// Saldo sekarang 3500.
	seedSavingsFlow(t, db, 3500)

	// Periode: Januari 2026 WIB (2026-01-01 00:00 WIB = 1767200400000 ms).
	periodeStart := int64(1_767_200_400_000)
	// Sebelum periode: setor 1000, tarik 500 -> saldo awal periode 3000.
	if _, err := db.Exec(`INSERT INTO tabungan_transaksi
		(id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at)
		VALUES ('pre_s', 'st1', 'u1', 'setor', 1000, 'verified', NULL, ?, ?)`,
		periodeStart-24*3_600_000, periodeStart-24*3_600_000); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO tabungan_transaksi
		(id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at)
		VALUES ('pre_t', 'st1', 'u1', 'tarik', 500, 'verified', NULL, ?, ?)`,
		periodeStart-12*3_600_000, periodeStart-12*3_600_000); err != nil {
		t.Fatal(err)
	}

	// Dalam periode: setor 1000 (5 Jan), tarik 200 (10 Jan), setor 300 (20 Jan).
	if _, err := db.Exec(`INSERT INTO tabungan_transaksi
		(id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at)
		VALUES ('in_s', 'st1', 'u1', 'setor', 1000, 'verified', 'Setoran', ?, ?)`,
		periodeStart+4*24*3_600_000, periodeStart+4*24*3_600_000); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO tabungan_transaksi
		(id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at)
		VALUES ('in_t', 'st1', 'u1', 'tarik', 200, 'verified', 'Tarikan', ?, ?)`,
		periodeStart+9*24*3_600_000, periodeStart+9*24*3_600_000); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO tabungan_transaksi
		(id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at)
		VALUES ('in_s2', 'st1', 'u1', 'setor', 300, 'verified', NULL, ?, ?)`,
		periodeStart+19*24*3_600_000, periodeStart+19*24*3_600_000); err != nil {
		t.Fatal(err)
	}

	st, err := repo.GetStatement("st1", "2026-01-01", "2026-01-31")
	if err != nil {
		t.Fatalf("GetStatement error: %v", err)
	}
	if st == nil {
		t.Fatal("statement tidak boleh nil")
	}

	// Siswa.
	if st.Student.Nama != "Siswa A" || st.Student.NISN != "12345678" {
		t.Fatalf("identitas siswa salah: %+v", st.Student)
	}
	if st.Student.Kelas != "Kelas 1" {
		t.Fatalf("kelas siswa salah: %q", st.Student.Kelas)
	}

	// Periode tercatat.
	if st.Period.Start != "2026-01-01" || st.Period.End != "2026-01-31" {
		t.Fatalf("periode tidak tercatat: %+v", st.Period)
	}

	// Saldo awal: berjalan mundur dari saldo kini 3500 dikurangi net
	// mutasi dalam periode (+1100) dan setelah periode (0) = 2400.
	if st.OpeningBalance != 2400 {
		t.Fatalf("saldo awal seharusnya 2400, dapat %d", st.OpeningBalance)
	}

	// Mutasi dalam periode: 3 baris, saldo berjalan.
	if len(st.Mutations) != 3 {
		t.Fatalf("seharusnya 3 mutasi dalam periode, dapat %d", len(st.Mutations))
	}
	// Urutan kronologis: setor 1000 -> 3400, tarik 200 -> 3200, setor 300 -> 3500.
	if st.Mutations[0].Balance != 3400 {
		t.Fatalf("saldo berjalan baris 1 seharusnya 3400, dapat %d", st.Mutations[0].Balance)
	}
	if st.Mutations[1].Balance != 3200 {
		t.Fatalf("saldo berjalan baris 2 seharusnya 3200, dapat %d", st.Mutations[1].Balance)
	}
	if st.Mutations[2].Balance != 3500 {
		t.Fatalf("saldo berjalan baris 3 seharusnya 3500, dapat %d", st.Mutations[2].Balance)
	}

	// Debit = keluar (tarik), kredit = masuk (setor).
	if st.Summary.TotalDebit != 200 {
		t.Fatalf("total debit seharusnya 200, dapat %d", st.Summary.TotalDebit)
	}
	if st.Summary.TotalCredit != 1300 {
		t.Fatalf("total kredit seharusnya 1300, dapat %d", st.Summary.TotalCredit)
	}
	if st.Summary.ClosingBalance != 3500 {
		t.Fatalf("saldo akhir seharusnya 2400+1300-200=3500, dapat %d", st.Summary.ClosingBalance)
	}

	// Hash tersimpan dan bisa ditarik ulang.
	if st.VerificationHash == "" {
		t.Fatal("verificationHash tidak boleh kosong")
	}
	ver, err := repo.VerifyStatement(st.VerificationHash)
	if err != nil || ver == nil {
		t.Fatalf("pernyataan tersimpan tidak bisa diverifikasi: %v", err)
	}
	if !ver.Valid || ver.Student.Nama != "Siswa A" || ver.Summary.ClosingBalance != 3500 {
		t.Fatalf("payload verifikasi salah: %+v", ver)
	}
}

func TestGetStatement_Kosong(t *testing.T) {
	db := setupSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsRepository(db)
	seedSavingsFlow(t, db, 2000)

	st, err := repo.GetStatement("st1", "2026-01-01", "2026-01-31")
	if err != nil {
		t.Fatalf("GetStatement error: %v", err)
	}
	if st == nil {
		t.Fatal("statement tidak boleh nil meski kosong")
	}
	if len(st.Mutations) != 0 {
		t.Fatalf("seharusnya 0 mutasi, dapat %d", len(st.Mutations))
	}
	if st.OpeningBalance != 2000 || st.Summary.ClosingBalance != 2000 {
		t.Fatalf("saldo awal/akhir seharusnya 2000/2000, dapat %d/%d", st.OpeningBalance, st.Summary.ClosingBalance)
	}
}
