package repository

import (
	"database/sql"
	"strings"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

func (r *LibraryRepository) GetLoanReport(startDate, endDate string, limit int) ([]models.LoanReportItem, error) {
	startMs, endMs := reportDateRangeMillis(startDate, endDate)
	if limit < 1 || limit > 5000 {
		limit = 1000
	}
	rows, err := r.DB.Query(`
		SELECT
			l.id, COALESCE(st.full_name, mst.name, m.id), COALESCE(st.class_name, ''), c.title,
			l.borrow_date, l.due_date, l.return_date, l.is_returned, l.fine_amount
		FROM library_loans l
		JOIN library_members m ON l.member_id = m.id
		LEFT JOIN students st ON m.student_id = st.id
		LEFT JOIN users mst ON m.user_id = mst.id
		JOIN library_assets a ON l.item_id = a.id
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE l.borrow_date BETWEEN ? AND ?
		ORDER BY l.borrow_date DESC
		LIMIT ?
	`, startMs, endMs, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.LoanReportItem, 0)
	for rows.Next() {
		var id, memberName, itemTitle string
		var memberClass sql.NullString
		var borrowDate, dueDate, returnDate sql.NullInt64
		var isReturned int
		var fineAmount int
		if err := rows.Scan(&id, &memberName, &memberClass, &itemTitle, &borrowDate, &dueDate, &returnDate, &isReturned, &fineAmount); err != nil {
			return nil, err
		}
		item := models.LoanReportItem{
			ID:          id,
			MemberName:  memberName,
			MemberClass: memberClass.String,
			ItemTitle:   itemTitle,
			BorrowDate:  ToTime(borrowDate),
			DueDate:     ToTime(dueDate),
			IsReturned:  isReturned == 1,
			FineAmount:  fineAmount,
		}
		if returnDate.Valid && returnDate.Int64 > 0 {
			item.ReturnDate = ToTime(returnDate)
		}
		results = append(results, item)
	}
	return results, nil
}

func (r *LibraryRepository) GetVisitReport(startDate, endDate string, limit int) ([]models.VisitReportItem, error) {
	startDate, endDate = reportDateRangeText(startDate, endDate)
	if limit < 1 || limit > 5000 {
		limit = 1000
	}
	rows, err := r.DB.Query(`
		SELECT
			v.id,
			COALESCE(NULLIF(v.guest_name, ''), st.full_name, u3.name, 'Tamu') AS visitor_name,
			COALESCE(st.class_name, ''),
			v.date,
			v.timestamp,
			v.created_at
		FROM library_visits v
		LEFT JOIN library_members m ON v.member_id = m.id
		LEFT JOIN students st ON m.student_id = st.id
		LEFT JOIN users u3 ON m.user_id = u3.id
		WHERE v.date BETWEEN ? AND ?
		ORDER BY v.date DESC, v.timestamp DESC, v.created_at DESC
		LIMIT ?
	`, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.VisitReportItem, 0)
	for rows.Next() {
		var id, visitorName, date string
		var memberClass sql.NullString
		var timestamp, createdAt sql.NullInt64
		if err := rows.Scan(&id, &visitorName, &memberClass, &date, &timestamp, &createdAt); err != nil {
			return nil, err
		}
		visitTime := timestamp
		if !visitTime.Valid || visitTime.Int64 <= 0 {
			visitTime = createdAt
		}
		results = append(results, models.VisitReportItem{
			ID:          id,
			MemberName:  visitorName,
			MemberClass: memberClass.String,
			Date:        date,
			Timestamp:   ToTime(visitTime),
		})
	}
	return results, nil
}

func (r *LibraryRepository) GetOverdueReport() ([]models.LoanDetail, error) {
	loans, _, err := r.GetLoans("overdue", 1, 1000)
	return loans, err
}

func (r *LibraryRepository) GetInventoryReport() (*models.InventoryReport, error) {
	total := 0
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM library_assets").Scan(&total); err != nil {
		return nil, err
	}

	byStatus := map[string]int{
		"AVAILABLE": 0,
		"BORROWED":  0,
		"DAMAGED":   0,
		"LOST":      0,
	}
	statusRows, err := r.DB.Query("SELECT status, COUNT(*) FROM library_assets GROUP BY status")
	if err != nil {
		return nil, err
	}
	defer statusRows.Close()
	for statusRows.Next() {
		var status string
		var count int
		if err := statusRows.Scan(&status, &count); err != nil {
			return nil, err
		}
		byStatus[status] = count
	}

	byCategory := make(map[string]int)
	categoryRows, err := r.DB.Query(`
		SELECT COALESCE(NULLIF(c.category, ''), 'OTHER'), COUNT(*)
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		GROUP BY COALESCE(NULLIF(c.category, ''), 'OTHER')
	`)
	if err != nil {
		return nil, err
	}
	defer categoryRows.Close()
	for categoryRows.Next() {
		var category string
		var count int
		if err := categoryRows.Scan(&category, &count); err != nil {
			return nil, err
		}
		byCategory[category] = count
	}

	return &models.InventoryReport{
		Total:      total,
		ByStatus:   byStatus,
		ByCategory: byCategory,
	}, nil
}

func reportDateRangeMillis(startDate, endDate string) (int64, int64) {
	startText, endText := reportDateRangeText(startDate, endDate)
	start, _ := time.ParseInLocation("2006-01-02", startText, time.Local)
	end, _ := time.ParseInLocation("2006-01-02", endText, time.Local)
	return start.UnixMilli(), end.AddDate(0, 0, 1).Add(-time.Millisecond).UnixMilli()
}

func reportDateRangeText(startDate, endDate string) (string, string) {
	now := time.Now()
	if strings.TrimSpace(endDate) == "" {
		endDate = now.Format("2006-01-02")
	}
	if strings.TrimSpace(startDate) == "" {
		startDate = now.AddDate(0, 0, -30).Format("2006-01-02")
	}
	return startDate, endDate
}
