package models

type DashboardStats struct {
	Success           bool                     `json:"success"`
	SPMB              SPMBStats                `json:"spmb"`
	ModuleStats       ModuleStats              `json:"moduleStats"`
	RegistrationTrend []RegistrationTrendPoint `json:"registrationTrend"`
	RecentRegistrants []SPMBRegistrant         `json:"recentRegistrants"`
	ActivePeriod      *SPMBPeriod              `json:"activePeriod"`
}

type RegistrationTrendPoint struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type ModuleStats struct {
	Perpustakaan PerpustakaanStats `json:"perpustakaan"`
	Inventaris   InventarisStats   `json:"inventaris"`
	Tabungan     TabunganStats     `json:"tabungan"`
}

type PerpustakaanStats struct {
	TotalBooks   int `json:"totalBooks"`
	ActiveLoans  int `json:"activeLoans"`
	OverdueLoans int `json:"overdueLoans"`
}

type InventarisStats struct {
	TotalAssets      int `json:"totalAssets"`
	TotalRooms       int `json:"totalRooms"`
	NeedsMaintenance int `json:"needsMaintenance"`
}

type TabunganStats struct {
	TotalSaldo        float64 `json:"totalSaldo"`
	TotalStudents     int     `json:"totalStudents"`
	TodayTransactions int     `json:"todayTransactions"`
}

type SystemHealth struct {
	Success  bool           `json:"success"`
	Database DatabaseHealth `json:"database"`
	System   SystemMetrics  `json:"system"`
	Backup   BackupInfo     `json:"backup"`
}

type DatabaseHealth struct {
	Status        string `json:"status"`
	FormattedSize string `json:"formatted_size"`
}

type SystemMetrics struct {
	UptimeSeconds int64   `json:"uptime_seconds"`
	MemoryUsageMB float64 `json:"memory_usage_mb"`
}

type BackupInfo struct {
	LastBackup *int64 `json:"last_backup"`
}
