package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

type SavingsRepository struct {
	DB *sql.DB
}

func NewSavingsRepository(db *sql.DB) *SavingsRepository {
	return &SavingsRepository{DB: db}
}

// siswaBaseQuery is the single source of truth for savings student rows:
// tabungan_siswa is an extension table (student_id + saldo), identity comes from students JOIN.
const siswaBaseQuery = `
	SELECT ts.id, ts.student_id, st.nisn, st.full_name, st.class_id, st.class_name,
	       st.qr_code, st.photo, st.status, st.is_active, ts.saldo_terakhir, ts.created_at,
	       st.birth_date
	FROM tabungan_siswa ts
	JOIN students st ON ts.student_id = st.id
`

func studentIsActive(status sql.NullString, isActive sql.NullInt64) bool {
	if isActive.Valid && isActive.Int64 == 1 {
		return true
	}
	s := status.String
	return s == "active" || s == "aktif"
}

// Stats
func (r *SavingsRepository) GetSavingsStats() (*models.SavingsStats, error) {
	stats := &models.SavingsStats{}
	startOfDay := UnixMilli() - (UnixMilli() % 86400000)

	r.DB.QueryRow(`
		SELECT COUNT(*) FROM tabungan_siswa ts
		JOIN students st ON ts.student_id = st.id
		WHERE st.status = 'active' OR st.is_active = 1
	`).Scan(&stats.TotalSiswa)
	r.DB.QueryRow(`
		SELECT COALESCE(SUM(ts.saldo_terakhir), 0) FROM tabungan_siswa ts
		JOIN students st ON ts.student_id = st.id
		WHERE st.status = 'active' OR st.is_active = 1
	`).Scan(&stats.TotalSaldo)
	r.DB.QueryRow("SELECT COALESCE(SUM(saldo), 0) FROM tabungan_brankas").Scan(&stats.TotalBrankas)
	r.DB.QueryRow("SELECT COALESCE(SUM(nominal * jumlah), 0) FROM tabungan_hutang WHERE status = 'aktif'").Scan(&stats.TotalPiutang)
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_setoran WHERE status = 'pending'").Scan(&stats.PendingSetoran)
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_transaksi WHERE status = 'collected'").Scan(&stats.PendingTransactions)
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_transaksi WHERE status = 'verified' AND created_at >= ?", startOfDay).Scan(&stats.TodayTransactions)
	r.DB.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_transaksi WHERE status = 'verified' AND tipe = 'setor' AND created_at >= ?", startOfDay).Scan(&stats.TodayDeposit)
	r.DB.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_transaksi WHERE status = 'verified' AND tipe = 'tarik' AND created_at >= ?", startOfDay).Scan(&stats.TodayWithdraw)
	stats.TotalSaldoSiswa = stats.TotalSaldo
	return stats, nil
}

func (r *SavingsRepository) GetTopSavers(limit int) ([]models.TopSaverItem, error) {
	if limit < 1 {
		limit = 5
	}
	rows, err := r.DB.Query(`
		SELECT st.id, st.full_name, COALESCE(st.class_name, ''), ts.saldo_terakhir
		FROM tabungan_siswa ts
		JOIN students st ON ts.student_id = st.id
		WHERE st.status = 'active' OR st.is_active = 1
		ORDER BY ts.saldo_terakhir DESC, st.full_name ASC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.TopSaverItem, 0)
	for rows.Next() {
		var id, nama, kelas string
		var saldo int
		if err := rows.Scan(&id, &nama, &kelas, &saldo); err != nil {
			return nil, err
		}
		items = append(items, models.TopSaverItem{
			ID:    id,
			Name:  nama,
			Kelas: kelas,
			Saldo: saldo,
		})
	}
	return items, nil
}

func (r *SavingsRepository) GetRecentTransactions(limit int) ([]models.RecentTransactionItem, error) {
	if limit < 1 {
		limit = 8
	}
	rows, err := r.DB.Query(`
		SELECT t.id, t.tipe, t.nominal, t.created_at, st.full_name, COALESCE(st.class_name, '')
		FROM tabungan_transaksi t
		JOIN students st ON t.siswa_id = st.id
		WHERE t.status = 'verified'
		ORDER BY t.created_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.RecentTransactionItem, 0)
	for rows.Next() {
		var id, tipe, siswaName, kelasName string
		var nominal int
		var createdAt sql.NullInt64
		if err := rows.Scan(&id, &tipe, &nominal, &createdAt, &siswaName, &kelasName); err != nil {
			return nil, err
		}
		timeValue := ""
		if createdAt.Valid {
			timeValue = ToTime(createdAt).Format(time.RFC3339)
		}
		items = append(items, models.RecentTransactionItem{
			ID:        id,
			Tipe:      tipe,
			Nominal:   nominal,
			SiswaName: siswaName,
			KelasName: kelasName,
			Time:      timeValue,
		})
	}
	return items, nil
}

func (r *SavingsRepository) GetTransactionTrend() ([]models.TransactionTrendItem, error) {
	items := make([]models.TransactionTrendItem, 0, 7)
	now := time.Now()
	for i := 6; i >= 0; i-- {
		day := now.AddDate(0, 0, -i)
		start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location()).UnixMilli()
		end := start + 86399999
		var setor, tarik int
		r.DB.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_transaksi WHERE status = 'verified' AND tipe = 'setor' AND created_at BETWEEN ? AND ?", start, end).Scan(&setor)
		r.DB.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_transaksi WHERE status = 'verified' AND tipe = 'tarik' AND created_at BETWEEN ? AND ?", start, end).Scan(&tarik)
		items = append(items, models.TransactionTrendItem{
			Date:  day.Format("02/01"),
			Setor: setor,
			Tarik: tarik,
		})
	}
	return items, nil
}

func (r *SavingsRepository) GetSaldoByKelas() ([]models.SaldoByKelasItem, error) {
	rows, err := r.DB.Query(`
		SELECT COALESCE(st.class_name, '') as kelas, COALESCE(SUM(ts.saldo_terakhir), 0) AS saldo
		FROM tabungan_siswa ts
		JOIN students st ON ts.student_id = st.id
		WHERE st.status = 'active' OR st.is_active = 1
		GROUP BY st.class_name
		HAVING saldo > 0
		ORDER BY kelas ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	colors := []string{"#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1", "#84cc16", "#06b6d4"}
	items := make([]models.SaldoByKelasItem, 0)
	i := 0
	for rows.Next() {
		var nama string
		var saldo int
		if err := rows.Scan(&nama, &saldo); err != nil {
			return nil, err
		}
		items = append(items, models.SaldoByKelasItem{
			Name:  nama,
			Value: saldo,
			Color: colors[i%len(colors)],
		})
		i++
	}
	return items, nil
}

// scanSiswa maps a row of siswaBaseQuery (+ optional extra columns) to TabunganSiswa
type siswaRow struct {
	s        models.TabunganSiswa
	kelasID  sql.NullString
	kelasNama sql.NullString
	status   sql.NullString
	stActive sql.NullInt64
	birth    sql.NullString
}

func scanSiswaRow(scanner interface{ Scan(dest ...interface{}) error }) (*siswaRow, error) {
	var row siswaRow
	var nisn, qrCode, foto sql.NullString
	var stID sql.NullString
	var crAt sql.NullInt64
	err := scanner.Scan(&row.s.ID, &stID, &nisn, &row.s.Nama, &row.kelasID, &row.kelasNama,
		&qrCode, &foto, &row.status, &row.stActive, &row.s.SaldoTerakhir, &crAt, &row.birth)
	if err != nil {
		return nil, err
	}
	row.s.NISN = nisn.String
	row.s.QRCode = qrCode.String
	row.s.KelasID = row.kelasID.String
	row.s.IsActive = studentIsActive(row.status, row.stActive)
	if stID.Valid {
		row.s.StudentID = &stID.String
	}
	if foto.Valid {
		row.s.Foto = &foto.String
	}
	if crAt.Valid {
		t := ToTime(crAt)
		row.s.CreatedAt = &t
	}
	if row.kelasID.Valid {
		row.s.Kelas = &models.TabunganKelas{ID: row.kelasID.String, Nama: row.kelasNama.String}
	}
	return &row, nil
}

// GetSiswa returns paginated savings accounts with identity from students
func (r *SavingsRepository) GetSiswa(page, limit int, search, classId string) ([]models.TabunganSiswa, int, error) {
	offset := (page - 1) * limit
	query := siswaBaseQuery + " WHERE 1=1"
	var args []interface{}
	if search != "" {
		query += " AND (st.full_name LIKE ? OR st.nisn LIKE ? OR st.qr_code LIKE ? OR ts.student_id LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern, pattern)
	}
	if classId != "" {
		query += " AND st.class_id = ?"
		args = append(args, classId)
	}
	query += " AND (st.status = 'active' OR st.is_active = 1)"

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM ("+query+")", args...).Scan(&total)

	query += " ORDER BY st.class_name ASC, st.full_name ASC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	results := make([]models.TabunganSiswa, 0)
	for rows.Next() {
		row, err := scanSiswaRow(rows)
		if err != nil {
			return nil, 0, err
		}
		results = append(results, row.s)
	}
	return results, total, nil
}

// GetSiswaByQR finds a savings account by QR code, tabungan id, student id, nisn, or nis
func (r *SavingsRepository) GetSiswaByQR(qrCode string) (*models.TabunganSiswa, error) {
	query := siswaBaseQuery + `
		WHERE ts.student_id = (
			SELECT id FROM students
			WHERE id = ? OR nisn = ? OR qr_code = ? OR nis = ?
			LIMIT 1
		)
	`
	row, err := scanSiswaRow(r.DB.QueryRow(query, qrCode, qrCode, qrCode, qrCode))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &row.s, nil
}

// EnsureSiswa creates a savings extension row for an active student if missing.
func (r *SavingsRepository) EnsureSiswa(studentID string) error {
	_, err := r.DB.Exec(`
		INSERT INTO tabungan_siswa (id, student_id, saldo_terakhir, created_at, updated_at)
		SELECT ?, s.id, 0, ?, ?
		FROM students s
		WHERE s.id = ? AND (s.status = 'active' OR s.is_active = 1)
		  AND NOT EXISTS (SELECT 1 FROM tabungan_siswa ts WHERE ts.student_id = s.id)
	`, "sav_"+studentID, UnixMilli(), UnixMilli(), studentID)
	return err
}

// DeleteSiswa deactivates (soft) — with single source, deactivation lives in students;
// here we just remove the extension row's meaning by returning an error if used directly.
func (r *SavingsRepository) DeleteSiswa(id string) error {
	_, err := r.DB.Exec("DELETE FROM tabungan_siswa WHERE id = ?", id)
	return err
}

// GetStudentFinancialClearance returns balance and total debt for a student
func (r *SavingsRepository) GetStudentFinancialClearance(studentID string) (int, int, error) {
	var balance int
	var savingsID sql.NullString

	err := r.DB.QueryRow("SELECT id, saldo_terakhir FROM tabungan_siswa WHERE student_id = ?", studentID).Scan(&savingsID, &balance)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, err
	}

	var nullDebt sql.NullInt64
	err = r.DB.QueryRow("SELECT SUM(nominal * jumlah) FROM tabungan_hutang WHERE siswa_id = ? AND status = 'aktif'", savingsID.String).Scan(&nullDebt)
	if err == nil && nullDebt.Valid {
		return balance, int(nullDebt.Int64), nil
	}

	return balance, 0, nil
}

// GetFinalReport returns end-of-year financial report for a student
func (r *SavingsRepository) GetFinalReport(studentID string, year string) (*models.FinalReport, error) {
	var nisn, nama, kelas sql.NullString
	var saldo int
	err := r.DB.QueryRow(`
		SELECT st.nisn, st.full_name, COALESCE(st.class_name, ''), ts.saldo_terakhir
		FROM tabungan_siswa ts
		JOIN students st ON ts.student_id = st.id
		WHERE ts.student_id = ? OR ts.id = ?
	`, studentID, studentID).Scan(&nisn, &nama, &kelas, &saldo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	// resolve student id for transaction lookup
	var realStudentID string
	if err := r.DB.QueryRow("SELECT student_id FROM tabungan_siswa WHERE student_id = ? OR id = ?", studentID, studentID).Scan(&realStudentID); err != nil {
		return nil, err
	}

	rows, err := r.DB.Query(`
		SELECT t.tipe, t.nominal, t.catatan, t.created_at
		FROM tabungan_transaksi t
		WHERE t.siswa_id = ? AND t.status = 'verified'
		ORDER BY t.created_at ASC
	`, realStudentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []models.FinalReportTransaction
	totalSetor := 0
	totalTarik := 0
	for rows.Next() {
		var tipe string
		var nominal int
		var cat sql.NullString
		var crAt sql.NullInt64
		rows.Scan(&tipe, &nominal, &cat, &crAt)
		item := models.FinalReportTransaction{
			Tipe:    tipe,
			Nominal: nominal,
		}
		if cat.Valid {
			item.Catatan = cat.String
		}
		if crAt.Valid {
			item.Tanggal = ToTime(crAt).Format("2006-01-02")
		}
		transactions = append(transactions, item)
		if tipe == "setor" {
			totalSetor += nominal
		} else {
			totalTarik += nominal
		}
	}
	if transactions == nil {
		transactions = []models.FinalReportTransaction{}
	}

	return &models.FinalReport{
		Siswa: models.FinalReportSiswa{
			Nama:  nama.String,
			NISN:  nisn.String,
			Kelas: kelas.String,
			Saldo: saldo,
		},
		Transactions: transactions,
		TotalSetor:   totalSetor,
		TotalTarik:   totalTarik,
		SaldoAkhir:   saldo,
	}, nil
}

// SyncFromStudents ensures every active student has a savings extension row.
// With the extension-table model this is all the "sync" that is needed:
// identity columns no longer exist here, so nothing can drift.
func (r *SavingsRepository) SyncFromStudents() (int, error) {
	res, err := r.DB.Exec(`
		INSERT INTO tabungan_siswa (id, student_id, saldo_terakhir, created_at, updated_at)
		SELECT 'sav_' || s.id, s.id, 0, ?, ?
		FROM students s
		WHERE (s.status = 'active' OR s.is_active = 1)
		  AND NOT EXISTS (SELECT 1 FROM tabungan_siswa ts WHERE ts.student_id = s.id)
	`, UnixMilli(), UnixMilli())
	if err != nil {
		return 0, err
	}
	count, _ := res.RowsAffected()
	return int(count), nil
}

// GetPublicBalance returns a student's savings balance by identifier + birth date
func (r *SavingsRepository) GetPublicBalance(identifier, birthDate string) (*models.TabunganSiswa, error) {
	query := siswaBaseQuery + `
		WHERE (st.nisn = ? OR st.nis = ? OR st.id = ? OR st.qr_code = ?)
		  AND st.birth_date = ?
	`
	row, err := scanSiswaRow(r.DB.QueryRow(query, identifier, identifier, identifier, identifier, birthDate))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &row.s, nil
}
