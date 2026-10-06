package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

// ErrDuplicateCode menandai pelanggaran constraint UNIQUE pada kolom `code`
// (atau UNIQUE lain terkait) sehingga handler bisa memetakan ke HTTP 409.
var ErrDuplicateCode = errors.New("kode template sudah dipakai")

// isUniqueConstraintError mendeteksi error UNIQUE constraint dari driver.
// SQLite (mattn/modernc) memakai pesan "UNIQUE constraint failed"; varian lain
// (MySQL/Postgres) memakai frasa serupa — semuanya dicek agar portabel.
func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique constraint failed") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "duplicate entry") ||
		strings.Contains(msg, "duplicate key")
}

type ReportTemplateRepository struct {
	db *sql.DB
}

func NewReportTemplateRepository(db *sql.DB) *ReportTemplateRepository {
	return &ReportTemplateRepository{db: db}
}

const reportTemplateColumns = `id, code, name, category, module, description, paper_size, orientation, layout_json, file_path, kind, is_default, created_at, updated_at`

func scanReportTemplate(row interface {
	Scan(dest ...interface{}) error
}) (*models.ReportTemplate, error) {
	var t models.ReportTemplate
	var isDef int
	if err := row.Scan(&t.ID, &t.Code, &t.Name, &t.Category, &t.Module, &t.Description, &t.PaperSize, &t.Orientation, &t.LayoutJSON, &t.FilePath, &t.Kind, &isDef, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, err
	}
	t.IsDefault = isDef == 1
	return &t, nil
}

func (r *ReportTemplateRepository) GetAll(category string) ([]models.ReportTemplate, error) {
	query := `SELECT ` + reportTemplateColumns + ` FROM report_templates`
	var args []interface{}
	if category != "" {
		query += ` WHERE category = ?`
		args = append(args, category)
	}
	query += ` ORDER BY module ASC, category ASC, is_default DESC, name ASC`

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.ReportTemplate
	for rows.Next() {
		t, err := scanReportTemplate(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *t)
	}
	return list, nil
}

// GetByModule mengembalikan template yang diperuntukkan bagi modul tertentu,
// diurutkan agar template default tampil lebih dulu.
func (r *ReportTemplateRepository) GetByModule(module string) ([]models.ReportTemplate, error) {
	query := `SELECT ` + reportTemplateColumns + ` FROM report_templates WHERE module = ? ORDER BY is_default DESC, name ASC`
	rows, err := r.db.Query(query, module)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.ReportTemplate
	for rows.Next() {
		t, err := scanReportTemplate(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *t)
	}
	return list, nil
}

func (r *ReportTemplateRepository) GetByID(id int64) (*models.ReportTemplate, error) {
	query := `SELECT ` + reportTemplateColumns + ` FROM report_templates WHERE id = ?`
	t, err := scanReportTemplate(r.db.QueryRow(query, id))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return t, nil
}

func (r *ReportTemplateRepository) GetByCode(code string) (*models.ReportTemplate, error) {
	query := `SELECT ` + reportTemplateColumns + ` FROM report_templates WHERE code = ?`
	t, err := scanReportTemplate(r.db.QueryRow(query, code))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return t, nil
}

func (r *ReportTemplateRepository) Create(req *models.CreateReportTemplateRequest) (*models.ReportTemplate, error) {
	now := time.Now().Unix()
	isDefInt := 0
	if req.IsDefault {
		isDefInt = 1
	}
	module := req.Module
	if module == "" {
		module = "umum"
	}

	query := `INSERT INTO report_templates (code, name, category, module, description, paper_size, orientation, layout_json, file_path, kind, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	res, err := r.db.Exec(query, req.Code, req.Name, req.Category, module, req.Description, req.PaperSize, req.Orientation, req.LayoutJSON, req.FilePath, normalizeKind(req.Kind), isDefInt, now, now)
	if err != nil {
		if isUniqueConstraintError(err) {
			return nil, ErrDuplicateCode
		}
		return nil, fmt.Errorf("failed to create report template: %w", err)
	}

	id, _ := res.LastInsertId()
	return r.GetByID(id)
}

// Update menyimpan perubahan template. `code` diteruskan terpisah karena
// struktur UpdateReportTemplateRequest tidak memuat kolom code; nilainya
// diambil handler dari body request sehingga perubahan kode persisten.
func (r *ReportTemplateRepository) Update(id int64, req *models.UpdateReportTemplateRequest, code string) (*models.ReportTemplate, error) {
	now := time.Now().Unix()
	isDefInt := 0
	if req.IsDefault {
		isDefInt = 1
	}
	module := req.Module
	if module == "" {
		module = "umum"
	}

	query := `UPDATE report_templates SET code = ?, name = ?, category = ?, module = ?, description = ?, paper_size = ?, orientation = ?, layout_json = ?, file_path = ?, kind = ?, is_default = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.Exec(query, code, req.Name, req.Category, module, req.Description, req.PaperSize, req.Orientation, req.LayoutJSON, req.FilePath, normalizeKind(req.Kind), isDefInt, now, id)
	if err != nil {
		if isUniqueConstraintError(err) {
			return nil, ErrDuplicateCode
		}
		return nil, fmt.Errorf("failed to update report template: %w", err)
	}

	return r.GetByID(id)
}

// SetDefault menjadikan satu template sebagai default modulnya
// (menonaktifkan default lain di modul yang sama) lalu mengembalikannya.
func (r *ReportTemplateRepository) SetDefault(id int64) (*models.ReportTemplate, error) {
	tpl, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}
	if tpl == nil {
		return nil, sql.ErrNoRows
	}
	now := time.Now().Unix()
	if _, err := r.db.Exec(`UPDATE report_templates SET is_default = 0, updated_at = ? WHERE module = ? AND id <> ?`, now, tpl.Module, id); err != nil {
		return nil, fmt.Errorf("failed to clear module default: %w", err)
	}
	if _, err := r.db.Exec(`UPDATE report_templates SET is_default = 1, updated_at = ? WHERE id = ?`, now, id); err != nil {
		return nil, fmt.Errorf("failed to set default: %w", err)
	}
	return r.GetByID(id)
}

// GetDefaultModule mengembalikan template default sebuah modul (nil bila kosong).
func (r *ReportTemplateRepository) GetDefaultModule(module string) (*models.ReportTemplate, error) {
	query := `SELECT ` + reportTemplateColumns + ` FROM report_templates WHERE module = ? AND is_default = 1 ORDER BY id DESC LIMIT 1`
	t, err := scanReportTemplate(r.db.QueryRow(query, module))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return t, nil
}

// normalizeKind memetakan kind ke nilai yang diizinkan:
// "xlsx", "docx", atau "" (template grid lama). Nilai lain → "".
func normalizeKind(kind string) string {
	switch kind {
	case "xlsx", "docx":
		return kind
	default:
		return ""
	}
}

func (r *ReportTemplateRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM report_templates WHERE id = ?`, id)
	return err
}

// UpdateKind memperbarui jenis berkas template ("xlsx"/"docx"/"").
func (r *ReportTemplateRepository) UpdateKind(id int64, kind string) (*models.ReportTemplate, error) {
	now := time.Now().Unix()
	if _, err := r.db.Exec(`UPDATE report_templates SET kind = ?, updated_at = ? WHERE id = ?`, normalizeKind(kind), now, id); err != nil {
		return nil, fmt.Errorf("failed to update template kind: %w", err)
	}
	return r.GetByID(id)
}

// UpdateFilePath memperbarui penunjuk berkas template (relatif templates/).
func (r *ReportTemplateRepository) UpdateFilePath(id int64, rel string) (*models.ReportTemplate, error) {
	now := time.Now().Unix()
	if _, err := r.db.Exec(`UPDATE report_templates SET file_path = ?, updated_at = ? WHERE id = ?`, rel, now, id); err != nil {
		return nil, fmt.Errorf("failed to update template file_path: %w", err)
	}
	return r.GetByID(id)
}
