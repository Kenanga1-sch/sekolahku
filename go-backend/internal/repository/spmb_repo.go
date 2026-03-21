package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type SPMBRepository struct {
	DB *sql.DB
}

func NewSPMBRepository(db *sql.DB) *SPMBRepository {
	return &SPMBRepository{DB: db}
}

func (r *SPMBRepository) GetPeriods() ([]models.SPMBPeriod, error) {
	query := `
		SELECT p.id, p.name, p.academic_year, p.start_date, p.end_date, p.quota, p.is_active, p.created_at, p.updated_at,
		       COUNT(r.id) as registered
		FROM spmb_periods p
		LEFT JOIN spmb_registrants r ON p.id = r.period_id
		GROUP BY p.id
		ORDER BY p.created_at DESC
	`
	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var periods []models.SPMBPeriod
	for rows.Next() {
		var p models.SPMBPeriod
		var academicYear sql.NullString
		var sd, ed, created, updated sql.NullTime
		var quota sql.NullInt64
		var isActive sql.NullInt64
		var registered sql.NullInt64

		err := rows.Scan(
			&p.ID, &p.Name, &academicYear, &sd, &ed, &quota, &isActive, &created, &updated, &registered,
		)
		if err != nil {
			return nil, err
		}

		if academicYear.Valid { p.AcademicYear = academicYear.String }
		if sd.Valid { p.StartDate = &sd.Time }
		if ed.Valid { p.EndDate = &ed.Time }
		if quota.Valid { p.Quota = int(quota.Int64) }
		if isActive.Valid { p.IsActive = isActive.Int64 != 0 }
		if created.Valid { p.CreatedAt = &created.Time }
		if updated.Valid { p.UpdatedAt = &updated.Time }
		if registered.Valid { p.Registered = int(registered.Int64) }

		periods = append(periods, p)
	}

	if periods == nil {
		periods = []models.SPMBPeriod{}
	}

	return periods, nil
}

func (r *SPMBRepository) GetActivePeriod() (*models.SPMBPeriod, error) {
	query := `
		SELECT p.id, p.name, p.academic_year, p.start_date, p.end_date, p.quota, p.is_active, p.created_at, p.updated_at,
		       COUNT(r.id) as registered
		FROM spmb_periods p
		LEFT JOIN spmb_registrants r ON p.id = r.period_id
		WHERE p.is_active = 1
		GROUP BY p.id
		LIMIT 1
	`
	row := r.DB.QueryRow(query)

	var p models.SPMBPeriod
	var academicYear sql.NullString
	var sd, ed, created, updated sql.NullTime
	var quota sql.NullInt64
	var isActive sql.NullInt64
	var registered sql.NullInt64

	err := row.Scan(
		&p.ID, &p.Name, &academicYear, &sd, &ed, &quota, &isActive, &created, &updated, &registered,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Not found
		}
		return nil, err
	}

	if academicYear.Valid { p.AcademicYear = academicYear.String }
	if sd.Valid { p.StartDate = &sd.Time }
	if ed.Valid { p.EndDate = &ed.Time }
	if quota.Valid { p.Quota = int(quota.Int64) }
	if isActive.Valid { p.IsActive = isActive.Int64 != 0 }
	if created.Valid { p.CreatedAt = &created.Time }
	if updated.Valid { p.UpdatedAt = &updated.Time }
	if registered.Valid { p.Registered = int(registered.Int64) }

	return &p, nil
}

func (r *SPMBRepository) CreatePeriod(req models.CreateSPMBPeriodRequest, sd time.Time, ed time.Time, quotaInt int) (*models.SPMBPeriod, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	id := cuid2.Generate()
	isActiveInt := 0
	if req.IsActive {
		isActiveInt = 1
		// Deactivate others
		_, err := tx.Exec(`UPDATE spmb_periods SET is_active = 0`)
		if err != nil {
			return nil, err
		}
	}

	now := time.Now()
	query := `
		INSERT INTO spmb_periods (id, name, academic_year, start_date, end_date, quota, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = tx.Exec(query, id, req.Name, req.Name, sd, ed, quotaInt, isActiveInt, now, now)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &models.SPMBPeriod{
		ID:           id,
		Name:         req.Name,
		AcademicYear: req.Name,
		StartDate:    &sd,
		EndDate:      &ed,
		Quota:        quotaInt,
		IsActive:     req.IsActive,
		Registered:   0,
		CreatedAt:    &now,
		UpdatedAt:    &now,
	}, nil
}
