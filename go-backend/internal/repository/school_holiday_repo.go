package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/nrednav/cuid2"
)

type SchoolHoliday struct {
	ID          string `json:"id"`
	Date        string `json:"date"`
	Title       string `json:"title"`
	Description string `json:"description"`
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

type SchoolHolidayRepository struct {
	DB *sql.DB
}

func NewSchoolHolidayRepository(db *sql.DB) *SchoolHolidayRepository {
	return &SchoolHolidayRepository{DB: db}
}

func (r *SchoolHolidayRepository) List() ([]SchoolHoliday, error) {
	rows, err := r.DB.Query(`
		SELECT id, date, title, COALESCE(description, ''), created_at, updated_at
		FROM school_holidays ORDER BY date ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []SchoolHoliday{}
	for rows.Next() {
		var h SchoolHoliday
		if err := rows.Scan(&h.ID, &h.Date, &h.Title, &h.Description, &h.CreatedAt, &h.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, h)
	}
	return items, nil
}

func (r *SchoolHolidayRepository) Create(h SchoolHoliday) error {
	h.ID = cuid2.Generate()
	h.Date = strings.TrimSpace(h.Date)
	h.Title = strings.TrimSpace(h.Title)
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO school_holidays (id, date, title, description, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, h.ID, h.Date, h.Title, h.Description, now, now)
	return err
}

func (r *SchoolHolidayRepository) Delete(id string) error {
	res, err := r.DB.Exec("DELETE FROM school_holidays WHERE id = ?", id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err == nil && affected == 0 {
		return errors.New("hari libur tidak ditemukan")
	}
	return nil
}
