package repository

import (
	"database/sql"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type FAQRepository struct {
	DB *sql.DB
}

func NewFAQRepository(db *sql.DB) *FAQRepository {
	return &FAQRepository{DB: db}
}

func (r *FAQRepository) GetPublicFAQs() ([]models.FAQ, error) {
	query := `SELECT id, category, question, answer, order_rank, is_active, created_at, updated_at FROM faqs WHERE is_active = 1 ORDER BY category, order_rank ASC`
	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.FAQ
	for rows.Next() {
		var f models.FAQ
		var ca, ua sql.NullInt64
		var active int
		if err := rows.Scan(&f.ID, &f.Category, &f.Question, &f.Answer, &f.OrderRank, &active, &ca, &ua); err != nil {
			return nil, err
		}
		f.IsActive = active == 1
		f.CreatedAt = SafeTime(ca)
		f.UpdatedAt = SafeTime(ua)
		list = append(list, f)
	}
	return list, nil
}

func (r *FAQRepository) CreateFAQ(req models.CreateFAQRequest) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	query := `INSERT INTO faqs (id, category, question, answer, order_rank, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
	_, err := r.DB.Exec(query, id, req.Category, req.Question, req.Answer, req.OrderRank, now, now)
	return id, err
}

func (r *FAQRepository) UpdateFAQ(id string, req models.UpdateFAQRequest) error {
	now := time.Now().UnixMilli()
	query := `UPDATE faqs SET `
	var params []interface{}

	if req.Category != nil {
		query += `category = ?, `
		params = append(params, *req.Category)
	}
	if req.Question != nil {
		query += `question = ?, `
		params = append(params, *req.Question)
	}
	if req.Answer != nil {
		query += `answer = ?, `
		params = append(params, *req.Answer)
	}
	if req.OrderRank != nil {
		query += `order_rank = ?, `
		params = append(params, *req.OrderRank)
	}
	if req.IsActive != nil {
		active := 0
		if *req.IsActive { active = 1 }
		query += `is_active = ?, `
		params = append(params, active)
	}

	query += `updated_at = ? WHERE id = ?`
	params = append(params, now, id)

	_, err := r.DB.Exec(query, params...)
	return err
}

func (r *FAQRepository) DeleteFAQ(id string) error {
	_, err := r.DB.Exec(`DELETE FROM faqs WHERE id = ?`, id)
	return err
}
