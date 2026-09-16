package repository

import (
	"database/sql"
	"strings"
	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type KurikulumRepository struct {
	DB *sql.DB
}

func NewKurikulumRepository(db *sql.DB) *KurikulumRepository {
	return &KurikulumRepository{DB: db}
}

func (r *KurikulumRepository) genID() string {
	return cuid2.Generate()
}

func (r *KurikulumRepository) List(onlyActive bool) ([]models.Kurikulum, error) {
	where := ""
	if onlyActive {
		where = "WHERE is_active = 1"
	}
	rows, err := r.DB.Query(`
		SELECT id, name, description, is_active, created_at, updated_at
		FROM kurikulum ` + where + ` ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Kurikulum
	for rows.Next() {
		var k models.Kurikulum
		var desc sql.NullString
		var isActive int
		var createdAt, updatedAt sql.NullInt64
		if err := rows.Scan(&k.ID, &k.Name, &desc, &isActive, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		if desc.Valid {
			k.Description = &desc.String
		}
		k.IsActive = isActive == 1
		k.CreatedAt = SafeTime(createdAt)
		k.UpdatedAt = SafeTime(updatedAt)
		list = append(list, k)
	}
	return list, nil
}

func (r *KurikulumRepository) Get(id string) (*models.Kurikulum, error) {
	var k models.Kurikulum
	var desc sql.NullString
	var isActive int
	var createdAt, updatedAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT id, name, description, is_active, created_at, updated_at
		FROM kurikulum WHERE id = ?
	`, id).Scan(&k.ID, &k.Name, &desc, &isActive, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	if desc.Valid {
		k.Description = &desc.String
	}
	k.IsActive = isActive == 1
	k.CreatedAt = SafeTime(createdAt)
	k.UpdatedAt = SafeTime(updatedAt)
	return &k, nil
}

func (r *KurikulumRepository) Create(req *models.CreateKurikulumRequest) (*models.Kurikulum, error) {
	id := r.genID()
	now := nowMs()
	isActive := 1
	if req.IsActive != nil && !*req.IsActive {
		isActive = 0
	}
	_, err := r.DB.Exec(`
		INSERT INTO kurikulum (id, name, description, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, req.Name, req.Description, isActive, now, now)
	if err != nil {
		return nil, err
	}
	return r.Get(id)
}

func (r *KurikulumRepository) Update(id string, req *models.UpdateKurikulumRequest) (*models.Kurikulum, error) {
	sets := []string{"updated_at = ?"}
	args := []interface{}{nowMs()}

	if req.Name != nil {
		sets = append(sets, "name = ?")
		args = append(args, *req.Name)
	}
	if req.Description != nil {
		sets = append(sets, "description = ?")
		args = append(args, *req.Description)
	}
	if req.IsActive != nil {
		sets = append(sets, "is_active = ?")
		v := 0
		if *req.IsActive {
			v = 1
		}
		args = append(args, v)
	}

	args = append(args, id)
	_, err := r.DB.Exec("UPDATE kurikulum SET "+strings.Join(sets, ", ")+" WHERE id = ?", args...)
	if err != nil {
		return nil, err
	}
	return r.Get(id)
}

func (r *KurikulumRepository) Delete(id string) error {
	_, err := r.DB.Exec("DELETE FROM kurikulum WHERE id = ?", id)
	return err
}
