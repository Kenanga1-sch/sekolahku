package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// SavingsGTKRepository mengelola rekening tabungan GTK (guru & tenaga
// kependidikan) — terpisah dari tabungan_siswa. Ringkas: saldo + setor/tarik +
// rekap, tanpa brankas/hutang/kelas milik modul siswa.
type SavingsGTKRepository struct {
	DB *sql.DB
}

func NewSavingsGTKRepository(db *sql.DB) *SavingsGTKRepository {
	return &SavingsGTKRepository{DB: db}
}

const gtkBaseQuery = `
	SELECT tg.id, tg.employee_id, COALESCE(ed.name, ''), COALESCE(ed.category, ''),
	       COALESCE(ed.qr_code, ''), tg.saldo_terakhir, tg.created_at, tg.updated_at
	FROM tabungan_gtk tg
	JOIN employee_details ed ON tg.employee_id = ed.id
`

func scanGtk(scanner interface{ Scan(dest ...interface{}) error }) (*models.TabunganGTK, error) {
	var g models.TabunganGTK
	var crAt, upAt sql.NullInt64
	if err := scanner.Scan(&g.ID, &g.EmployeeID, &g.Nama, &g.Kategori, &g.QRCode,
		&g.SaldoTerakhir, &crAt, &upAt); err != nil {
		return nil, err
	}
	if crAt.Valid {
		t := ToTime(crAt)
		g.CreatedAt = &t
	}
	if upAt.Valid {
		t := ToTime(upAt)
		g.UpdatedAt = &t
	}
	return &g, nil
}

// EnsureGtk membuat baris tabungan_gtk untuk GTK aktif bila belum ada.
// Idempoten — dipanggil tiap kali kartu GTK di-scan.
func (r *SavingsGTKRepository) EnsureGtk(employeeID string) error {
	employeeID = strings.TrimSpace(employeeID)
	if employeeID == "" {
		return nil
	}
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO tabungan_gtk (id, employee_id, saldo_terakhir, created_at, updated_at)
		SELECT ?, ?, 0, ?, ?
		WHERE EXISTS (SELECT 1 FROM employee_details WHERE id = ?)
		  AND NOT EXISTS (SELECT 1 FROM tabungan_gtk WHERE employee_id = ?)
	`, "gtksav_"+employeeID, employeeID, now, now, employeeID, employeeID)
	return err
}

// GetGtkByEmployee mengambil rekening GTK berdasarkan employee_id (tanpa auto-create).
func (r *SavingsGTKRepository) GetGtkByEmployee(employeeID string) (*models.TabunganGTK, error) {
	return scanGtk(r.DB.QueryRow(gtkBaseQuery+" WHERE tg.employee_id = ?", employeeID))
}

// GetGtkByQR resolve kode scan (QR/NIP/NUPTK/id) → rekening GTK, auto-create bila aktif.
// Mengembalikan (nil, nil) bila bukan GTK yang dikenal.
func (r *SavingsGTKRepository) GetGtkByQR(code string) (*models.TabunganGTK, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, nil
	}
	var employeeID string
	err := r.DB.QueryRow(`
		SELECT id FROM employee_details
		WHERE qr_code = ? OR nip = ? OR nuptk = ? OR id = ?
		LIMIT 1
	`, code, code, code, code).Scan(&employeeID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if err := r.EnsureGtk(employeeID); err != nil {
		return nil, err
	}
	return r.GetGtkByEmployee(employeeID)
}

// GetGtkDetail mengambil satu rekening + daftar transaksi terakhir.
func (r *SavingsGTKRepository) GetGtkDetail(gtkID string) (*models.TabunganGTK, []models.TabunganGTKTransaksi, error) {
	g, err := scanGtk(r.DB.QueryRow(gtkBaseQuery+" WHERE tg.id = ?", gtkID))
	if err != nil {
		return nil, nil, err
	}
	rows, err := r.DB.Query(`
		SELECT id, gtk_id, COALESCE(user_id,''), tipe, nominal, status, catatan, created_at
		FROM tabungan_gtk_transaksi WHERE gtk_id = ?
		ORDER BY created_at DESC LIMIT 100
	`, gtkID)
	if err != nil {
		return g, nil, err
	}
	defer rows.Close()
	tx := []models.TabunganGTKTransaksi{}
	for rows.Next() {
		var t models.TabunganGTKTransaksi
		var cat sql.NullString
		var crAt sql.NullInt64
		if err := rows.Scan(&t.ID, &t.GtkID, &t.UserID, &t.Tipe, &t.Nominal, &t.Status, &cat, &crAt); err != nil {
			return g, nil, err
		}
		if cat.Valid {
			t.Catatan = &cat.String
		}
		if crAt.Valid {
			tt := ToTime(crAt)
			t.CreatedAt = &tt
		}
		tx = append(tx, t)
	}
	return g, tx, rows.Err()
}

// GetGtkList daftar rekening GTK (untuk rekap di modul tabungan).
func (r *SavingsGTKRepository) GetGtkList(search string, limit, offset int) ([]models.TabunganGTK, int, error) {
	where := "WHERE 1=1"
	var args []interface{}
	if search = strings.TrimSpace(search); search != "" {
		where += " AND (COALESCE(ed.name,'') LIKE ? OR COALESCE(ed.nip,'') LIKE ? OR COALESCE(ed.qr_code,'') LIKE ?)"
		s := "%" + search + "%"
		args = append(args, s, s, s)
	}
	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_gtk tg JOIN employee_details ed ON tg.employee_id = ed.id "+where, args...).Scan(&total)

	rows, err := r.DB.Query(gtkBaseQuery+where+" ORDER BY ed.name ASC LIMIT ? OFFSET ?", append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []models.TabunganGTK{}
	for rows.Next() {
		g, err := scanGtk(rows)
		if err != nil {
			return nil, 0, err
		}
		list = append(list, *g)
	}
	return list, total, rows.Err()
}

// CreateGtkTransaksi mencatat setor/tarik dan memperbarui saldo (langsung,
// tanpa antrean verifikasi). Tarik ditolak bila saldo kurang.
func (r *SavingsGTKRepository) CreateGtkTransaksi(req models.CreateGtkTransaksiRequest) (*models.TabunganGTK, error) {
	tipe := strings.ToLower(strings.TrimSpace(req.Tipe))
	if tipe != "setor" && tipe != "tarik" {
		return nil, errors.New("tipe harus setor atau tarik")
	}
	if req.Nominal < 1000 {
		return nil, errors.New("minimal nominal Rp1.000")
	}
	if req.Nominal > 10000000 {
		return nil, errors.New("maksimal nominal Rp10.000.000")
	}

	// Resolve employee → gtk (auto-create bila perlu).
	g, err := r.GetGtkByQR(req.Code)
	if err != nil {
		return nil, err
	}
	if g == nil {
		if strings.TrimSpace(req.EmployeeID) == "" {
			return nil, errors.New("GTK tidak ditemukan")
		}
		if err := r.EnsureGtk(req.EmployeeID); err != nil {
			return nil, err
		}
		g, err = r.GetGtkByEmployee(req.EmployeeID)
		if err != nil {
			return nil, err
		}
	}

	if tipe == "tarik" && g.SaldoTerakhir < req.Nominal {
		return nil, errors.New("saldo tidak mencukupi")
	}

	delta := req.Nominal
	if tipe == "tarik" {
		delta = -req.Nominal
	}
	now := UnixMilli()
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(`
		UPDATE tabungan_gtk SET saldo_terakhir = saldo_terakhir + ?, updated_at = ? WHERE id = ?
	`, delta, now, g.ID); err != nil {
		tx.Rollback()
		return nil, err
	}
	if _, err := tx.Exec(`
		INSERT INTO tabungan_gtk_transaksi (id, gtk_id, user_id, tipe, nominal, status, catatan, created_at)
		VALUES (?, ?, ?, ?, ?, 'posted', ?, ?)
	`, cuid2.Generate(), g.ID, req.UserID, tipe, req.Nominal, req.Catatan, now); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetGtkByEmployee(g.EmployeeID)
}
