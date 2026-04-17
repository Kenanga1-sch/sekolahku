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
			COUNT(*) as total,
			SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
			SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
			SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted
		FROM spmb_registrants
	`).Scan(&stats.SPMB.TotalRegistrants, &stats.SPMB.PendingRegistrants, &stats.SPMB.VerifiedRegistrants, &stats.SPMB.AcceptedRegistrants)

	// 2. Library Stats
	r.DB.QueryRow("SELECT COUNT(*) FROM library_assets").Scan(&stats.ModuleStats.Perpustakaan.TotalBooks)
	r.DB.QueryRow("SELECT COUNT(*) FROM library_loans WHERE is_returned = 0").Scan(&stats.ModuleStats.Perpustakaan.ActiveLoans)
	nowMs := time.Now().UnixMilli()
	r.DB.QueryRow("SELECT COUNT(*) FROM library_loans WHERE is_returned = 0 AND due_date < ?", nowMs).Scan(&stats.ModuleStats.Perpustakaan.OverdueLoans)

	// 3. Inventory Stats
	r.DB.QueryRow("SELECT COUNT(*) FROM inventory_assets WHERE status = 'ACTIVE'").Scan(&stats.ModuleStats.Inventaris.TotalAssets)
	r.DB.QueryRow("SELECT COUNT(*) FROM inventory_rooms").Scan(&stats.ModuleStats.Inventaris.TotalRooms)
	r.DB.QueryRow("SELECT SUM(condition_light_damaged + condition_heavy_damaged) FROM inventory_assets WHERE status = 'ACTIVE'").Scan(&stats.ModuleStats.Inventaris.NeedsMaintenance)

	// 4. Savings Stats
	r.DB.QueryRow("SELECT SUM(saldo_terakhir) FROM tabungan_siswa WHERE is_active = 1").Scan(&stats.ModuleStats.Tabungan.TotalSaldo)
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_siswa WHERE is_active = 1").Scan(&stats.ModuleStats.Tabungan.TotalStudents)
	
	todayStart := time.Now().Truncate(24 * time.Hour).UnixMilli()
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_transaksi WHERE created_at >= ?", todayStart).Scan(&stats.ModuleStats.Tabungan.TodayTransactions)

	// 5. Recent Registrants
	regRows, err := r.DB.Query(`
		SELECT registration_number, full_name, status, created_at
		FROM spmb_registrants
		ORDER BY created_at DESC
		LIMIT 5
	`)
	if err == nil {
		defer regRows.Close()
		for regRows.Next() {
			var reg models.SPMBRegistrant
			var createdAt sql.NullInt64
			err := regRows.Scan(&reg.RegistrationNumber, &reg.FullName, &reg.Status, &createdAt)
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

	// 6. Active Period
	activePeriodQuery := `
		SELECT id, name, academic_year, start_date, end_date, quota, is_active
		FROM spmb_periods
		WHERE status = 'active'
		LIMIT 1
	`
	var p models.SPMBPeriod
	var sd, ed sql.NullInt64
	err = r.DB.QueryRow(activePeriodQuery).Scan(&p.ID, &p.Name, &p.AcademicYear, &sd, &ed, &p.Quota, &p.IsActive)
	if err == nil {
		p.StartDate = SafeTime(sd)
		p.EndDate = SafeTime(ed)
		p.Status = "active"
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
