package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type SavingsRepository struct {
	DB *sql.DB
}

func NewSavingsRepository(db *sql.DB) *SavingsRepository {
	return &SavingsRepository{DB: db}
}

// Stats
func (r *SavingsRepository) GetSavingsStats() (*models.SavingsStats, error) {
	stats := &models.SavingsStats{}
	r.DB.QueryRow("SELECT SUM(saldo_terakhir) FROM tabungan_siswa WHERE is_active = 1").Scan(&stats.TotalSaldoSiswa)
	r.DB.QueryRow("SELECT SUM(saldo) FROM tabungan_brankas").Scan(&stats.TotalBrankas)
	r.DB.QueryRow("SELECT SUM(nominal * jumlah) FROM tabungan_hutang WHERE status = 'aktif'").Scan(&stats.TotalPiutang)
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_setoran WHERE status = 'pending'").Scan(&stats.PendingSetoran)
	return stats, nil
}

// Students
func (r *SavingsRepository) GetSiswa(page, limit int, search, classId string) ([]models.TabunganSiswa, int, error) {
	offset := (page - 1) * limit
	query := `
		SELECT s.id, s.nisn, s.nama, s.kelas_id, s.saldo_terakhir, s.qr_code, s.foto, s.is_active, s.created_at,
		       k.id as k_id, k.nama as k_nama
		FROM tabungan_siswa s
		JOIN tabungan_kelas k ON s.kelas_id = k.id
		WHERE 1=1
	`
	var args []interface{}
	if search != "" {
		query += " AND (s.nama LIKE ? OR s.nisn LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}
	if classId != "" {
		query += " AND s.kelas_id = ?"
		args = append(args, classId)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM ("+query+")", args...).Scan(&total)

	query += " ORDER BY k.nama ASC, s.nama ASC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil { return nil, 0, err }
	defer rows.Close()

	var results []models.TabunganSiswa
	for rows.Next() {
		var s models.TabunganSiswa
		var kId, kNama, foto sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&s.ID, &s.NISN, &s.Nama, &s.KelasID, &s.SaldoTerakhir, &s.QRCode, &foto, &s.IsActive, &crAt, &kId, &kNama)
		if err != nil { return nil, 0, err }
		if foto.Valid { s.Foto = &foto.String }
		cTime := ToTime(crAt); s.CreatedAt = &cTime
		if kId.Valid {
			s.Kelas = &models.TabunganKelas{ID: kId.String, Nama: kNama.String}
		}
		results = append(results, s)
	}
	if results == nil { results = []models.TabunganSiswa{} }
	return results, total, nil
}

func (r *SavingsRepository) GetSiswaByQR(qrCode string) (*models.TabunganSiswa, error) {
	var s models.TabunganSiswa
	var kId, kNama, foto sql.NullString
	var crAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT s.id, s.nisn, s.nama, s.kelas_id, s.saldo_terakhir, s.qr_code, s.foto, s.is_active, s.created_at,
		       k.id as k_id, k.nama as k_nama
		FROM tabungan_siswa s
		JOIN tabungan_kelas k ON s.kelas_id = k.id
		WHERE s.qr_code = ? OR s.id = ?
	`, qrCode, qrCode).Scan(&s.ID, &s.NISN, &s.Nama, &s.KelasID, &s.SaldoTerakhir, &s.QRCode, &foto, &s.IsActive, &crAt, &kId, &kNama)
	
	if err != nil { return nil, err }
	if foto.Valid { s.Foto = &foto.String }
	cTime := ToTime(crAt); s.CreatedAt = &cTime
	if kId.Valid {
		s.Kelas = &models.TabunganKelas{ID: kId.String, Nama: kNama.String}
	}
	return &s, nil
}

// Transactions
func (r *SavingsRepository) CreateTransaksi(req models.CreateTransaksiRequest) error {
	tx, err := r.DB.Begin()
	if err != nil { return err }
	defer tx.Rollback()

	var saldo int
	err = tx.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE id = ?", req.SiswaID).Scan(&saldo)
	if err != nil { return errors.New("Siswa tidak ditemukan") }

	if req.Tipe == "tarik" && saldo < req.Nominal {
		return errors.New("Saldo tidak cukup")
	}

	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err = tx.Exec(`
		INSERT INTO tabungan_transaksi (id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.SiswaID, req.UserID, req.Tipe, req.Nominal, "collected", req.Catatan, now, now)

	if err != nil { return err }
	return tx.Commit()
}

func (r *SavingsRepository) GetTransactions(siswaId string) ([]models.TabunganTransaksi, error) {
	query := `
		SELECT t.id, t.siswa_id, t.user_id, t.setoran_id, t.tipe, t.nominal, t.status, t.catatan, t.created_at,
		       s.nama as s_nama, u.name as u_name
		FROM tabungan_transaksi t
		JOIN tabungan_siswa s ON t.siswa_id = s.id
		JOIN users u ON t.user_id = u.id
		WHERE 1=1
	`
	var args []interface{}
	if siswaId != "" {
		query += " AND t.siswa_id = ?"
		args = append(args, siswaId)
	}
	query += " ORDER BY t.created_at DESC LIMIT 100"

	rows, err := r.DB.Query(query, args...)
	if err != nil { return nil, err }
	defer rows.Close()

	var results []models.TabunganTransaksi
	for rows.Next() {
		var t models.TabunganTransaksi
		var sId, uId, setId, cat sql.NullString
		var crAt sql.NullInt64
		var sName, uName string
		err := rows.Scan(&t.ID, &sId, &uId, &setId, &t.Tipe, &t.Nominal, &t.Status, &cat, &crAt, &sName, &uName)
		if err != nil { return nil, err }
		if sId.Valid { t.SiswaID = sId.String }
		if uId.Valid { t.UserID = uId.String }
		if setId.Valid { t.SetoranID = &setId.String }
		if cat.Valid { t.Catatan = &cat.String }
		cTime := ToTime(crAt); t.CreatedAt = &cTime
		t.Siswa = &models.TabunganSiswa{Nama: sName}
		t.User = &models.User{Name: Ptr(uName)}
		results = append(results, t)
	}
	if results == nil { results = []models.TabunganTransaksi{} }
	return results, nil
}

// Settlements (Setoran)
func (r *SavingsRepository) GetSetoranList() ([]models.TabunganSetoran, error) {
	rows, err := r.DB.Query(`
		SELECT s.id, s.guru_id, s.bendahara_id, s.tipe, s.total_nominal, s.nominal_fisik, s.selisih, s.status, s.catatan, s.created_at,
		       g.name as g_name, b.name as b_name
		FROM tabungan_setoran s
		JOIN users g ON s.guru_id = g.id
		LEFT JOIN users b ON s.bendahara_id = b.id
		ORDER BY s.created_at DESC LIMIT 50
	`)
	if err != nil { return nil, err }
	defer rows.Close()

	var results []models.TabunganSetoran
	for rows.Next() {
		var s models.TabunganSetoran
		var bId, cat, gName, bName sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&s.ID, &s.GuruID, &bId, &s.Tipe, &s.TotalNominal, &s.NominalFisik, &s.Selisih, &s.Status, &cat, &crAt, &gName, &bName)
		if err != nil { return nil, err }
		if bId.Valid { s.BendaharaID = &bId.String }
		if cat.Valid { s.Catatan = &cat.String }
		cTime := ToTime(crAt); s.CreatedAt = &cTime
		s.Guru = &models.User{Name: Ptr(gName.String)}
		if bName.Valid { s.BendaharaID = &bName.String } // This is slightly wrong model-wise but useful for labels
		results = append(results, s)
	}
	if results == nil { results = []models.TabunganSetoran{} }
	return results, nil
}

func (r *SavingsRepository) CreateSetoran(req models.CreateSetoranRequest) error {
	tx, err := r.DB.Begin()
	if err != nil { return err }
	defer tx.Rollback()

	rows, err := tx.Query(`
		SELECT id, tipe, nominal FROM tabungan_transaksi 
		WHERE user_id = ? AND setoran_id IS NULL AND status = 'collected'
	`, req.GuruID)
	if err != nil { return err }

	var txIds []string
	total := 0
	for rows.Next() {
		var id, t string
		var n int
		rows.Scan(&id, &t, &n)
		txIds = append(txIds, id)
		if t == "setor" { total += n } else { total -= n }
	}
	rows.Close()

	if len(txIds) == 0 { return errors.New("Tidak ada transaksi untuk disetor") }

	sId := cuid2.Generate()
	now := time.Now().UnixMilli()
	tipe := "setor_ke_bendahara"
	if total < 0 { tipe = "tarik_dari_bendahara"; total = -total }

	_, err = tx.Exec("INSERT INTO tabungan_setoran (id, guru_id, tipe, total_nominal, status, catatan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		sId, req.GuruID, tipe, total, "pending", req.Catatan, now, now)
	if err != nil { return err }

	for _, tid := range txIds {
		tx.Exec("UPDATE tabungan_transaksi SET setoran_id = ?, updated_at = ? WHERE id = ?", sId, now, tid)
	}
	return tx.Commit()
}

func (r *SavingsRepository) VerifySetoran(req models.VerifySetoranRequest) error {
	tx, err := r.DB.Begin()
	if err != nil { return err }
	defer tx.Rollback()

	var total int
	var t string
	tx.QueryRow("SELECT total_nominal, tipe FROM tabungan_setoran WHERE id = ?", req.SetoranID).Scan(&total, &t)

	fisik := total
	if req.NominalFisik != nil { fisik = *req.NominalFisik }
	selisih := total - fisik
	now := time.Now().UnixMilli()

	tx.Exec("UPDATE tabungan_setoran SET status = ?, bendahara_id = ?, nominal_fisik = ?, selisih = ?, catatan = ?, updated_at = ? WHERE id = ?",
		req.Status, req.BendaharaID, fisik, selisih, req.Catatan, now, req.SetoranID)

	if req.Status == "verified" {
		rows, _ := tx.Query("SELECT id, siswa_id, tipe, nominal FROM tabungan_transaksi WHERE setoran_id = ?", req.SetoranID)
		for rows.Next() {
			var tid, sid, tp string
			var n int
			rows.Scan(&tid, &sid, &tp, &n)
			tx.Exec("UPDATE tabungan_transaksi SET status = 'verified', updated_at = ? WHERE id = ?", now, tid)
			if tp == "setor" {
				tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir + ?, updated_at = ? WHERE id = ?", n, now, sid)
			} else {
				tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir - ?, updated_at = ? WHERE id = ?", n, now, sid)
			}
		}
		rows.Close()

		// Vault update
		var bId string
		tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&bId)
		if bId == "" {
			bId = cuid2.Generate()
			tx.Exec("INSERT INTO tabungan_brankas (id, nama, tipe, saldo, updated_at) VALUES (?, 'Kas Utama', 'cash', 0, ?)", bId, now)
		}
		op := "+"
		if t == "tarik_dari_bendahara" { op = "-" }
		tx.Exec(fmt.Sprintf("UPDATE tabungan_brankas SET saldo = saldo %s ?, updated_at = ? WHERE id = ?", op), fisik, now, bId)
		
		tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			cuid2.Generate(), t, fisik, req.BendaharaID, "Verifikasi setoran harian", now)
	}
	return tx.Commit()
}

// Brankas & Admin
func (r *SavingsRepository) GetBrankas() ([]models.TabunganBrankas, error) {
	rows, err := r.DB.Query("SELECT id, nama, tipe, saldo, updated_at FROM tabungan_brankas ORDER BY tipe DESC")
	if err != nil { return nil, err }
	defer rows.Close()
	var res []models.TabunganBrankas
	for rows.Next() {
		var b models.TabunganBrankas
		var upAt sql.NullInt64
		rows.Scan(&b.ID, &b.Nama, &b.Tipe, &b.Saldo, &upAt)
		uTime := ToTime(upAt); b.UpdatedAt = &uTime
		res = append(res, b)
	}
	return res, nil
}

func (r *SavingsRepository) GetBrankasTransactions() ([]models.TabunganBrankasTransaksi, error) {
	rows, err := r.DB.Query(`
		SELECT bt.id, bt.tipe, bt.nominal, bt.user_id, bt.catatan, bt.created_at, u.name
		FROM tabungan_brankas_transaksi bt
		LEFT JOIN users u ON bt.user_id = u.id
		ORDER BY bt.created_at DESC LIMIT 20
	`)
	if err != nil { return nil, err }
	defer rows.Close()
	var res []models.TabunganBrankasTransaksi
	for rows.Next() {
		var t models.TabunganBrankasTransaksi
		var uId, cat, uName sql.NullString
		var crAt sql.NullInt64
		rows.Scan(&t.ID, &t.Tipe, &t.Nominal, &uId, &cat, &crAt, &uName)
		if uId.Valid { t.UserID = &uId.String }
		if cat.Valid { t.Catatan = &cat.String }
		cTime := ToTime(crAt); t.CreatedAt = &cTime
		if uName.Valid { t.User = &models.User{Name: Ptr(uName.String)} }
		res = append(res, t)
	}
	return res, nil
}

func (r *SavingsRepository) TransferBrankas(req models.TransferBrankasRequest) error {
	tx, err := r.DB.Begin()
	if err != nil { return err }
	defer tx.Rollback()

	var cashId, bankId string
	var cashSaldo, bankSaldo int
	tx.QueryRow("SELECT id, saldo FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&cashId, &cashSaldo)
	tx.QueryRow("SELECT id, saldo FROM tabungan_brankas WHERE tipe = 'bank' LIMIT 1").Scan(&bankId, &bankSaldo)

	if cashId == "" || bankId == "" { return errors.New("Brankas Tunai atau Bank tidak ditemukan") }

	now := time.Now().UnixMilli()
	if req.Tipe == "setor_ke_bank" {
		if cashSaldo < req.Nominal { return errors.New("Saldo Tunai tidak mencukupi") }
		tx.Exec("UPDATE tabungan_brankas SET saldo = saldo - ?, updated_at = ? WHERE id = ?", req.Nominal, now, cashId)
		tx.Exec("UPDATE tabungan_brankas SET saldo = saldo + ?, updated_at = ? WHERE id = ?", req.Nominal, now, bankId)
	} else {
		if bankSaldo < req.Nominal { return errors.New("Saldo Bank tidak mencukupi") }
		tx.Exec("UPDATE tabungan_brankas SET saldo = saldo + ?, updated_at = ? WHERE id = ?", req.Nominal, now, cashId)
		tx.Exec("UPDATE tabungan_brankas SET saldo = saldo - ?, updated_at = ? WHERE id = ?", req.Nominal, now, bankId)
	}

	tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		cuid2.Generate(), req.Tipe, req.Nominal, req.UserID, "Transfer internal brankas", now)

	return tx.Commit()
}

func (r *SavingsRepository) GetSavingsTreasurer() (*models.User, error) {
	var u models.User
	err := r.DB.QueryRow(`
		SELECT u.id, u.name, u.email, u.role
		FROM school_settings s
		JOIN users u ON s.savings_treasurer_id = u.id
		LIMIT 1
	`).Scan(&u.ID, &u.Name, &u.Email, &u.Role)
	if err != nil { return nil, err }
	return &u, nil
}

func (r *SavingsRepository) UpdateSavingsTreasurer(userId string) error {
	_, err := r.DB.Exec("UPDATE school_settings SET savings_treasurer_id = ?, updated_at = ?", userId, time.Now().UnixMilli())
	return err
}

func (r *SavingsRepository) GetClassesWithReps() ([]models.TabunganKelas, error) {
	rows, err := r.DB.Query(`
		SELECT k.id, k.nama, k.wali_kelas, u.name
		FROM tabungan_kelas k
		LEFT JOIN users u ON k.wali_kelas = u.id
		ORDER BY k.nama ASC
	`)
	if err != nil { return nil, err }
	defer rows.Close()
	var res []models.TabunganKelas
	for rows.Next() {
		var k models.TabunganKelas
		var wId, wName sql.NullString
		rows.Scan(&k.ID, &k.Nama, &wId, &wName)
		if wId.Valid { k.WaliKelas = &wId.String }
		// We could enrich here if needed
		res = append(res, k)
	}
	return res, nil
}

func (r *SavingsRepository) UpdateClassRep(classId, userId string) error {
	_, err := r.DB.Exec("UPDATE tabungan_kelas SET wali_kelas = ?, updated_at = ? WHERE id = ?", userId, time.Now().UnixMilli(), classId)
	return err
}

// Hutang
func (r *SavingsRepository) GetHutang(siswaId string) ([]models.TabunganHutang, error) {
	query := `
		SELECT h.id, h.siswa_id, h.nama_barang, h.kategori, h.nominal, h.jumlah, h.dicatat_oleh, h.status, h.created_at,
		       s.nama as s_nama
		FROM tabungan_hutang h
		JOIN tabungan_siswa s ON h.siswa_id = s.id
		WHERE 1=1
	`
	var args []interface{}
	if siswaId != "" {
		query += " AND h.siswa_id = ?"
		args = append(args, siswaId)
	}
	rows, err := r.DB.Query(query, args...)
	if err != nil { return nil, err }
	defer rows.Close()
	var res []models.TabunganHutang
	for rows.Next() {
		var h models.TabunganHutang
		var crAt sql.NullInt64
		var sName string
		rows.Scan(&h.ID, &h.SiswaID, &h.NamaBarang, &h.Kategori, &h.Nominal, &h.Jumlah, &h.DicatatOleh, &h.Status, &crAt, &sName)
		h.Siswa = &models.TabunganSiswa{Nama: sName}
		cTime := ToTime(crAt); h.CreatedAt = &cTime
		res = append(res, h)
	}
	return res, nil
}

func (r *SavingsRepository) GetStudentFinancialClearance(studentID string) (int, int, error) {
	var balance int
	var debt int

	// Get Balance
	err := r.DB.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE id = ?", studentID).Scan(&balance)
	if err != nil {
		if err == sql.ErrNoRows {
			balance = 0
		} else {
			return 0, 0, err
		}
	}

	// Get Total Active Debt
	err = r.DB.QueryRow("SELECT SUM(nominal * jumlah) FROM tabungan_hutang WHERE siswa_id = ? AND status = 'aktif'", studentID).Scan(&debt)
	if err != nil {
		debt = 0 // If no debt or null
	}

	return balance, debt, nil
}

func (r *SavingsRepository) GetPublicBalance(identifier, birthDate string) (*models.TabunganSiswa, error) {
	var s models.TabunganSiswa
	var kNama sql.NullString
	var upAt sql.NullInt64

	query := `
		SELECT ts.id, ts.nisn, ts.nama, ts.saldo_terakhir, ts.updated_at, k.nama as k_nama
		FROM tabungan_siswa ts
		JOIN students st ON ts.student_id = st.id
		JOIN tabungan_kelas k ON ts.kelas_id = k.id
		WHERE (ts.nisn = ? OR ts.qr_code = ? OR ts.id = ?) AND st.birth_date = ? AND ts.is_active = 1
	`
	err := r.DB.QueryRow(query, identifier, identifier, identifier, birthDate).Scan(
		&s.ID, &s.NISN, &s.Nama, &s.SaldoTerakhir, &upAt, &kNama,
	)
	if err != nil {
		return nil, err
	}

	uTime := ToTime(upAt)
	s.UpdatedAt = &uTime
	if kNama.Valid {
		s.Kelas = &models.TabunganKelas{Nama: kNama.String}
	}

	return &s, nil
}
