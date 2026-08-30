package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

func (r *LibraryRepository) HasVisitedToday(memberID string) (bool, error) {
	var count int
	err := r.DB.QueryRow(`
		SELECT COUNT(*)
		FROM library_visits
		WHERE member_id = ? AND date = ?
	`, memberID, time.Now().Format("2006-01-02")).Scan(&count)
	return count > 0, err
}

func (r *LibraryRepository) RecordVisit(memberId string) error {
	var exists int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM library_members WHERE id = ?", memberId).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return errors.New("anggota perpustakaan tidak ditemukan")
	}

	now := time.Now()
	date := now.Format("2006-01-02")
	timeStr := now.Format("15:04:05")
	id := cuid2.Generate()

	_, err := r.DB.Exec(`
		INSERT INTO library_visits (id, member_id, date, time, timestamp, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, memberId, date, timeStr, UnixMilli(), UnixMilli())
	return err
}

func (r *LibraryRepository) RecordGuestVisit(name, institution, purpose string) error {
	now := time.Now()
	date := now.Format("2006-01-02")
	timeStr := now.Format("15:04:05")
	id := cuid2.Generate()

	_, err := r.DB.Exec(`
		INSERT INTO library_visits (id, member_id, guest_name, guest_institution, guest_purpose, date, time, timestamp, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, "", name, institution, purpose, date, timeStr, UnixMilli(), UnixMilli())
	return err
}

func (r *LibraryRepository) GetVisits(date string, page, perPage int) ([]models.VisitDetail, int, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM library_visits WHERE date = ?", date).Scan(&total)

	query := `
		SELECT 
			v.id, v.member_id, v.guest_name, v.guest_institution, v.guest_purpose, v.date, v.time, v.created_at,
			COALESCE(st.full_name, u2.name, '') as member_name, COALESCE(st.class_name, '') as member_class
		FROM library_visits v
		LEFT JOIN library_members m ON v.member_id = m.id
		LEFT JOIN students st ON m.student_id = st.id
		LEFT JOIN users u2 ON m.user_id = u2.id
		WHERE v.date = ?
		ORDER BY v.created_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.DB.Query(query, date, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	results := make([]models.VisitDetail, 0)
	for rows.Next() {
		var id, date, timeStr sql.NullString
		var mId, gName, gInst, gPurp, mName, mClass sql.NullString
		var crAt sql.NullInt64

		if err := rows.Scan(&id, &mId, &gName, &gInst, &gPurp, &date, &timeStr, &crAt, &mName, &mClass); err != nil {
			return nil, 0, err
		}

		results = append(results, models.VisitDetail{
			ID:               id.String,
			MemberID:         mId.String,
			GuestName:        gName.String,
			GuestInstitution: gInst.String,
			GuestPurpose:     gPurp.String,
			Date:             date.String,
			Time:             timeStr.String,
			CreatedAt:        ToTime(crAt),
			MemberName:       mName.String,
			MemberClass:      mClass.String,
		})
	}
	return results, total, nil
}
