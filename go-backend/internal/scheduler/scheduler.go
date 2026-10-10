package scheduler

import (
	"database/sql"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/sekolahku/go-backend/internal/handlers"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/notify"
	"github.com/sekolahku/go-backend/internal/push"
	"github.com/sekolahku/go-backend/internal/repository"

	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron  *cron.Cron
	db    *sql.DB
	push  *push.Service
}

func NewScheduler(db *sql.DB, pushSvc *push.Service) *Scheduler {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		location = time.Local
	}
	return &Scheduler{
		cron: cron.New(cron.WithSeconds(), cron.WithLocation(location)),
		db:   db,
		push: pushSvc,
	}
}

// parentNotifier membangun ParentNotifier lokal dengan push service scheduler.
func (s *Scheduler) parentNotifier() *notify.ParentNotifier {
	return notify.NewParentNotifier(
		repository.NewParentRepository(s.db),
		repository.NewNotificationRepository(s.db),
		repository.NewPreferenceRepository(s.db),
		s.push,
	)
}

// notifyAdminsLibraryOverdue mengirim notifikasi jumlah buku overdue hari
// ini ke admin. Dedup per hari: notifikasi bernama sama ditandai read agar
// statistik tetap bersih tanpa perlu tabel baru.
func (s *Scheduler) notifyAdminsLibraryOverdue(count int64) {
	if count <= 0 {
		return
	}
	repo := repository.NewNotificationRepository(s.db)
	_ = repo.NotifyRoles(models.Notification{
		Type:      "warning",
		Category:  "perpustakaan",
		Title:     "Buku overdue: " + strconv.FormatInt(count, 10),
		Message:   strconv.FormatInt(count, 10) + " peminjaman melewati jatuh tempo dan terkena denda. Segera hubungi peminjam.",
		TargetURL: handlers.StrPtr("/perpustakaan/sirkulasi"),
	}, "admin", "superadmin")
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

	// Parent Alpha Warning - runs every day at 12:30 (jam sekolah WIB)
	s.cron.AddFunc("0 30 12 * * 1-5", func() {
		log.Println("[CRON] Running parent alpha warning...")
		s.warnParentsOfAlpha()
	})

	// Parent Daily Digest - runs every weekday at 16:00 (akhir pelajaran WIB)
	s.cron.AddFunc("0 0 16 * * 1-5", func() {
		log.Println("[CRON] Running parent daily digest...")
		s.composeParentDigest()
	})

	// Komputer Belajar: tutup sesi yang lewat deadline + tandai booking
	// kadaluarsa + kirim peringatan sisa waktu (tiap menit).
	s.cron.AddFunc("0 * * * * *", func() {
		s.enforceComputerSessions()
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
		    fine_amount = CAST(MAX(0, (? - due_date) / 86400000) * ? AS INTEGER),
		    updated_at = ?
		WHERE is_returned = 0
		  AND due_date < ?
		  AND (status IS NULL OR status != 'overdue')
	`, now, repository.FinePerDay, now, now)

	if err != nil {
		log.Printf("[CRON] Library overdue check error: %v", err)
		return
	}

	affected, _ := result.RowsAffected()
	if affected > 0 {
		log.Printf("[CRON] Marked %d library loans as overdue with fines", affected)
		s.notifyAdminsLibraryOverdue(affected)
	} else {
		log.Println("[CRON] No overdue loans found")
	}
}

// warnParentsOfAlpha mengabari orang tua siswa yang tercatat alpha hari ini
// (Senin-Jumat, lewati hari libur). Berjalan setelah guru mencatat presensi
// pagi; hanya alpha terbaru per hari yang dikirim.
func (s *Scheduler) warnParentsOfAlpha() {
	if holiday, _ := repository.IsHoliday(repository.TodayJakarta()); holiday {
		return
	}

	// Siswa alpha hari ini beserta ortu aktifnya.
	rows, err := s.db.Query(`
		SELECT ar.student_id, s.full_name, COALESCE(s.class_name, ''), ps.user_id
		FROM attendance_records ar
		JOIN attendance_sessions asess ON ar.session_id = asess.id
		JOIN students s ON ar.student_id = s.id
		JOIN parent_students ps ON ps.student_id = ar.student_id AND ps.is_active = 1
		WHERE asess.date = ? AND ar.status = 'alpha'
	`, repository.TodayJakarta())
	if err != nil {
		log.Printf("[CRON] Parent alpha warning query error: %v", err)
		return
	}
	type alphaRow struct{ StudentID, StudentName, ClassName, ParentUserID string }
	alpha := make([]alphaRow, 0, 8)
	for rows.Next() {
		var r alphaRow
		if err := rows.Scan(&r.StudentID, &r.StudentName, &r.ClassName, &r.ParentUserID); err == nil {
			alpha = append(alpha, r)
		}
	}
	rows.Close()
	if len(alpha) == 0 {
		return
	}

	notifier := s.parentNotifier()
	sent := 0
	today := repository.TodayJakarta()
	izinURL := "/parent/izin"
	for _, r := range alpha {
		// Deep link ke form izin dengan anak yang tepat dipilih,
		// sehingga notifikasi alpha bisa langsung ditindaklanjuti orang tua.
		target := izinURL + "?anak=" + r.StudentID
		title := "Anak Anda tercatat alpha"
		body := r.StudentName + " (" + r.ClassName + ") tercatat tanpa keterangan (alpha) hari ini. Hubungi sekolah bila ini tidak benar."
		// Kirim via in-app (ParentNotifier) + push dengan tombol aksi.
		notifier.NotifyParentsOfStudent(r.StudentID, "absensi", "warning", title, body,
			target, "alpha-"+r.StudentID+"-"+today)
		// Push eksplisit dengan tombol aksi "Ajukan Izin" (hanya ke perangkat
		// orang tua; ParentNotifier push tidak mendukung actions).
		if s.push != nil && s.push.Enabled() {
			parents, perr := notifier.Parents.GetParentUserIDs(r.StudentID)
			if perr == nil {
				_ = s.push.SendToUsers(parents, models.PushPayload{
					Title: title,
					Body:  body,
					URL:   target,
					Tag:   "alpha-" + r.StudentID + "-" + today,
					Icon:  "/icon-192.png",
					Actions: []models.PushAction{
						{Action: "create-leave", Title: "Ajukan Izin", Icon: "calendar-plus", URL: target},
					},
				})
			}
		}
		sent++
	}
	log.Printf("[CRON] Parent alpha warning: %d siswa alpha diproses", sent)
}

// composeParentDigest mengirim satu notifikasi harian ke tiap orang tua,
// meringkaskan kehadiran + perubahan tabungan anak-anaknya (Senin-Jumat,
// lewati hari libur). Satu notif per ortu; push tag = digest-<date> supaya
// notifikasi sebelumnya diganti, tidak menumpuk.
func (s *Scheduler) composeParentDigest() {
	if holiday, _ := repository.IsHoliday(repository.TodayJakarta()); holiday {
		return
	}

	parentRepo := repository.NewParentRepository(s.db)
	notifRepo := repository.NewNotificationRepository(s.db)
	prefsRepo := repository.NewPreferenceRepository(s.db)
	savingsRepo := repository.NewSavingsRepository(s.db)
	today := repository.TodayJakarta()

	// Semua user orang tua yang punya minimal satu anak aktif.
	parents := make([]string, 0, 16)
	parentNames := make(map[string]string)
	parentRows, err := s.db.Query(`
		SELECT DISTINCT ps.user_id, u.name
		FROM parent_students ps
		JOIN users u ON u.id = ps.user_id
		JOIN students s ON s.id = ps.student_id AND (s.status = 'active' OR s.is_active = 1)
		WHERE ps.is_active = 1 AND u.role = 'orangtua' AND u.is_active = 1
	`)
	if err != nil {
		log.Printf("[CRON] Digest: query parent error: %v", err)
		return
	}
	for parentRows.Next() {
		var uid, name string
		if err := parentRows.Scan(&uid, &name); err == nil {
			parents = append(parents, uid)
			parentNames[uid] = name
		}
	}
	parentRows.Close()
	if len(parents) == 0 {
		return
	}

	sent := 0
	for _, uid := range parents {
		// Preferensi: kategori tidak ada (default) = aktif; baris eksplisit false = nonaktif.
		prefs, pErr := prefsRepo.GetPreferences(uid)
		if pErr != nil {
			continue
		}
		absensiPref := true
		if v, ok := prefs[repository.NotifCategoryAbsensi]; ok {
			absensiPref = v
		}
		tabunganPref := true
		if v, ok := prefs[repository.NotifCategoryTabungan]; ok {
			tabunganPref = v
		}
		// Lewati seluruhnya bila kedua kategori dimatikan.
		if !absensiPref && !tabunganPref {
			continue
		}

		children, err := parentRepo.GetChildrenByUser(uid)
		if err != nil {
			continue
		}

		var parts []string
		for _, ch := range children {
			var tail string
			if absensiPref {
				tail += " " + labelStatus(parentRepo.GetDailyAttendanceStatus(ch.StudentID, today))
			}
			if tabunganPref {
				change := savingsRepo.GetDailyChange(ch.StudentID, today)
				if change != 0 {
					tail += " tabungan " + formatChange(change)
				}
			}
			if tail == "" {
				continue
			}
			parts = append(parts, ch.FullName+" —"+tail)
		}
		if len(parts) == 0 {
			continue
		}

		name := parentNames[uid]
		title := "Ringkasan harian " + name
		if name == "" {
			title = "Ringkasan harian"
		}
		uidCopy := uid
		digestBody := "Hari ini: " + join(parts, "; ") + "."
		_ = notifRepo.CreateNotification(models.Notification{
			UserID:    &uidCopy,
			Type:      "info",
			Category:  "umum",
			Title:     title,
			Message:   digestBody,
			TargetURL: strPtr("/parent/presensi"),
		})
		// Juga kirim Web Push bila layanan aktif dan orang tua pernah subscribe.
		if s.push != nil && s.push.Enabled() {
			_ = s.push.SendToUsers([]string{uid}, models.PushPayload{
				Title: title,
				Body:  digestBody,
				URL:   "/parent/presensi",
				Tag:   "digest-" + today,
			})
		}
		sent++
	}
	log.Printf("[CRON] Parent daily digest: %d notifikasi terkirim", sent)
}

// enforceComputerSessions menjalankan penegakan waktu modul Komputer Belajar:
// 1) tutup sesi yang sudah lewat deadline (end_reason=time_up),
// 2) tandai booking yang tidak dipakai sebagai expired,
// 3) kirim notifikasi "sisa 5 menit" ke siswa sekali per sesi.
func (s *Scheduler) enforceComputerSessions() {
	repo := repository.NewComputerRepository(s.db)
	now := time.Now()
	nowMs := now.UnixMilli()

	// 1) Sesi lewat deadline.
	due, err := repo.DueSessions(nowMs)
	if err != nil {
		log.Printf("[CRON] Komputer: gagal memuat sesi due: %v", err)
	} else {
		for _, id := range due {
			if _, err := repo.EndSession(id, "time_up"); err != nil {
				log.Printf("[CRON] Komputer: gagal menutup sesi %s: %v", id, err)
			}
		}
		if len(due) > 0 {
			log.Printf("[CRON] Komputer: %d sesi ditutup karena waktu habis", len(due))
		}
	}

	// 2) Booking kadaluarsa (slot lewat tanpa dipakai).
	if n, err := repo.ExpireBookings(nowMs); err != nil {
		log.Printf("[CRON] Komputer: gagal menandai booking expired: %v", err)
	} else if n > 0 {
		log.Printf("[CRON] Komputer: %d booking ditandai expired", n)
	}

	// 3) Peringatan sisa 5 menit.
	nearing, err := repo.SessionsNearingEnd(nowMs, 5)
	if err != nil {
		log.Printf("[CRON] Komputer: gagal memuat sesi mendekati akhir: %v", err)
		return
	}
	if len(nearing) == 0 {
		return
	}
	notifRepo := repository.NewNotificationRepository(s.db)
	for _, sess := range nearing {
		repo.MarkWarnSent(sess.ID)
		var uid string
		_ = s.db.QueryRow(`SELECT id FROM users WHERE student_id = ? AND is_active = 1 LIMIT 1`, sess.StudentID).Scan(&uid)
		if uid == "" {
			continue
		}
		uidCopy := uid
		sisa := int(sess.DeadlineAt.Sub(now).Minutes())
		if sisa < 1 {
			sisa = 1
		}
		_ = notifRepo.CreateNotification(models.Notification{
			UserID:    &uidCopy,
			Type:      "warning",
			Category:  "perpustakaan",
			Title:     "Waktu komputer hampir habis",
			Message:   "Sisa " + strconv.Itoa(sisa) + " menit lagi. Segera simpan pekerjaanmu sebelum komputer terkunci.",
			TargetURL: handlers.StrPtr("/perpustakaan/saya/laporan-baca"),
		})
		if s.push != nil && s.push.Enabled() {
			_ = s.push.SendToUsers([]string{uid}, models.PushPayload{
				Title: "Waktu komputer hampir habis",
				Body:  "Sisa " + strconv.Itoa(sisa) + " menit lagi sebelum komputer terkunci.",
				URL:   "/perpustakaan/saya/laporan-baca",
				Tag:   "computer-" + sess.ID,
			})
		}
	}
}

func labelStatus(status string) string {
	switch status {
	case "hadir":
		return " hadir"
	case "sakit":
		return " sakit"
	case "izin":
		return " izin"
	case "alpha":
		return " alpha"
	default:
		return " " + status
	}
}

func formatChange(n int64) string {
	if n > 0 {
		return "+Rp" + strconv.FormatInt(n, 10)
	}
	if n < 0 {
		return "-Rp" + strconv.FormatInt(-n, 10)
	}
	return ""
}

func join(parts []string, sep string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}

func strPtr(s string) *string { return &s }

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

	// Backup aktif bila diaktifkan admin (is_enabled) ATAU kredensial Cloud
	// Storage tersedia di ENV. Kredensial sudah di-fallback dari ENV di repo,
	// sehingga memuat bot & chat yang sama dengan Cloud Storage.
	envReady := os.Getenv("CLOUDSTORAGE_BOT_TOKEN") != "" && os.Getenv("CLOUDSTORAGE_CHAT_ID") != ""
	if !settings.IsEnabled && !envReady {
		log.Println("[CRON] Telegram backup is disabled, skipping")
		return
	}

	if settings.BotToken == "" || settings.ChatID == "" {
		log.Println("[CRON] Telegram backup is enabled but token/chatID is empty")
		return
	}

	log.Println("[CRON] Sending backup to Telegram...")
	err = handlers.SendBackupToTelegram(settings.BotToken, settings.ChatID, s.db)
	if err != nil {
		log.Printf("[CRON] Failed to send backup to Telegram: %v", err)
		// Beri tahu admin lewat chat yang sama agar kegagalan tidak senyap.
		handlers.NotifyBackupFailure(settings.BotToken, settings.ChatID, err.Error())
		return
	}

	_ = repo.UpdateLastBackupTime()
	log.Println("[CRON] Successfully sent backup to Telegram")
}
