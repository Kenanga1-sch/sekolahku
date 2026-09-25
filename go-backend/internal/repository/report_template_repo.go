package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

type ReportTemplateRepository struct {
	db *sql.DB
}

func NewReportTemplateRepository(db *sql.DB) *ReportTemplateRepository {
	return &ReportTemplateRepository{db: db}
}

func (r *ReportTemplateRepository) GetAll(category string) ([]models.ReportTemplate, error) {
	query := `SELECT id, code, name, category, description, paper_size, orientation, layout_json, is_default, created_at, updated_at FROM report_templates`
	var args []interface{}
	if category != "" {
		query += ` WHERE category = ?`
		args = append(args, category)
	}
	query += ` ORDER BY category ASC, is_default DESC, name ASC`

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.ReportTemplate
	for rows.Next() {
		var t models.ReportTemplate
		var isDef int
		err := rows.Scan(&t.ID, &t.Code, &t.Name, &t.Category, &t.Description, &t.PaperSize, &t.Orientation, &t.LayoutJSON, &isDef, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return nil, err
		}
		t.IsDefault = isDef == 1
		list = append(list, t)
	}
	return list, nil
}

func (r *ReportTemplateRepository) GetByID(id int64) (*models.ReportTemplate, error) {
	query := `SELECT id, code, name, category, description, paper_size, orientation, layout_json, is_default, created_at, updated_at FROM report_templates WHERE id = ?`
	row := r.db.QueryRow(query, id)

	var t models.ReportTemplate
	var isDef int
	err := row.Scan(&t.ID, &t.Code, &t.Name, &t.Category, &t.Description, &t.PaperSize, &t.Orientation, &t.LayoutJSON, &isDef, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	t.IsDefault = isDef == 1
	return &t, nil
}

func (r *ReportTemplateRepository) GetByCode(code string) (*models.ReportTemplate, error) {
	query := `SELECT id, code, name, category, description, paper_size, orientation, layout_json, is_default, created_at, updated_at FROM report_templates WHERE code = ?`
	row := r.db.QueryRow(query, code)

	var t models.ReportTemplate
	var isDef int
	err := row.Scan(&t.ID, &t.Code, &t.Name, &t.Category, &t.Description, &t.PaperSize, &t.Orientation, &t.LayoutJSON, &isDef, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	t.IsDefault = isDef == 1
	return &t, nil
}

func (r *ReportTemplateRepository) Create(req *models.CreateReportTemplateRequest) (*models.ReportTemplate, error) {
	now := time.Now().Unix()
	isDefInt := 0
	if req.IsDefault {
		isDefInt = 1
	}

	query := `INSERT INTO report_templates (code, name, category, description, paper_size, orientation, layout_json, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	res, err := r.db.Exec(query, req.Code, req.Name, req.Category, req.Description, req.PaperSize, req.Orientation, req.LayoutJSON, isDefInt, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create report template: %w", err)
	}

	id, _ := res.LastInsertId()
	return r.GetByID(id)
}

func (r *ReportTemplateRepository) Update(id int64, req *models.UpdateReportTemplateRequest) (*models.ReportTemplate, error) {
	now := time.Now().Unix()
	isDefInt := 0
	if req.IsDefault {
		isDefInt = 1
	}

	query := `UPDATE report_templates SET name = ?, category = ?, description = ?, paper_size = ?, orientation = ?, layout_json = ?, is_default = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.Exec(query, req.Name, req.Category, req.Description, req.PaperSize, req.Orientation, req.LayoutJSON, isDefInt, now, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update report template: %w", err)
	}

	return r.GetByID(id)
}

func (r *ReportTemplateRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM report_templates WHERE id = ?`, id)
	return err
}
