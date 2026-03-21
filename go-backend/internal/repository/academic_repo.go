package repository

import (
	"database/sql"
	"errors"
)

type AcademicRepository struct {
	DB *sql.DB
}

func NewAcademicRepository(db *sql.DB) *AcademicRepository {
	return &AcademicRepository{DB: db}
}

// GetActiveAcademicYear returns the active academic year string name (e.g. "2024/2025")
func (r *AcademicRepository) GetActiveAcademicYear() (string, error) {
	// 1. Try to find active academic year in academic_years table
	query := `SELECT name FROM academic_years WHERE is_active = 1 LIMIT 1`
	var activeYearName string
	err := r.DB.QueryRow(query).Scan(&activeYearName)
	
	if err == nil {
		return activeYearName, nil
	}
	
	// If the error is not "no rows in result set", something went wrong with DB
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	// 2. Fallback to school_settings
	queryFallback := `SELECT current_academic_year FROM school_settings LIMIT 1`
	var currentAcademicYear sql.NullString
	err = r.DB.QueryRow(queryFallback).Scan(&currentAcademicYear)
	
	if err == nil && currentAcademicYear.Valid {
		return currentAcademicYear.String, nil
	}
	
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	// 3. Final Fallback
	return "2024/2025", nil
}
