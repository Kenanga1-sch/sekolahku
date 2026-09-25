package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

type AIProviderRepository struct {
	db *sql.DB
}

func NewAIProviderRepository(db *sql.DB) *AIProviderRepository {
	return &AIProviderRepository{db: db}
}

func (r *AIProviderRepository) GetAll() ([]models.AIProvider, error) {
	rows, err := r.db.Query(`
		SELECT id, name, provider_type, base_url, model_name, api_key_env_var, api_key_value, is_enabled, priority, created_at, updated_at
		FROM ai_providers
		ORDER BY priority ASC, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.AIProvider
	for rows.Next() {
		var p models.AIProvider
		var isEn int
		if err := rows.Scan(&p.ID, &p.Name, &p.ProviderType, &p.BaseURL, &p.ModelName, &p.APIKeyEnvVar, &p.APIKeyValue, &isEn, &p.Priority, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.IsEnabled = isEn == 1
		// Mask plain API key for security display if set
		if p.APIKeyValue != "" {
			if len(p.APIKeyValue) > 8 {
				p.APIKeyValue = p.APIKeyValue[:4] + "..." + p.APIKeyValue[len(p.APIKeyValue)-4:]
			} else {
				p.APIKeyValue = "*****"
			}
		}
		list = append(list, p)
	}
	return list, nil
}

func (r *AIProviderRepository) GetEnabledProviders() ([]models.AIProvider, error) {
	rows, err := r.db.Query(`
		SELECT id, name, provider_type, base_url, model_name, api_key_env_var, api_key_value, priority, created_at, updated_at
		FROM ai_providers
		WHERE is_enabled = 1
		ORDER BY priority ASC, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.AIProvider
	for rows.Next() {
		var p models.AIProvider
		if err := rows.Scan(&p.ID, &p.Name, &p.ProviderType, &p.BaseURL, &p.ModelName, &p.APIKeyEnvVar, &p.APIKeyValue, &p.Priority, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.IsEnabled = true
		list = append(list, p)
	}
	return list, nil
}

func (r *AIProviderRepository) GetByID(id string) (*models.AIProvider, error) {
	var p models.AIProvider
	var isEn int
	err := r.db.QueryRow(`
		SELECT id, name, provider_type, base_url, model_name, api_key_env_var, api_key_value, is_enabled, priority, created_at, updated_at
		FROM ai_providers WHERE id = ?
	`, id).Scan(&p.ID, &p.Name, &p.ProviderType, &p.BaseURL, &p.ModelName, &p.APIKeyEnvVar, &p.APIKeyValue, &isEn, &p.Priority, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	p.IsEnabled = isEn == 1
	return &p, nil
}

func (r *AIProviderRepository) Create(req models.AIProviderRequest) (*models.AIProvider, error) {
	now := time.Now().UnixMilli()
	id := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(req.Name), " ", "_"))
	if req.ID != "" {
		id = req.ID
	}
	isEn := 0
	if req.IsEnabled {
		isEn = 1
	}

	_, err := r.db.Exec(`
		INSERT INTO ai_providers (id, name, provider_type, base_url, model_name, api_key_env_var, api_key_value, is_enabled, priority, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.Name, req.ProviderType, req.BaseURL, req.ModelName, req.APIKeyEnvVar, req.APIKeyValue, isEn, req.Priority, now, now)

	if err != nil {
		return nil, fmt.Errorf("gagal membuat provider AI: %w", err)
	}

	return r.GetByID(id)
}

func (r *AIProviderRepository) Update(id string, req models.AIProviderRequest) (*models.AIProvider, error) {
	now := time.Now().UnixMilli()
	isEn := 0
	if req.IsEnabled {
		isEn = 1
	}

	existing, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	// Preserve key if empty in update
	apiKeyVal := req.APIKeyValue
	if apiKeyVal == "" || strings.Contains(apiKeyVal, "...") {
		apiKeyVal = existing.APIKeyValue
	}

	_, err = r.db.Exec(`
		UPDATE ai_providers
		SET name=?, provider_type=?, base_url=?, model_name=?, api_key_env_var=?, api_key_value=?, is_enabled=?, priority=?, updated_at=?
		WHERE id=?
	`, req.Name, req.ProviderType, req.BaseURL, req.ModelName, req.APIKeyEnvVar, apiKeyVal, isEn, req.Priority, now, id)

	if err != nil {
		return nil, fmt.Errorf("gagal mengupdate provider AI: %w", err)
	}

	return r.GetByID(id)
}

func (r *AIProviderRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM ai_providers WHERE id = ?", id)
	return err
}
