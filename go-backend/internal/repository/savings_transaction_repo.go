package repository

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// CreateTransaksi creates a new savings transaction (deposit/withdrawal)
func (r *SavingsRepository) CreateTransaksi(req models.CreateTransaksiRequest) error {
	if req.Tipe == "" {
		req.Tipe = req.Type
	}
	req.Tipe = strings.ToLower(strings.TrimSpace(req.Tipe))
	req.SiswaID = strings.TrimSpace(req.SiswaID)
	req.UserID = strings.TrimSpace(req.UserID)
	if req.SiswaID == "" || req.UserID == "" {
		return errors.New("Siswa dan petugas wajib diisi")
	}
	if req.Tipe != "setor" && req.Tipe != "tarik" {
		return errors.New("Tipe transaksi tidak valid")
	}
	if req.Nominal < 1000 {
		return errors.New("Nominal minimal Rp 1.000")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Resolve siswa_id: accepts students.id, nisn, nis, or qr_code
	var realStudentID string
	err = tx.QueryRow(`SELECT id FROM students WHERE id = ? OR nisn = ? OR nis = ? OR qr_code = ? LIMIT 1`,
		req.SiswaID, req.SiswaID, req.SiswaID, req.SiswaID).Scan(&realStudentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("Siswa tidak ditemukan")
		}
		return err
	}

	// Ensure extension row exists (single source: students is the authority)
	if _, err := tx.Exec(`INSERT INTO tabungan_siswa (id, student_id, saldo_terakhir, created_at, updated_at)
		SELECT 'sav_' || ?, ?, 0, ?, ? WHERE NOT EXISTS (SELECT 1 FROM tabungan_siswa WHERE student_id = ?)`,
		realStudentID, realStudentID, UnixMilli(), UnixMilli(), realStudentID); err != nil {
		return err
	}

	var saldo int
	err = tx.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE student_id = ?", realStudentID).Scan(&saldo)
	if err != nil {
		return errors.New("Siswa tidak ditemukan")
	}

	var pendingNet int
	err = tx.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN tipe = 'setor' THEN nominal ELSE -nominal END), 0)
		FROM tabungan_transaksi
		WHERE siswa_id = ? AND status = 'collected'
	`, realStudentID).Scan(&pendingNet)
	if err != nil {
		return err
	}

	if req.Tipe == "tarik" && saldo+pendingNet < req.Nominal {
		return errors.New("Saldo tidak cukup")
	}

	id := cuid2.Generate()
	now := UnixMilli()
	_, err = tx.Exec(`
		INSERT INTO tabungan_transaksi (id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, realStudentID, req.UserID, req.Tipe, req.Nominal, "collected", req.Catatan, now, now)
	if err != nil {
		return err
	}
	return tx.Commit()
}

// GetTransactions retrieves transactions with optional filters.
//
// totalItems adalah jumlah baris yang cocok dengan filter SEBELUM dipotong LIMIT,
// sehingga pemanggil bisa tahu bila hasilnya hanya sebagian. Dulu fungsi ini hanya
// mengembalikan array mentah: halaman laporan meminta perPage=10000 tapi limit
// dipotong ke 100, dan totalItems yang dikirim handler hanyalah len(list) —
// laporan pun menulis angka yang tampak lengkap padahal tidak.
//
// fetchAll=true menaikkan batas ke savingsReportMaxRows untuk jalur laporan
// (halaman butuh seluruh baris dalam periode untuk menjumlahkan).
func (r *SavingsRepository) GetTransactions(siswaId, status, guruId, search, tipe string, startDate, endDate int64, limit int, fetchAll bool) ([]models.TabunganTransaksi, int, error) {
	// Batas atas untuk jalur laporan. Dituliskan eksplisit supaya permintaan
	// "ambil semua" tidak bisa dipakai untuk menguras memori.
	const savingsReportMaxRows = 5000
	const savingsPageLimit = 100

	if fetchAll {
		limit = savingsReportMaxRows
	} else if limit < 1 || limit > savingsPageLimit {
		limit = savingsPageLimit
	}

	where := `
		FROM tabungan_transaksi t
		JOIN students st ON t.siswa_id = st.id
		LEFT JOIN users u ON t.user_id = u.id
		WHERE 1=1
	`
	var args []interface{}
	if siswaId != "" {
		where += " AND t.siswa_id = ?"
		args = append(args, siswaId)
	}
	if status != "" {
		where += " AND t.status = ?"
		args = append(args, status)
	}
	if guruId != "" {
		where += " AND t.user_id = ?"
		args = append(args, guruId)
	}
	if search != "" {
		where += " AND (st.full_name LIKE ? OR st.nisn LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}
	if tipe != "" {
		where += " AND t.tipe = ?"
		args = append(args, tipe)
	}
	if startDate > 0 {
		where += " AND t.created_at >= ?"
		args = append(args, startDate)
	}
	if endDate > 0 {
		where += " AND t.created_at <= ?"
		args = append(args, endDate)
	}

	// Total dihitung dengan WHERE yang sama persis supaya total dan isi
	// tidak pernah melenceng.
	var total int
	if err := r.DB.QueryRow("SELECT COUNT(*)"+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT t.id, t.siswa_id, t.user_id, t.setoran_id, t.tipe, t.nominal, t.status, t.catatan, t.created_at,
		       st.full_name as s_nama, st.class_name as k_nama, u.name as u_name
	` + where + `
		ORDER BY t.created_at DESC LIMIT ?
	`
	rows, err := r.DB.Query(query, append(args, limit)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.TabunganTransaksi
	for rows.Next() {
		var t models.TabunganTransaksi
		var sId, uId, setId, cat sql.NullString
		var crAt sql.NullInt64
		var sName, kName, uName sql.NullString
		err := rows.Scan(&t.ID, &sId, &uId, &setId, &t.Tipe, &t.Nominal, &t.Status, &cat, &crAt, &sName, &kName, &uName)
		if err != nil {
			return nil, 0, err
		}
		if sId.Valid { t.SiswaID = sId.String }
		if uId.Valid { t.UserID = uId.String }
		if setId.Valid { t.SetoranID = &setId.String }
		if cat.Valid { t.Catatan = &cat.String }
		cTime := ToTime(crAt)
		t.CreatedAt = &cTime
		t.Siswa = &models.TabunganSiswa{Nama: sName.String}
		if kName.Valid { t.Siswa.Kelas = &models.TabunganKelas{Nama: kName.String} }
		if uName.Valid { t.User = &models.User{Name: Ptr(uName.String)} }
		results = append(results, t)
	}
	if results == nil {
		results = []models.TabunganTransaksi{}
	}
	return results, total, nil
}

// GetStatement menyusun rekening koran lengkap satu siswa dalam rentang tanggal.
//
// Dulu fungsi ini hanya mengembalikan array datar transaksi (tanpa saldo
// berjalan, tanpa identitas, tanpa periode, tanpa hash) dan mengabaikan
// tanggal — sedangkan halaman membaca objek penuh, sehingga laporan koran
// yang dijanjikan tidak pernah bisa dirender.
//
// Saldo berjalan dihitung dari saldo sekarang (tabungan_siswa.saldo_terakhir
// adalah satu-satunya sumber kebenaran) dikurangi seluruh mutasi 'verified'
// SETELAH periode; lalu maju kronologis lewat mutasi dalam periode.
func (r *SavingsRepository) GetStatement(siswaID, startDate, endDate string) (*models.Statement, error) {
	// Identitas siswa + saldo kini.
	var studentID, nama, nisn, kelas string
	var saldo int
	err := r.DB.QueryRow(`
		SELECT st.id, st.full_name, COALESCE(st.nisn, ''), COALESCE(st.class_name, ''), ts.saldo_terakhir
		FROM tabungan_siswa ts
		JOIN students st ON ts.student_id = st.id
		WHERE ts.student_id = ? OR ts.id = ?
	`, siswaID, siswaID).Scan(&studentID, &nama, &nisn, &kelas, &saldo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	startMs := JakartaMidnight(startDate)
	// Batas akhir: akhir hari endDate (23:59:59.999 WIB) supaya transaksi
	// hari terakhir ikut; kosong -> sekarang.
	var endMs int64
	if endDate != "" {
		if t, perr := time.ParseInLocation("2006-01-02", endDate, jakartaLoc); perr == nil {
			endMs = t.Add(24*time.Hour - time.Millisecond).UnixMilli()
		}
	} else {
		endMs = UnixMilli()
	}
	if endMs <= startMs {
		endMs = UnixMilli()
	}

	// Mutasi dalam periode (kronologis ASC).
	rows, err := r.DB.Query(`
		SELECT t.id, t.tipe, t.nominal, t.catatan, t.created_at
		FROM tabungan_transaksi t
		WHERE t.siswa_id = ? AND t.status = 'verified'
			AND t.created_at >= ? AND t.created_at <= ?
		ORDER BY t.created_at ASC
	`, studentID, startMs, endMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mutations := make([]models.StatementMutation, 0)
	totalDebit := 0  // keluar (tarik)
	totalCredit := 0 // masuk (setor)
	for rows.Next() {
		var id, tipe string
		var nominal int
		var cat sql.NullString
		var crAt sql.NullInt64
		if err := rows.Scan(&id, &tipe, &nominal, &cat, &crAt); err != nil {
			return nil, err
		}
		m := models.StatementMutation{
			RefID:    id,
			Date:     ToTime(crAt).In(jakartaLoc).Format("2006-01-02 15:04"),
			Category: tipe,
		}
		if cat.Valid && cat.String != "" {
			m.Description = cat.String
		} else if tipe == "setor" {
			m.Description = "Setoran tabungan"
		} else {
			m.Description = "Penarikan tabungan"
		}
		if tipe == "setor" {
			m.Credit = nominal
			totalCredit += nominal
		} else {
			m.Debit = nominal
			totalDebit += nominal
		}
		mutations = append(mutations, m)
	}

	// Mutasi SETELAH periode (untuk menutup saldo akhir periode dari saldo kini).
	var sesudahNet int
	if err := r.DB.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN t.tipe = 'setor' THEN t.nominal ELSE -t.nominal END), 0)
		FROM tabungan_transaksi t
		WHERE t.siswa_id = ? AND t.status = 'verified' AND t.created_at > ?
	`, studentID, endMs).Scan(&sesudahNet); err != nil {
		return nil, err
	}

	// Saldo akhir periode dan saldo awal (berjalan mundur dari saldo kini).
	closing := saldo - sesudahNet
	opening := closing - (totalCredit - totalDebit)

	// Isi saldo berjalan (berjalan maju).
	running := opening
	for i := range mutations {
		running += mutations[i].Credit - mutations[i].Debit
		mutations[i].Balance = running
	}

	// Hash verifikasi: disimpan supaya bisa diperiksa ulang publik nanti.
	hash := cuid2.Generate()
	_, err = r.DB.Exec(`
		INSERT INTO savings_statement_hashes
			(id, student_id, period_start, period_end, opening_balance, total_debit, total_credit, closing_balance, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, hash, studentID, startDate, endDate, opening, totalDebit, totalCredit, closing, UnixMilli())
	if err != nil {
		return nil, err
	}

	return &models.Statement{
		Student: models.StatementStudent{
			ID:    studentID,
			Nama:  nama,
			NISN:  nisn,
			Kelas: kelas,
		},
		Period: models.StatementPeriod{
			Start: startDate,
			End:   endDate,
		},
		OpeningBalance: opening,
		Mutations:      mutations,
		Summary: models.StatementSummary{
			TotalCredit:    totalCredit,
			TotalDebit:     totalDebit,
			ClosingBalance: closing,
		},
		VerificationHash: hash,
		GeneratedAt:     NowJakarta().Format(time.RFC3339),
	}, nil
}

// GetStatementByHash mengambil pernyataan tersimpan menurut hash verifikasi.
// Mengembalikan payload ringkas yang ditampilkan halaman verifikasi publik.
func (r *SavingsRepository) GetStatementByHash(hash string) (*models.StatementVerification, error) {
	var studentID, periodStart, periodEnd string
	var opening, debit, credit, closing int
	err := r.DB.QueryRow(`
		SELECT student_id, period_start, period_end, opening_balance, total_debit, total_credit, closing_balance
		FROM savings_statement_hashes WHERE id = ?
	`, hash).Scan(&studentID, &periodStart, &periodEnd, &opening, &debit, &credit, &closing)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	var nama, nisn, kelas string
	if err := r.DB.QueryRow(`
		SELECT st.full_name, COALESCE(st.nisn, ''), COALESCE(st.class_name, '')
		FROM students st WHERE st.id = ?
	`, studentID).Scan(&nama, &nisn, &kelas); err != nil {
		return nil, err
	}

	return &models.StatementVerification{
		Valid:   true,
		Hash:    hash,
		Student: models.StatementStudent{ID: studentID, Nama: nama, NISN: nisn, Kelas: kelas},
		Period:  models.StatementPeriod{Start: periodStart, End: periodEnd},
		Summary: models.StatementSummary{TotalCredit: credit, TotalDebit: debit, ClosingBalance: closing},
	}, nil
}

// VerifyStatement mengambil pernyataan menurut hash.
//
// Dulu verifikasinya membandingkan hash dengan ID transaksi
// (WHERE id = ?) — hash tak pernah dibuat dan bisa ditebak; yang
// dikembalikan pun cuma {success:true} tanpa isi. Kini pernyataan
// tersimpan saat dibuat dan payload-nya bisa ditampilkan ulang.
func (r *SavingsRepository) VerifyStatement(hash string) (*models.StatementVerification, error) {
	return r.GetStatementByHash(hash)
}
