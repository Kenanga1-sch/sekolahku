package repository

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"
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
	startOfDay := time.Now().Truncate(24 * time.Hour).UnixMilli()

	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_siswa WHERE is_active = 1").Scan(&stats.TotalSiswa)
	r.DB.QueryRow("SELECT COALESCE(SUM(saldo_terakhir), 0) FROM tabungan_siswa WHERE is_active = 1").Scan(&stats.TotalSaldo)
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
		SELECT s.id, s.nama, k.nama, s.saldo_terakhir
		FROM tabungan_siswa s
		JOIN tabungan_kelas k ON s.kelas_id = k.id
		WHERE s.is_active = 1
		ORDER BY s.saldo_terakhir DESC, s.nama ASC
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
		SELECT t.id, t.tipe, t.nominal, t.created_at, s.nama, k.nama
		FROM tabungan_transaksi t
		JOIN tabungan_siswa s ON t.siswa_id = s.id
		JOIN tabungan_kelas k ON s.kelas_id = k.id
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
		end := time.Date(day.Year(), day.Month(), day.Day(), 23, 59, 59, int(time.Millisecond-time.Nanosecond), day.Location()).UnixMilli()
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
		SELECT k.nama, COALESCE(SUM(s.saldo_terakhir), 0) AS saldo
		FROM tabungan_kelas k
		LEFT JOIN tabungan_siswa s ON s.kelas_id = k.id AND s.is_active = 1
		GROUP BY k.id, k.nama
		HAVING saldo > 0
		ORDER BY k.nama ASC
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

// Students
func (r *SavingsRepository) GetSiswa(page, limit int, search, classId string) ([]models.TabunganSiswa, int, error) {
	offset := (page - 1) * limit
	query := `
		SELECT s.id, s.nisn, s.nama, s.kelas_id, s.saldo_terakhir, s.qr_code, s.foto, s.is_active, s.created_at,
		       k.id as k_id, k.nama as k_nama
		FROM tabungan_siswa s
		JOIN tabungan_kelas k ON s.kelas_id = k.id
		WHERE s.is_active = 1
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
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.TabunganSiswa
	for rows.Next() {
		var s models.TabunganSiswa
		var kId, kNama, foto sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&s.ID, &s.NISN, &s.Nama, &s.KelasID, &s.SaldoTerakhir, &s.QRCode, &foto, &s.IsActive, &crAt, &kId, &kNama)
		if err != nil {
			return nil, 0, err
		}
		if foto.Valid {
			s.Foto = &foto.String
		}
		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		if kId.Valid {
			s.Kelas = &models.TabunganKelas{ID: kId.String, Nama: kNama.String}
		}
		results = append(results, s)
	}
	if results == nil {
		results = []models.TabunganSiswa{}
	}
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
		WHERE s.qr_code = ? OR s.id = ? OR s.nisn = ?
	`, qrCode, qrCode, qrCode).Scan(&s.ID, &s.NISN, &s.Nama, &s.KelasID, &s.SaldoTerakhir, &s.QRCode, &foto, &s.IsActive, &crAt, &kId, &kNama)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if foto.Valid {
		s.Foto = &foto.String
	}
	cTime := ToTime(crAt)
	s.CreatedAt = &cTime
	if kId.Valid {
		s.Kelas = &models.TabunganKelas{ID: kId.String, Nama: kNama.String}
	}
	return &s, nil
}

func (r *SavingsRepository) CreateSiswa(req models.CreateSiswaRequest) error {
	req.NISN = strings.TrimSpace(req.NISN)
	req.Nama = strings.TrimSpace(req.Nama)
	req.KelasID = strings.TrimSpace(req.KelasID)
	if req.NISN == "" || req.Nama == "" || req.KelasID == "" {
		return errors.New("NISN, nama, dan kelas wajib diisi")
	}

	id := cuid2.Generate()
	qrCode := "TAB-" + id
	if req.QRCode != nil && strings.TrimSpace(*req.QRCode) != "" {
		qrCode = strings.TrimSpace(*req.QRCode)
	}
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO tabungan_siswa (id, nisn, nama, kelas_id, saldo_terakhir, qr_code, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, ?, 1, ?, ?)
	`, id, req.NISN, req.Nama, req.KelasID, qrCode, now, now)
	return err
}

func (r *SavingsRepository) UpdateSiswa(id string, req models.CreateSiswaRequest) error {
	req.NISN = strings.TrimSpace(req.NISN)
	req.Nama = strings.TrimSpace(req.Nama)
	req.KelasID = strings.TrimSpace(req.KelasID)
	if id == "" || req.NISN == "" || req.Nama == "" || req.KelasID == "" {
		return errors.New("Data siswa tidak lengkap")
	}

	query := "UPDATE tabungan_siswa SET nisn = ?, nama = ?, kelas_id = ?, updated_at = ?"
	args := []interface{}{req.NISN, req.Nama, req.KelasID, UnixMilli()}
	if req.QRCode != nil && strings.TrimSpace(*req.QRCode) != "" {
		query += ", qr_code = ?"
		args = append(args, strings.TrimSpace(*req.QRCode))
	}
	query += " WHERE id = ?"
	args = append(args, id)

	res, err := r.DB.Exec(query, args...)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return errors.New("Siswa tidak ditemukan")
	}
	return nil
}

func (r *SavingsRepository) DeleteSiswa(id string) error {
	res, err := r.DB.Exec("UPDATE tabungan_siswa SET is_active = 0, updated_at = ? WHERE id = ?", UnixMilli(), id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return errors.New("Siswa tidak ditemukan")
	}
	return nil
}

// Classes
func (r *SavingsRepository) GetAllKelas() ([]models.TabunganKelas, error) {
	rows, err := r.DB.Query(`
		SELECT k.id, k.nama, k.wali_kelas, u.name
		FROM tabungan_kelas k
		LEFT JOIN users u ON k.wali_kelas = u.id
		ORDER BY k.nama ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []models.TabunganKelas
	for rows.Next() {
		var k models.TabunganKelas
		var wId, wName sql.NullString
		rows.Scan(&k.ID, &k.Nama, &wId, &wName)
		if wId.Valid {
			k.WaliKelas = &wId.String
		}
		res = append(res, k)
	}
	return res, nil
}

func (r *SavingsRepository) CreateKelas(nama string, waliKelas *string) error {
	id := cuid2.Generate()
	now := UnixMilli()
	_, err := r.DB.Exec("INSERT INTO tabungan_kelas (id, nama, wali_kelas, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
		id, nama, waliKelas, now, now)
	return err
}

func (r *SavingsRepository) UpdateKelas(id string, nama string, waliKelas *string) error {
	_, err := r.DB.Exec("UPDATE tabungan_kelas SET nama = ?, wali_kelas = ?, updated_at = ? WHERE id = ?",
		nama, waliKelas, UnixMilli(), id)
	return err
}

func (r *SavingsRepository) DeleteKelas(id string) error {
	var count int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_siswa WHERE kelas_id = ? AND is_active = 1", id).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return errors.New("Tidak dapat menghapus kelas yang masih memiliki " + strconv.Itoa(count) + " siswa aktif")
	}
	_, err := r.DB.Exec("DELETE FROM tabungan_kelas WHERE id = ?", id)
	return err
}

func (r *SavingsRepository) UpdateClassRep(classId, userId string) error {
	_, err := r.DB.Exec("UPDATE tabungan_kelas SET wali_kelas = ?, updated_at = ? WHERE id = ?", userId, UnixMilli(), classId)
	return err
}

func (r *SavingsRepository) GetClassesWithReps() ([]models.TabunganKelas, error) {
	return r.GetAllKelas()
}

// GetStudentFinancialClearance returns balance and total debt for a student
func (r *SavingsRepository) GetStudentFinancialClearance(studentID string) (int, int, error) {
	var balance int
	var debt int
	var savingsID string

	err := r.DB.QueryRow("SELECT id, saldo_terakhir FROM tabungan_siswa WHERE student_id = ?", studentID).Scan(&savingsID, &balance)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, err
	}

	var nullDebt sql.NullInt64
	err = r.DB.QueryRow("SELECT SUM(nominal * jumlah) FROM tabungan_hutang WHERE siswa_id = ? AND status = 'aktif'", savingsID).Scan(&nullDebt)
	if err == nil && nullDebt.Valid {
		debt = int(nullDebt.Int64)
	}

	return balance, debt, nil
}

// GetFinalReport returns end-of-year financial report for a student
func (r *SavingsRepository) GetFinalReport(studentID string, year string) (*models.FinalReport, error) {
	var s models.TabunganSiswa
	var kNama sql.NullString
	err := r.DB.QueryRow(`
		SELECT ts.id, ts.nisn, ts.nama, ts.saldo_terakhir, k.nama as k_nama
		FROM tabungan_siswa ts
		JOIN tabungan_kelas k ON ts.kelas_id = k.id
		WHERE ts.id = ?
	`, studentID).Scan(&s.ID, &s.NISN, &s.Nama, &s.SaldoTerakhir, &kNama)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	rows, err := r.DB.Query(`
		SELECT t.tipe, t.nominal, t.catatan, t.created_at
		FROM tabungan_transaksi t
		WHERE t.siswa_id = ? AND t.status = 'verified'
		ORDER BY t.created_at ASC
	`, studentID)
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
			Nama:  s.Nama,
			NISN:  s.NISN,
			Kelas: kNama.String,
			Saldo: s.SaldoTerakhir,
		},
		Transactions: transactions,
		TotalSetor:   totalSetor,
		TotalTarik:   totalTarik,
		SaldoAkhir:   s.SaldoTerakhir,
	}, nil
}

// SyncFromStudents links existing tabungan_siswa to students and inserts missing ones
func (r *SavingsRepository) SyncFromStudents() (int, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE tabungan_siswa
		SET student_id = (
			SELECT s.id FROM students s
			WHERE s.nisn = tabungan_siswa.nisn AND s.nisn IS NOT NULL AND s.nisn != ''
			LIMIT 1
		)
		WHERE student_id IS NULL OR student_id = ''
	`)
	if err != nil {
		return 0, err
	}

	rows, err := tx.Query(`
		SELECT id, nisn, full_name, COALESCE(class_name, ''),
		       CASE WHEN qr_code IS NOT NULL AND TRIM(qr_code) != '' THEN qr_code ELSE id END
		FROM students
		WHERE (is_active = 1 OR status = 'active' OR status = 'aktif')
			AND id NOT IN (SELECT student_id FROM tabungan_siswa WHERE student_id IS NOT NULL)
			AND (nisn IS NOT NULL AND nisn != '' AND nisn NOT IN (SELECT nisn FROM tabungan_siswa WHERE nisn IS NOT NULL))
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type stubStudent struct {
		ID        string
		NISN      string
		FullName  string
		ClassName string
		QRCode    string
	}
	var toAdd []stubStudent
	for rows.Next() {
		var s stubStudent
		if err := rows.Scan(&s.ID, &s.NISN, &s.FullName, &s.ClassName, &s.QRCode); err == nil {
			toAdd = append(toAdd, s)
		}
	}
	rows.Close()

	now := time.Now().UnixMilli()
	count := 0

	for _, s := range toAdd {
		var tabunganKelasID string
		err := tx.QueryRow("SELECT id FROM tabungan_kelas WHERE nama = ?", s.ClassName).Scan(&tabunganKelasID)
		if err != nil && err != sql.ErrNoRows {
			continue
		}

		if tabunganKelasID == "" {
			tabunganKelasID = cuid2.Generate()
			_, err = tx.Exec(`
				INSERT INTO tabungan_kelas (id, nama, wali_kelas, created_at, updated_at)
				VALUES (?, ?, '', ?, ?)
			`, tabunganKelasID, s.ClassName, now, now)
			if err != nil {
				continue
			}
		}

		id := cuid2.Generate()
		qrCode := "TAB-" + id
		if s.QRCode != "" {
			qrCode = s.QRCode
		}
		_, err = tx.Exec(`
			INSERT INTO tabungan_siswa (id, student_id, nisn, nama, kelas_id, saldo_terakhir, qr_code, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?)
		`, id, s.ID, s.NISN, s.FullName, tabunganKelasID, qrCode, now, now)
		if err == nil {
			count++
		}
	}

	return count, tx.Commit()
}
