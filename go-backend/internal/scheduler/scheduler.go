package scheduler

import (
	"database/sql"
	"log"
	"time"
	
	"github.com/sekolahku/go-backend/internal/handlers"
	"github.com/sekolahku/go-backend/internal/repository"

	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron *cron.Cron
	db   *sql.DB
}

func NewScheduler(db *sql.DB) *Scheduler {
	return &Scheduler{
		cron: cron.New(cron.WithSeconds()),
		db:   db,
	}
}

func (s *Scheduler) Start() {
	// Library Overdue Check - runs every day at midnight
	s.cron.AddFunc("0 0 0 * * *", func() {
		log.Println("[CRON] Running library overdue check...")
		s.checkLibraryOverdue()
	})

	// Soft-Delete Cleanup - runs every Sunday at 02:00
	s.cron.AddFunc("0 0 2 * * 0", func() {
		log.Println("[CRON] Running soft-delete cleanup...")
		s.cleanupSoftDeleted()
	})

	// SQLite Database Vacuum - runs every Sunday at 03:00 (after cleanup)
	s.cron.AddFunc("0 0 3 * * 0", func() {
		log.Println("[CRON] Running SQLite incremental vacuum...")
		s.vacuumDatabase()
	})

	// Telegram Backup - runs every day at 02:00
	s.cron.AddFunc("0 0 2 * * *", func() {
		log.Println("[CRON] Running daily Telegram backup check...")
		s.backupToTelegram()
	})

	s.cron.Start()
	log.Println("[CRON] Scheduler started with", len(s.cron.Entries()), "jobs registered")
}

func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	log.Println("[CRON] Scheduler stopped gracefully")
}

// checkLibraryOverdue finds overdue library loans and marks them
func (s *Scheduler) checkLibraryOverdue() {
	now := time.Now().UnixMilli()

	// Mark overdue loans using is_returned flag and due_date
	result, err := s.db.Exec(`
		UPDATE library_loans 
		SET status = 'overdue', 
		    overdue_at = COALESCE(overdue_at, ?),
		    fine_amount = CAST(MAX(0, (? - due_date) / 86400000) * 500 AS INTEGER),
		    updated_at = ?
		WHERE is_returned = 0
		  AND due_date < ?
		  AND (status IS NULL OR status != 'overdue')
	`, now, now, now, now)

	if err != nil {
		log.Printf("[CRON] Library overdue check error: %v", err)
		return
	}

	affected, _ := result.RowsAffected()
	if affected > 0 {
		log.Printf("[CRON] Marked %d library loans as overdue with fines", affected)
	} else {
		log.Println("[CRON] No overdue loans found")
	}
}

// cleanupSoftDeleted removes records older than 30 days that were soft-deleted
func (s *Scheduler) cleanupSoftDeleted() {
	cutoff := time.Now().AddDate(0, 0, -30).Format("2006-01-02 15:04:05")
	
	tables := []string{
		"students", "employees", "library_catalog",
	}

	for _, table := range tables {
		result, err := s.db.Exec(`
			DELETE FROM `+table+` 
			WHERE deleted_at IS NOT NULL AND deleted_at < ?
		`, cutoff)

		if err != nil {
			log.Printf("[CRON] Cleanup error for %s: %v", table, err)
			continue
		}

		affected, _ := result.RowsAffected()
		if affected > 0 {
			log.Printf("[CRON] Cleaned up %d soft-deleted records from %s", affected, table)
		}
	}
}

// vacuumDatabase runs SQLite incremental vacuum to reclaim unused space
func (s *Scheduler) vacuumDatabase() {
	_, err := s.db.Exec("PRAGMA incremental_vacuum(100);")
	if err != nil {
		log.Printf("[CRON] Incremental vacuum failed: %v", err)
		return
	}
	log.Println("[CRON] Incremental vacuum completed successfully")
}

// backupToTelegram handles sending db to telegram
func (s *Scheduler) backupToTelegram() {
	repo := repository.NewTelegramBackupRepository(s.db)
	settings, err := repo.GetSettings()
	if err != nil {
		log.Printf("[CRON] Failed to get telegram backup settings: %v", err)
		return
	}

	if !settings.IsEnabled {
		log.Println("[CRON] Telegram backup is disabled, skipping")
		return
	}

	if settings.BotToken == "" || settings.ChatID == "" {
		log.Println("[CRON] Telegram backup is enabled but token/chatID is empty")
		return
	}

	log.Println("[CRON] Sending backup to Telegram...")
	err = handlers.SendBackupToTelegram(settings.BotToken, settings.ChatID)
	if err != nil {
		log.Printf("[CRON] Failed to send backup to Telegram: %v", err)
		return
	}

	_ = repo.UpdateLastBackupTime()
	log.Println("[CRON] Successfully sent backup to Telegram")
}
