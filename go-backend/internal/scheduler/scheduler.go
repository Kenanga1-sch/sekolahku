package scheduler

import (
	"database/sql"
	"log"
	"time"

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
	now := time.Now().Format("2006-01-02")

	result, err := s.db.Exec(`
		UPDATE library_loans 
		SET status = 'overdue', updated_at = datetime('now')
		WHERE status = 'borrowed' 
		  AND due_date < ?
		  AND (status != 'overdue')
	`, now)

	if err != nil {
		log.Printf("[CRON] Library overdue check error: %v", err)
		return
	}

	affected, _ := result.RowsAffected()
	if affected > 0 {
		log.Printf("[CRON] Marked %d library loans as overdue", affected)

		// Calculate fines for overdue loans
		_, err = s.db.Exec(`
			UPDATE library_loans 
			SET fine = CAST(
				(julianday('now') - julianday(due_date)) * 500 AS INTEGER
			),
			updated_at = datetime('now')
			WHERE status = 'overdue' AND (fine IS NULL OR fine = 0)
		`)
		if err != nil {
			log.Printf("[CRON] Fine calculation error: %v", err)
		}
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
