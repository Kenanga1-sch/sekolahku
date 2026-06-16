package repository

import (
	"database/sql"
	"strings"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

func (r *EOfficeRepository) GetTemplateGroups() ([]models.LetterTemplateGroup, error) {
	rows, err := r.DB.Query("SELECT id, name, description, created_at, updated_at FROM letter_template_groups ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.LetterTemplateGroup
	for rows.Next() {
		var g models.LetterTemplateGroup
		var desc sql.NullString
		var crAt, upAt sql.NullInt64
		err := rows.Scan(&g.ID, &g.Name, &desc, &crAt, &upAt)
		if err != nil {
			return nil, err
		}
		if desc.Valid {
			g.Description = &desc.String
		}
		g.CreatedAt = SafeTime(crAt)
		g.UpdatedAt = SafeTime(upAt)
		
		// Fetch items
		items, _ := r.GetTemplateGroupItems(g.ID)
		g.Items = items

		groups = append(groups, g)
	}
	if groups == nil {
		groups = []models.LetterTemplateGroup{}
	}
	return groups, nil
}

func (r *EOfficeRepository) GetTemplateGroupItems(groupID string) ([]models.LetterTemplateGroupItem, error) {
	rows, err := r.DB.Query(`
		SELECT gi.group_id, gi.template_id, 
		       t.id, t.name, t.category, t.type, t.paper_size, t.orientation, t.classification_code
		FROM letter_template_group_items gi
		JOIN letter_templates t ON gi.template_id = t.id
		WHERE gi.group_id = ?
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.LetterTemplateGroupItem
	for rows.Next() {
		var item models.LetterTemplateGroupItem
		var t models.LetterTemplate
		var clsCode sql.NullString
		
		err := rows.Scan(
			&item.GroupID, &item.TemplateID,
			&t.ID, &t.Name, &t.Category, &t.Type, &t.PaperSize, &t.Orientation, &clsCode,
		)
		if err != nil {
			return nil, err
		}
		if clsCode.Valid {
			t.ClassificationCode = &clsCode.String
		}
		item.Template = &t
		items = append(items, item)
	}
	if items == nil {
		items = []models.LetterTemplateGroupItem{}
	}
	return items, nil
}

func (r *EOfficeRepository) GetTemplateGroupByID(id string) (*models.LetterTemplateGroup, error) {
	var g models.LetterTemplateGroup
	var desc sql.NullString
	var crAt, upAt sql.NullInt64
	err := r.DB.QueryRow("SELECT id, name, description, created_at, updated_at FROM letter_template_groups WHERE id = ?", id).
		Scan(&g.ID, &g.Name, &desc, &crAt, &upAt)
	if err != nil {
		return nil, err
	}
	if desc.Valid {
		g.Description = &desc.String
	}
	g.CreatedAt = SafeTime(crAt)
	g.UpdatedAt = SafeTime(upAt)
	
	items, _ := r.GetTemplateGroupItems(g.ID)
	g.Items = items

	return &g, nil
}

func (r *EOfficeRepository) CreateTemplateGroup(g models.LetterTemplateGroup) (string, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if g.ID == "" {
		g.ID = cuid2.Generate()
	}
	now := UnixMilli()
	
	_, err = tx.Exec(`
		INSERT INTO letter_template_groups (id, name, description, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, g.ID, g.Name, g.Description, now, now)
	if err != nil {
		return "", err
	}

	for _, item := range g.Items {
		_, err = tx.Exec(`
			INSERT INTO letter_template_group_items (group_id, template_id)
			VALUES (?, ?)
		`, g.ID, item.TemplateID)
		if err != nil {
			return "", err
		}
	}

	return g.ID, tx.Commit()
}

func (r *EOfficeRepository) UpdateTemplateGroup(id string, g models.LetterTemplateGroup) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	existing, err := r.GetTemplateGroupByID(id)
	if err != nil {
		return err
	}
	if strings.TrimSpace(g.Name) == "" {
		g.Name = existing.Name
	}
	if g.Description == nil {
		g.Description = existing.Description
	}

	now := UnixMilli()
	_, err = tx.Exec(`
		UPDATE letter_template_groups
		SET name = ?, description = ?, updated_at = ?
		WHERE id = ?
	`, g.Name, g.Description, now, id)
	if err != nil {
		return err
	}

	// Replace items
	_, err = tx.Exec("DELETE FROM letter_template_group_items WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	for _, item := range g.Items {
		_, err = tx.Exec(`
			INSERT INTO letter_template_group_items (group_id, template_id)
			VALUES (?, ?)
		`, id, item.TemplateID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *EOfficeRepository) DeleteTemplateGroup(id string) error {
	res, err := r.DB.Exec("DELETE FROM letter_template_groups WHERE id = ?", id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
