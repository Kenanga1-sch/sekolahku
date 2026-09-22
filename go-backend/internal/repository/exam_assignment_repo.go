package repository

import (
	"database/sql"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// ExamAssignmentRepository menangani penugasan paket ujian ke kelas.
type ExamAssignmentRepository struct {
	DB *sql.DB
}

func NewExamAssignmentRepository(db *sql.DB) *ExamAssignmentRepository {
	return &ExamAssignmentRepository{DB: db}
}

// ListBySet mengembalikan penugasan (dengan nama kelas) untuk satu paket.
func (r *ExamAssignmentRepository) ListBySet(setID string) ([]models.ExamAssignment, error) {
	rows, err := r.DB.Query(`
		SELECT ea.id, ea.set_id, ea.class_id, ea.assigned_by, ea.created_at, c.name AS class_name
		FROM exam_assignments ea
		LEFT JOIN student_classes c ON ea.class_id = c.id
		WHERE ea.set_id = ?
		ORDER BY c.name ASC
	`, setID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.ExamAssignment
	for rows.Next() {
		var a models.ExamAssignment
		var className sql.NullString
		var createdAt sql.NullInt64
		if err := rows.Scan(&a.ID, &a.SetID, &a.ClassID, &a.AssignedBy, &createdAt, &className); err != nil {
			return nil, err
		}
		if className.Valid {
			a.ClassName = &className.String
		}
		a.CreatedAt = SafeTime(createdAt)
		out = append(out, a)
	}
	return out, nil
}

// ReplaceForSet mengganti seluruh penugasan paket dengan daftar kelas baru.
func (r *ExamAssignmentRepository) ReplaceForSet(setID string, classIDs []string, assignedBy string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM exam_assignments WHERE set_id = ?", setID); err != nil {
		return err
	}

	now := nowMs()
	stmt, err := tx.Prepare("INSERT INTO exam_assignments (id, set_id, class_id, assigned_by, created_at) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, cid := range classIDs {
		if cid == "" {
			continue
		}
		if _, err := stmt.Exec(cuid2.Generate(), setID, cid, assignedBy, now); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// DeleteBySet menghapus semua penugasan sebuah paket.
func (r *ExamAssignmentRepository) DeleteBySet(setID string) error {
	_, err := r.DB.Exec("DELETE FROM exam_assignments WHERE set_id = ?", setID)
	return err
}
