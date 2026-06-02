package repository

import (
	"database/sql"
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

type DashboardRepository struct {
	DB        *sql.DB
	StartTime time.Time
}

func NewDashboardRepository(db *sql.DB, startTime time.Time) *DashboardRepository {
	return &DashboardRepository{
		DB:        db,
		StartTime: startTime,
	}
}

func (r *DashboardRepository) GetDashboardStats() (*models.DashboardStats, error) {
	stats := &models.DashboardStats{
		Success: true,
	}

	// 1. SPMB Stats
	_ = r.DB.QueryRow(`
		SELECT 
			COUNT(*),
			COALESCE(SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'pending' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'verified' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'accepted' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'rejected' THEN 1 ELSE 0 END), 0)
		FROM spmb_registrants
		WHERE COALESCE(is_active, 1) = 1
	`).Scan(
		&stats.SPMB.TotalRegistrants,
		&stats.SPMB.PendingRegistrants,
		&stats.SPMB.VerifiedRegistrants,
		&stats.SPMB.AcceptedRegistrants,
		&stats.SPMB.RejectedRegistrants,
	)

	// 2. Library Stats
	r.DB.QueryRow("SELECT COUNT(*) FROM library_assets").Scan(&stats.ModuleStats.Perpustakaan.TotalBooks)
	r.DB.QueryRow("SELECT COUNT(*) FROM library_loans WHERE is_returned = 0").Scan(&stats.ModuleStats.Perpustakaan.ActiveLoans)
	nowMs := time.Now().UnixMilli()
	r.DB.QueryRow("SELECT COUNT(*) FROM library_loans WHERE is_returned = 0 AND due_date < ?", nowMs).Scan(&stats.ModuleStats.Perpustakaan.OverdueLoans)

	// 3. Inventory Stats
	r.DB.QueryRow("SELECT COUNT(*) FROM inventory_assets WHERE status = 'ACTIVE'").Scan(&stats.ModuleStats.Inventaris.TotalAssets)
	r.DB.QueryRow("SELECT COUNT(*) FROM inventory_rooms").Scan(&stats.ModuleStats.Inventaris.TotalRooms)
	r.DB.QueryRow("SELECT COALESCE(SUM(condition_light_damaged + condition_heavy_damaged), 0) FROM inventory_assets WHERE status = 'ACTIVE'").Scan(&stats.ModuleStats.Inventaris.NeedsMaintenance)

	// 4. Savings Stats
	r.DB.QueryRow("SELECT COALESCE(SUM(saldo_terakhir), 0) FROM tabungan_siswa WHERE is_active = 1").Scan(&stats.ModuleStats.Tabungan.TotalSaldo)
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_siswa WHERE is_active = 1").Scan(&stats.ModuleStats.Tabungan.TotalStudents)

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).UnixMilli()
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_transaksi WHERE created_at >= ?", todayStart).Scan(&stats.ModuleStats.Tabungan.TodayTransactions)

	// 5. Registration trend
	stats.RegistrationTrend = []models.RegistrationTrendPoint{}
	startDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, -6)
	for i := 0; i < 7; i++ {
		day := startDay.AddDate(0, 0, i)
		var count int
		_ = r.DB.QueryRow(`
			SELECT COUNT(*)
			FROM spmb_registrants
			WHERE COALESCE(is_active, 1) = 1
			  AND created_at >= ?
			  AND created_at < ?
		`, day.UnixMilli(), day.AddDate(0, 0, 1).UnixMilli()).Scan(&count)
		stats.RegistrationTrend = append(stats.RegistrationTrend, models.RegistrationTrendPoint{
			Date:  day.Format("2006-01-02"),
			Count: count,
		})
	}

	// 6. Recent Registrants
	regRows, err := r.DB.Query(`
		SELECT id, registration_number, full_name, status, created_at
		FROM spmb_registrants
		WHERE COALESCE(is_active, 1) = 1
		ORDER BY created_at DESC
		LIMIT 5
	`)
	if err == nil {
		defer regRows.Close()
		for regRows.Next() {
			var reg models.SPMBRegistrant
			var createdAt sql.NullInt64
			err := regRows.Scan(&reg.ID, &reg.RegistrationNumber, &reg.FullName, &reg.Status, &createdAt)
			if err == nil {
				if createdAt.Valid {
					reg.CreatedAt = createdAt.Int64
				}
				stats.RecentRegistrants = append(stats.RecentRegistrants, reg)
			}
		}
	}
	if stats.RecentRegistrants == nil {
		stats.RecentRegistrants = []models.SPMBRegistrant{}
	}

	// 7. Active Period
	activePeriodQuery := `
		SELECT id, name, academic_year, start_date, end_date, quota, status
		FROM spmb_periods
		WHERE status = 'active'
		LIMIT 1
	`
	var p models.SPMBPeriod
	var sd, ed sql.NullInt64
	err = r.DB.QueryRow(activePeriodQuery).Scan(&p.ID, &p.Name, &p.AcademicYear, &sd, &ed, &p.Quota, &p.Status)
	if err == nil {
		p.StartDate = SafeTime(sd)
		p.EndDate = SafeTime(ed)
		p.IsActive = p.Status == "active"
		_ = r.DB.QueryRow(`
			SELECT COUNT(*)
			FROM spmb_registrants
			WHERE period_id = ? AND COALESCE(is_active, 1) = 1
		`, p.ID).Scan(&p.Registered)
		stats.ActivePeriod = &p
	}

	return stats, nil
}

func (r *DashboardRepository) GetSystemHealth() (*models.SystemHealth, error) {
	health := &models.SystemHealth{
		Success: true,
	}

	// 1. Database Info
	health.Database.Status = "Online"

	dbFile := "data/sekolahku.db"
	fileInfo, err := os.Stat(dbFile)
	if err == nil {
		sizeMB := float64(fileInfo.Size()) / (1024 * 1024)
		health.Database.FormattedSize = fmt.Sprintf("%.2f MB", sizeMB)
	} else {
		health.Database.FormattedSize = "Unknown"
	}

	// 2. System Metrics
	health.System.UptimeSeconds = int64(time.Since(r.StartTime).Seconds())

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	health.System.MemoryUsageMB = float64(m.Alloc) / (1024 * 1024)

	// 3. Backup Info
	health.Backup.LastBackup = nil

	return health, nil
}
