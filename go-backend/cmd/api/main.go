package main

import (
	"bytes"
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	gommonLog "github.com/labstack/gommon/log"
	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/db/migrations"
	"github.com/sekolahku/go-backend/internal/handlers"
	authMiddleware "github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/repository"
	"github.com/sekolahku/go-backend/internal/scheduler"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

//go:embed all:dist
var frontendFiles embed.FS

func loadEnv() {
	envFiles := []string{
		".env",
		".env.local",
		"../.env",
		"../.env.local",
		"go-backend/.env",
		"go-backend/.env.local",
	}

	for _, filepath := range envFiles {
		file, err := os.Open(filepath)
		if err != nil {
			continue // Skip if file doesn't exist
		}
		defer file.Close()

		data, err := io.ReadAll(file)
		if err != nil {
			continue
		}

		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			// Skip empty lines and comments
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}

			// Split key and value
			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				continue
			}

			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])

			// Strip quotes if present
			if (strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"")) ||
				(strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'")) {
				if len(val) >= 2 {
					val = val[1 : len(val)-1]
				}
			}

			// Only set if not already set in environment
			if os.Getenv(key) == "" {
				os.Setenv(key, val)
				if key == "GEMINI_API_KEY" {
					log.Printf("[ENV] Loaded GEMINI_API_KEY from %s (length: %d)", filepath, len(val))
				}
			} else if key == "GEMINI_API_KEY" {
				log.Printf("[ENV] GEMINI_API_KEY already set in environment (length: %d)", len(os.Getenv(key)))
			}
		}
	}
}

func main() {
	loadEnv()
	startTime := time.Now()
	server := echo.New()

	authMiddleware.InitJWTMiddleware()

	// Log level from env (debug, info, warn, error)
	logLevel := os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "info"
	}
	switch logLevel {
	case "debug":
		server.Logger.SetLevel(gommonLog.DEBUG)
	case "info":
		server.Logger.SetLevel(gommonLog.INFO)
	case "warn":
		server.Logger.SetLevel(gommonLog.WARN)
	case "error":
		server.Logger.SetLevel(gommonLog.ERROR)
	default:
		server.Logger.SetLevel(gommonLog.INFO)
	}
	server.Logger.SetOutput(os.Stdout)
	server.Logger.SetHeader("${time_rfc3339} ${level} ${prefix}")

	// Global Middleware
	server.Use(middleware.RequestID())
	server.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: `{"time":"${time_rfc3339_nano}","id":"${id}","remote_ip":"${remote_ip}","host":"${host}","method":"${method}","uri":"${uri}","status":${status},"error":"${error}","latency":"${latency}","latency_human":"${latency_human}","bytes_in":${bytes_in},"bytes_out":${bytes_out}}` + "\n",
		Output: os.Stdout,
	}))
	server.Use(middleware.Recover())
	server.Use(middleware.BodyLimit("10M"))
	server.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 5,
	}))
	server.Use(authMiddleware.SecurityHeaders)
	server.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:3001",
			"http://127.0.0.1:3001",
			"https://server-kenanga.tail747644.ts.net",
		},
		AllowMethods:     []string{http.MethodGet, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	// Database initialization
	dbDir := "data"
	if _, err := os.Stat("go-backend"); err == nil {
		dbDir = filepath.Join("go-backend", "data")
	}
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		server.Logger.Fatal("Failed to create data directory:", err)
	}
	dbPath := filepath.Join(dbDir, "sekolahku.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		server.Logger.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// SQLite connection pooling tuning
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(30 * time.Minute)

	// Performance Tuning: WAL mode, Normal sync, auto_vacuum
	_, err = db.Exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA synchronous = NORMAL;
		PRAGMA temp_store = MEMORY;
		PRAGMA cache_size = -2000; -- 2MB cache
		PRAGMA journal_size_limit = 10485760; -- 10MB limit
		PRAGMA auto_vacuum = INCREMENTAL;
	`)
	if err != nil {
		server.Logger.Warn("Failed to apply SQLite performance tuning:", err)
	}

	if err := db.Ping(); err != nil {
		server.Logger.Fatal("Database ping failed:", err)
	}

	// 1. Run Migrations
	if err := migrations.RunMigrations(db); err != nil {
		server.Logger.Warn("Migration failed (might be ok if tables exist):", err)
	}

	// 2. Ensure core tables exist FIRST (so RepairDatabase and indexes can reference them)
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT,
			email TEXT UNIQUE,
			email_verified INTEGER,
			image TEXT,
			role TEXT NOT NULL DEFAULT 'user',
			password_hash TEXT,
			is_active INTEGER DEFAULT 1,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE IF NOT EXISTS employee_details (
			id TEXT PRIMARY KEY,
			user_id TEXT UNIQUE,
			nip TEXT,
			nuptk TEXT,
			nik TEXT,
			employment_status TEXT,
			job_type TEXT,
			join_date TEXT,
			category TEXT,
			degree TEXT,
			quote TEXT,
			photo_url TEXT,
			display_order INTEGER DEFAULT 0,
			name_without_degree TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			FOREIGN KEY(user_id) REFERENCES users(id)
		);
		CREATE TABLE IF NOT EXISTS attendance_sessions (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			class_id TEXT,
			class_name TEXT NOT NULL,
			academic_year TEXT,
			teacher_name TEXT,
			status TEXT DEFAULT 'open' NOT NULL,
			opened_at INTEGER,
			closed_at INTEGER,
			notes TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE IF NOT EXISTS attendance_records (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			student_id TEXT NOT NULL,
			status TEXT DEFAULT 'hadir' NOT NULL,
			check_in_time INTEGER,
			recorded_by TEXT,
			record_method TEXT DEFAULT 'manual' NOT NULL,
			notes TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE IF NOT EXISTS telegram_backup_settings (
			id TEXT PRIMARY KEY,
			bot_token TEXT,
			chat_id TEXT,
			is_enabled INTEGER DEFAULT 0,
			last_backup_at INTEGER,
			created_at INTEGER,
			updated_at INTEGER
		);
	`); err != nil {
		server.Logger.Warn("Failed to create core tables:", err)
	}

	// Automated Schema Repair moved to after all CREATE TABLEs
	// Enable foreign keys
	_, err = db.Exec(`PRAGMA foreign_keys = ON`)
	if err != nil {
		server.Logger.Warn("Failed to enable foreign keys:", err)
	}

	// Seed default admin if users table is empty
	SeedDefaultAdmin(db, server.Logger)
	SeedDefaultKlasifikasi(db, server.Logger)

	// Create database indexes and constraints for performance and integrity
	_, err = db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
		CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);
		CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
		CREATE INDEX IF NOT EXISTS idx_spmb_registrants_period ON spmb_registrants(period_id);
		CREATE UNIQUE INDEX IF NOT EXISTS idx_spmb_registrants_reg_number ON spmb_registrants(registration_number);
		CREATE INDEX IF NOT EXISTS idx_library_catalog_title ON library_catalog(title);
		CREATE INDEX IF NOT EXISTS idx_library_catalog_category ON library_catalog(category);
		CREATE INDEX IF NOT EXISTS idx_library_visits_created ON library_visits(created_at);
		CREATE INDEX IF NOT EXISTS idx_tabungan_transaksi_siswa ON tabungan_transaksi(siswa_id);
		CREATE INDEX IF NOT EXISTS idx_tabungan_transaksi_created ON tabungan_transaksi(created_at);
		CREATE INDEX IF NOT EXISTS idx_tabungan_transaksi_setoran ON tabungan_transaksi(setoran_id);
		CREATE INDEX IF NOT EXISTS idx_tabungan_setoran_status ON tabungan_setoran(status);
		CREATE INDEX IF NOT EXISTS idx_tabungan_setoran_created ON tabungan_setoran(created_at);
		CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
		CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
		CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(date);
		CREATE INDEX IF NOT EXISTS idx_letter_templates_type ON letter_templates(type);
		CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery(category);
		CREATE INDEX IF NOT EXISTS idx_gallery_created ON gallery(created_at);
		CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(is_published);
		CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at);
		CREATE INDEX IF NOT EXISTS idx_staff_profiles_category ON staff_profiles(category);
		CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category);
		CREATE INDEX IF NOT EXISTS idx_faqs_order ON faqs(order_rank);
		CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at);
		CREATE INDEX IF NOT EXISTS idx_mutasi_requests_status ON mutasi_requests(status_approval);
		CREATE INDEX IF NOT EXISTS idx_mutasi_out_requests_status ON mutasi_out_requests(status);
		CREATE INDEX IF NOT EXISTS idx_library_loans_status ON library_loans(status);
	`)
	if err != nil {
		server.Logger.Warn("Failed to create database indexes:", err)
	}

	// 4. Initialize default settings if needed
	if _, err := db.Exec(`
		INSERT OR IGNORE INTO school_settings (id, school_name, current_academic_year, spmb_is_open, max_distance_km)
		VALUES ('default', 'UPTD SDN 1 Kenanga', '2026/2027', 1, 3.0)
	`); err != nil {
		server.Logger.Warn("Failed to initialize default settings:", err)
	}
	// Clean up any duplicate settings rows
	if _, err := db.Exec("DELETE FROM school_settings WHERE id != 'default'"); err != nil {
		server.Logger.Warn("Failed to clean up duplicate settings rows:", err)
	}

	// 5. Create Alumni Buku Induk tables
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS alumni (
			id TEXT PRIMARY KEY,
			student_id TEXT,
			nisn TEXT,
			nis TEXT,
			nik TEXT,
			full_name TEXT NOT NULL,
			gender TEXT,
			birth_place TEXT,
			birth_date TEXT,
			religion TEXT,
			address TEXT,
			enrolled_year TEXT,
			previous_school TEXT,
			graduation_year TEXT,
			graduation_date INTEGER,
			final_class TEXT,
			final_grade_avg REAL,
			photo TEXT,
			parent_name TEXT,
			parent_phone TEXT,
			father_name TEXT,
			father_nik TEXT,
			father_education TEXT,
			father_job TEXT,
			mother_name TEXT,
			mother_nik TEXT,
			mother_education TEXT,
			mother_job TEXT,
			guardian_name TEXT,
			guardian_nik TEXT,
			guardian_relation TEXT,
			guardian_job TEXT,
			guardian_phone TEXT,
			sibling_count INTEGER DEFAULT 0,
			child_order INTEGER DEFAULT 0,
			height INTEGER DEFAULT 0,
			weight INTEGER DEFAULT 0,
			blood_type TEXT,
			medical_notes TEXT,
			special_needs TEXT,
			current_address TEXT,
			current_phone TEXT,
			current_email TEXT,
			next_school TEXT,
			current_occupation TEXT,
			current_institution TEXT,
			last_education_level TEXT,
			status TEXT DEFAULT 'graduated',
			notes TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE IF NOT EXISTS alumni_document_types (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			code TEXT NOT NULL,
			description TEXT,
			is_required INTEGER DEFAULT 0,
			max_file_size_mb INTEGER DEFAULT 5,
			allowed_types TEXT DEFAULT '["application/pdf","image/jpeg","image/png"]',
			sort_order INTEGER DEFAULT 0,
			is_active INTEGER DEFAULT 1,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE IF NOT EXISTS alumni_documents (
			id TEXT PRIMARY KEY,
			alumni_id TEXT NOT NULL,
			document_type_id TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_path TEXT NOT NULL,
			file_size INTEGER,
			mime_type TEXT,
			document_number TEXT,
			issue_date TEXT,
			verification_status TEXT DEFAULT 'pending',
			verified_by TEXT,
			verified_at INTEGER,
			verification_notes TEXT,
			notes TEXT,
			uploaded_by TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE IF NOT EXISTS document_pickups (
			id TEXT PRIMARY KEY,
			alumni_id TEXT NOT NULL,
			document_type_id TEXT,
			recipient_name TEXT NOT NULL,
			recipient_relation TEXT,
			recipient_id_number TEXT,
			recipient_phone TEXT,
			pickup_date INTEGER NOT NULL,
			signature_path TEXT,
			photo_proof_path TEXT,
			notes TEXT,
			handed_over_by TEXT,
			created_at INTEGER
		);
		CREATE TABLE IF NOT EXISTS student_class_history (
			id TEXT PRIMARY KEY,
			student_id TEXT NOT NULL,
			class_id TEXT,
			class_name TEXT,
			academic_year TEXT,
			status TEXT,
			record_date INTEGER
		);
		CREATE TABLE IF NOT EXISTS alumni_transcripts (
			id TEXT PRIMARY KEY,
			alumni_id TEXT NOT NULL,
			academic_year TEXT NOT NULL,
			semester TEXT NOT NULL,
			subject_name TEXT NOT NULL,
			subject_code TEXT,
			score REAL NOT NULL,
			score_letter TEXT,
			notes TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			FOREIGN KEY(alumni_id) REFERENCES alumni(id)
		);
		CREATE TABLE IF NOT EXISTS alumni_achievements (
			id TEXT PRIMARY KEY,
			alumni_id TEXT NOT NULL,
			type TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT,
			level TEXT NOT NULL,
			ranking TEXT,
			year TEXT NOT NULL,
			organizer TEXT,
			certificate_url TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			FOREIGN KEY(alumni_id) REFERENCES alumni(id)
		);
		CREATE TABLE IF NOT EXISTS alumni_extracurriculars (
			id TEXT PRIMARY KEY,
			alumni_id TEXT NOT NULL,
			activity_name TEXT NOT NULL,
			role TEXT,
			year_start TEXT,
			year_end TEXT,
			description TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			FOREIGN KEY(alumni_id) REFERENCES alumni(id)
		);
		CREATE TABLE IF NOT EXISTS alumni_attendance_summary (
			id TEXT PRIMARY KEY,
			alumni_id TEXT NOT NULL,
			academic_year TEXT NOT NULL,
			semester TEXT NOT NULL,
			present INTEGER DEFAULT 0,
			sick INTEGER DEFAULT 0,
			permission INTEGER DEFAULT 0,
			absent INTEGER DEFAULT 0,
			total_days INTEGER DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER,
			FOREIGN KEY(alumni_id) REFERENCES alumni(id)
		);
		CREATE INDEX IF NOT EXISTS idx_alumni_transcripts_alumni ON alumni_transcripts(alumni_id);
		CREATE INDEX IF NOT EXISTS idx_alumni_achievements_alumni ON alumni_achievements(alumni_id);
		CREATE INDEX IF NOT EXISTS idx_alumni_extracurriculars_alumni ON alumni_extracurriculars(alumni_id);
		CREATE INDEX IF NOT EXISTS idx_alumni_attendance_summary_alumni ON alumni_attendance_summary(alumni_id);
		CREATE TABLE IF NOT EXISTS integration_settings (
			id TEXT PRIMARY KEY,
			dapodik_url TEXT,
			dapodik_token TEXT,
			dapodik_npsn TEXT,
			erapor_url TEXT,
			erapor_token TEXT,
			erapor_db_host TEXT,
			erapor_db_port TEXT,
			erapor_db_user TEXT,
			erapor_db_pass TEXT,
			erapor_db_name TEXT,
			is_sandbox INTEGER DEFAULT 1,
			last_synced_at INTEGER,
			created_at INTEGER,
			updated_at INTEGER
		);
	`); err != nil {
		server.Logger.Warn("Failed to create alumni Buku Induk tables:", err)
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS admin_notifications (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			type TEXT,
			category TEXT,
			title TEXT,
			message TEXT,
			target_url TEXT,
			is_read INTEGER DEFAULT 0,
			metadata TEXT,
			created_at INTEGER
		);
		CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id ON admin_notifications(user_id);
	`); err != nil {
		server.Logger.Warn("Failed to create admin_notifications table:", err)
	}


	// Seed default integration settings if table is empty
	var integrationCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM integration_settings").Scan(&integrationCount); err == nil && integrationCount == 0 {
		now := time.Now().UnixMilli()
		_, err = db.Exec(`
			INSERT INTO integration_settings (
				id, dapodik_url, dapodik_token, dapodik_npsn, erapor_url, erapor_token, is_sandbox, created_at, updated_at
			) VALUES ('default', 'http://localhost:5774', '', '12345678', 'http://localhost:8080', '', 1, ?, ?)
		`, now, now)
		if err != nil {
			server.Logger.Warn("Failed to seed default integration settings:", err)
		}
	}

	// 3. Automated Schema Repair (Add missing columns to existing DB)
	RepairDatabase(db, server.Logger)

	server.Logger.Info("Database initialized with default settings and core tables")

	// Start background scheduler
	cronScheduler := scheduler.NewScheduler(db)
	cronScheduler.Start()
	defer cronScheduler.Stop()

	// Repositories
	userRepo := repository.NewUserRepository(db)
	academicRepo := repository.NewAcademicRepository(db)
	inventoryRepo := repository.NewInventoryRepository(db)
	spmbRepo := repository.NewSPMBRepository(db)
	studentRepo := repository.NewStudentRepository(db)
	employeeRepo := repository.NewEmployeeRepository(db)
	savingsRepo := repository.NewSavingsRepository(db)
	libraryRepo := repository.NewLibraryRepository(db)
	eofficeRepo := repository.NewEOfficeRepository(db)
	academicAdvRepo := repository.NewAcademicAdvRepository(db)
	attendanceRepo := repository.NewAttendanceRepository(db)
	loanRepo := repository.NewLoanRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	alumniRepo := repository.NewAlumniRepository(db)
	mutasiRepo := repository.NewMutasiRepository(db)
	galleryRepo := repository.NewGalleryRepository(db)
	staffProfileRepo := repository.NewStaffProfileRepository(db)
	announcementRepo := repository.NewAnnouncementRepository(db)
	auditLogRepo := repository.NewAuditLogRepository(db)
	notificationRepo := repository.NewNotificationRepository(db)
	telegramBackupRepo := repository.NewTelegramBackupRepository(db)
	dashboardRepo := repository.NewDashboardRepository(db, startTime)
	publicRepo := repository.NewPublicRepository(db)
	faqRepo := repository.NewFAQRepository(db)
	contactRepo := repository.NewContactRepository(db)
	syncRepo := repository.NewSyncRepository(db)
	integrationRepo := repository.NewIntegrationRepository(db)
	documentRepo := repository.NewDocumentRepository(db)

	// Auto sync students on startup to savings and library
	log.Println("[Startup] Running initial synchronization of active students to savings and library...")
	if syncCount, err := savingsRepo.SyncFromStudents(); err != nil {
		log.Printf("[Startup] Warning: Savings initial sync failed: %v", err)
	} else {
		log.Printf("[Startup] Savings initial sync completed, %d active students synchronized.", syncCount)
	}
	if syncCount, err := libraryRepo.SyncFromStudents(); err != nil {
		log.Printf("[Startup] Warning: Library initial sync failed: %v", err)
	} else {
		log.Printf("[Startup] Library initial sync completed, %d active students synchronized.", syncCount)
	}

	log.Println("[Startup] Running initial synchronization of active students to Buku Induk...")
	if syncCount, err := alumniRepo.SyncFromStudents(); err != nil {
		log.Printf("[Startup] Warning: Buku Induk initial sync failed: %v", err)
	} else {
		log.Printf("[Startup] Buku Induk initial sync completed, %d students synchronized.", syncCount)
	}

	// Handlers
	syncHandler := handlers.NewSyncHandler(syncRepo)
	authHandler := handlers.NewAuthHandler(userRepo, auditLogRepo)
	academicHandler := handlers.NewAcademicHandler(academicRepo)
	inventoryHandler := handlers.NewInventoryHandler(inventoryRepo)
	spmbHandler := handlers.NewSPMBHandler(spmbRepo)
	studentHandler := handlers.NewStudentHandler(studentRepo)
	employeeHandler := handlers.NewEmployeeHandler(employeeRepo)
	savingsHandler := handlers.NewSavingsHandler(savingsRepo)
	libraryHandler := handlers.NewLibraryHandler(libraryRepo)
	eofficeHandler := handlers.NewEOfficeHandler(eofficeRepo)
	academicAdvHandler := handlers.NewAcademicAdvHandler(academicAdvRepo)
	attendanceHandler := handlers.NewAttendanceHandler(attendanceRepo)
	loanHandler := handlers.NewLoanHandler(loanRepo)
	settingHandler := handlers.NewSettingHandler(settingRepo, auditLogRepo)
	alumniHandler := handlers.NewAlumniHandler(alumniRepo)
	mutasiHandler := handlers.NewMutasiHandler(mutasiRepo, libraryRepo, savingsRepo)
	galleryHandler := handlers.NewGalleryHandler(galleryRepo)
	staffProfileHandler := handlers.NewStaffProfileHandler(staffProfileRepo)
	announcementHandler := handlers.NewAnnouncementHandler(announcementRepo)
	auditLogHandler := handlers.NewAuditLogHandler(auditLogRepo)
	notificationHandler := handlers.NewNotificationHandler(notificationRepo)
	telegramBackupHandler := handlers.NewTelegramBackupHandler(telegramBackupRepo)
	userHandler := handlers.NewUserHandler(userRepo, studentRepo, employeeRepo, auditLogRepo)
	dashboardHandler := handlers.NewDashboardHandler(dashboardRepo)
	publicHandler := handlers.NewPublicHandler(publicRepo)
	faqHandler := handlers.NewFAQHandler(faqRepo)
	contactHandler := handlers.NewContactHandler(contactRepo)
	uploadHandler := handlers.NewUploadHandler()
	integrationHandler := handlers.NewIntegrationHandler(integrationRepo)
	documentHandler := handlers.NewDocumentHandler(documentRepo)

	// ==========================================
	// Routes
	// ==========================================

	// Public Routes
	server.GET("/api/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "OK"})
	})
	server.HEAD("/api/health", func(c echo.Context) error {
		return c.NoContent(http.StatusOK)
	})
	// Rate limiter for login to prevent brute force
	loginLimit := middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Skipper: func(c echo.Context) bool {
			return c.Path() != "/api/auth/login"
		},
		IdentifierExtractor: func(c echo.Context) (string, error) {
			return c.RealIP(), nil
		},
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      5,
			Burst:     10,
			ExpiresIn: 1 * time.Minute,
		}),
		DenyHandler: func(c echo.Context, id string, err error) error {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "Terlalu banyak percobaan login. Silakan coba lagi dalam 1 menit"})
		},
	})
	server.POST("/api/auth/login", authHandler.Login, loginLimit)
	server.POST("/api/auth/logout", authHandler.Logout)

	// Public routes with caching for GET endpoints
	publicGroup := server.Group("/api/public")
	publicGroup.Use(authMiddleware.CacheMiddleware(authMiddleware.CacheConfig{
		TTL:          5 * time.Minute,
		CacheControl: "public, max-age=300",
	}))

	publicGroup.GET("/homepage", publicHandler.GetHomepageData)
	publicGroup.GET("/staff", publicHandler.GetPublicStaff)
	publicGroup.GET("/gallery", publicHandler.GetPublicGallery)
	publicGroup.GET("/school-settings", settingHandler.GetSettings)
	publicGroup.GET("/news", announcementHandler.GetPublicAnnouncements)
	publicGroup.GET("/news/:slug", announcementHandler.GetPublicAnnouncementBySlug)
	publicGroup.GET("/faqs", faqHandler.GetPublicFAQs)
	publicGroup.GET("/spmb/landing", spmbHandler.GetLandingData)
	publicGroup.POST("/spmb/register", spmbHandler.Register)
	publicGroup.GET("/spmb/registrants", spmbHandler.GetPublicRegistrants)
	publicGroup.GET("/spmb/registrants/:number", spmbHandler.GetRegistrant)
	publicGroup.POST("/contact", contactHandler.SubmitMessage)
	publicGroup.POST("/mutasi/request", mutasiHandler.CreateMutasiRequest)
	publicGroup.GET("/mutasi/status/:regNum", mutasiHandler.GetPublicMutasiStatus)
	publicGroup.POST("/mutasi-keluar/validate", mutasiHandler.ValidatePublicMutasiOut)
	publicGroup.POST("/mutasi-keluar/request", mutasiHandler.CreatePublicMutasiOutRequest)
	publicGroup.POST("/tabungan/check-balance", savingsHandler.CheckPublicBalance)
	publicGroup.GET("/spmb/reference-date", spmbHandler.GetReferenceDate)
	publicGroup.POST("/kiosk/attendance", attendanceHandler.KioskRecordAttendance)
	publicGroup.POST("/kiosk/savings-deposit", savingsHandler.KioskDeposit)
	publicGroup.GET("/kiosk/savings-lookup", savingsHandler.GetSiswa)

	// Dapodik Sync
	publicGroup.POST("/sync/dapodik/students", syncHandler.SyncDapodikStudents)

	// Public compatibility aliases used by static public pages.
	server.POST("/api/mutasi/request", mutasiHandler.CreateMutasiRequest)
	server.GET("/api/mutasi/status/:regNum", mutasiHandler.GetPublicMutasiStatus)
	server.POST("/api/mutasi-keluar/validate", mutasiHandler.ValidatePublicMutasiOut)
	server.POST("/api/mutasi-keluar/request", mutasiHandler.CreatePublicMutasiOutRequest)

	// Admin Protected Routes
	auth := server.Group("/api")
	auth.Use(authMiddleware.JWTMiddleware)

	// Admin-only routes (superadmin, admin)
	adminGroup := auth.Group("")
	adminGroup.Use(authMiddleware.RoleMiddleware(authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin))

	// Admin Dashboard (admin only)
	adminGroup.GET("/admin/dashboard/stats", dashboardHandler.GetStats)
	adminGroup.GET("/admin/system/health", dashboardHandler.GetHealth)

	// Academic Admin (admin only)
	auth.GET("/academic/active-year", academicHandler.GetActiveAcademicYear)
	adminGroup.GET("/academic/years", academicHandler.GetAcademicYears)
	adminGroup.POST("/academic/years", academicHandler.CreateAcademicYear)
	adminGroup.PUT("/academic/years/:id", academicHandler.UpdateAcademicYear)
	adminGroup.DELETE("/academic/years/:id", academicHandler.DeleteAcademicYear)
	adminGroup.GET("/academic/subjects", academicHandler.GetSubjects)
	adminGroup.POST("/academic/subjects", academicHandler.CreateSubject)
	adminGroup.PUT("/academic/subjects/:id", academicHandler.UpdateSubject)
	adminGroup.DELETE("/academic/subjects/:id", academicHandler.DeleteSubject)
	adminGroup.GET("/academic/classes", academicHandler.GetClasses)
	adminGroup.POST("/academic/classes", academicHandler.CreateClass)
	adminGroup.PUT("/academic/classes/:id", academicHandler.UpdateClass)
	adminGroup.DELETE("/academic/classes/:id", academicHandler.DeleteClass)
	adminGroup.POST("/academic/promotion", academicHandler.ProcessPromotion)
	auth.GET("/classes/stats", academicHandler.GetClassesStats)

	// Inventory Admin
	auth.GET("/inventory/stats", inventoryHandler.GetStats)
	auth.GET("/inventory/rooms", inventoryHandler.GetRooms)
	auth.GET("/inventory/rooms/:id", inventoryHandler.GetRoom)
	auth.POST("/inventory/rooms", inventoryHandler.CreateRoom)
	auth.PUT("/inventory/rooms/:id", inventoryHandler.UpdateRoom)
	auth.DELETE("/inventory/rooms/:id", inventoryHandler.DeleteRoom)
	auth.GET("/inventory/assets", inventoryHandler.GetAssets)
	auth.GET("/inventory/assets/:id", inventoryHandler.GetAsset)
	auth.POST("/inventory/assets", inventoryHandler.CreateAsset)
	auth.PUT("/inventory/assets/:id", inventoryHandler.UpdateAsset)
	auth.DELETE("/inventory/assets/:id", inventoryHandler.DeleteAsset)
	auth.GET("/inventory/items", inventoryHandler.GetItems)
	auth.GET("/inventory/items/:id", inventoryHandler.GetItem)
	auth.POST("/inventory/items", inventoryHandler.CreateItem)
	auth.PUT("/inventory/items/:id", inventoryHandler.UpdateItem)
	auth.DELETE("/inventory/items/:id", inventoryHandler.DeleteItem)
	auth.GET("/inventory/transactions", inventoryHandler.GetTransactions)
	auth.POST("/inventory/transactions", inventoryHandler.CreateTransaction)
	auth.GET("/inventory/opname", inventoryHandler.GetOpnames)
	auth.POST("/inventory/opname", inventoryHandler.CreateOpname)
	auth.POST("/inventory/opname/:id/apply", inventoryHandler.ApplyOpname)
	auth.GET("/inventory/audit", inventoryHandler.GetAuditLogs)

	// SPMB Admin (admin only)
	adminGroup.GET("/spmb/periods/active", spmbHandler.GetActivePeriod)
	adminGroup.GET("/spmb/periods", spmbHandler.GetPeriods)
	adminGroup.POST("/spmb/periods", spmbHandler.CreatePeriod)
	adminGroup.PATCH("/spmb/periods/:id", spmbHandler.UpdatePeriod)
	adminGroup.DELETE("/spmb/periods/:id", spmbHandler.DeletePeriod)
	adminGroup.GET("/spmb/stats", spmbHandler.GetStats)
	adminGroup.GET("/spmb/registrants", spmbHandler.GetRegistrantsAdmin)
	adminGroup.GET("/spmb/registrants/:number", spmbHandler.GetRegistrant)
	adminGroup.PATCH("/spmb/registrants/:id", spmbHandler.UpdateStatus)
	adminGroup.DELETE("/spmb/registrants/:id", spmbHandler.DeleteRegistrant)
	adminGroup.POST("/spmb/registrants/:id/promote", spmbHandler.PromoteRegistrant)
	adminGroup.GET("/spmb/process", spmbHandler.ProcessAcceptancePreview)
	adminGroup.POST("/spmb/process", spmbHandler.ProcessAcceptanceExecute)

	// Master Data Admin (admin only)
	students := adminGroup.Group("/students")
	students.POST("/sync-buku-induk", studentHandler.SyncBukuInduk)
	adminGroup.GET("/master/students", studentHandler.GetStudents)
	adminGroup.GET("/master/students/health", studentHandler.GetStudentHealth)
	adminGroup.GET("/master/students/simple-search", studentHandler.SimpleSearch)
	adminGroup.POST("/master/students/print", studentHandler.GetStudentsForPrint)
	adminGroup.POST("/master/students/bulk", studentHandler.BulkCreateStudents)
	adminGroup.GET("/master/students/:id", studentHandler.GetStudentByID)
	adminGroup.GET("/master/students/:id/grades", studentHandler.GetStudentGrades)
	adminGroup.POST("/master/students", studentHandler.CreateStudent)
	adminGroup.PUT("/master/students/:id", studentHandler.UpdateStudent)
	adminGroup.DELETE("/master/students/:id", studentHandler.DeleteStudent)

	// Aliases for legacy frontend paths
	adminGroup.GET("/students", studentHandler.GetStudents)
	adminGroup.GET("/students/simple-search", studentHandler.SimpleSearch)
	adminGroup.POST("/students/print", studentHandler.GetStudentsForPrint)
	adminGroup.GET("/students/:id", studentHandler.GetStudentByID)
	adminGroup.POST("/students", studentHandler.CreateStudent)
	adminGroup.PUT("/students/:id", studentHandler.UpdateStudent)
	adminGroup.DELETE("/students/:id", studentHandler.DeleteStudent)
	auth.GET("/classes", studentHandler.GetClasses)
	adminGroup.GET("/master/employees", employeeHandler.GetEmployees)
	adminGroup.GET("/master/employees/without-account", employeeHandler.GetEmployeesWithoutAccount)
	adminGroup.POST("/master/employees/import", employeeHandler.BulkImportEmployees)
	adminGroup.GET("/master/employees/:id", employeeHandler.GetEmployeeByID)
	adminGroup.POST("/master/employees", employeeHandler.CreateEmployee)
	adminGroup.PUT("/master/employees/:id", employeeHandler.UpdateEmployee)
	adminGroup.DELETE("/master/employees/:id", employeeHandler.DeleteEmployee)

	// Staff & Profile Admin (admin only)
	adminGroup.GET("/admin/staff", staffProfileHandler.GetProfiles)
	adminGroup.POST("/admin/staff", staffProfileHandler.CreateProfile)
	adminGroup.PATCH("/admin/staff/:id", staffProfileHandler.UpdateProfile)
	adminGroup.DELETE("/admin/staff/:id", staffProfileHandler.DeleteProfile)

	// FAQ & Contact Admin (admin only)
	adminGroup.GET("/faqs", faqHandler.ListFAQsAdmin)
	adminGroup.POST("/faqs", faqHandler.CreateFAQ)
	adminGroup.PUT("/faqs/:id", faqHandler.UpdateFAQ)
	adminGroup.DELETE("/faqs/:id", faqHandler.DeleteFAQ)
	adminGroup.GET("/contact-messages", contactHandler.ListMessages)
	adminGroup.PUT("/contact-messages/:id/read", contactHandler.MarkAsRead)
	adminGroup.DELETE("/contact-messages/:id", contactHandler.DeleteMessage)

	// Savings Admin
	auth.GET("/savings/stats", savingsHandler.GetStats)
	auth.GET("/savings/students", savingsHandler.GetSiswa)
	auth.POST("/savings/students", savingsHandler.CreateSiswa)
	auth.POST("/savings/students/sync", savingsHandler.SyncSavings)
	auth.GET("/savings/students/:id", savingsHandler.GetDetailSiswa)
	auth.PUT("/savings/students/:id", savingsHandler.UpdateSiswa)
	auth.DELETE("/savings/students/:id", savingsHandler.DeleteSiswa)
	auth.GET("/savings/transactions", savingsHandler.GetTransactions)
	auth.POST("/savings/transactions", savingsHandler.CreateTransaksi)
	auth.GET("/savings/setoran", savingsHandler.GetSetoranList)
	auth.POST("/savings/setoran", savingsHandler.CreateSetoran)
	auth.POST("/savings/setoran/verify", savingsHandler.VerifySetoran)
	auth.GET("/savings/brankas", savingsHandler.GetBrankasStatus)
	auth.GET("/savings/brankas/summary", savingsHandler.GetBrankasSummary)
	auth.POST("/savings/brankas", savingsHandler.CreateBrankas)
	auth.PUT("/savings/brankas/:id", savingsHandler.UpdateBrankas)
	auth.POST("/savings/brankas/transfer", savingsHandler.TransferBrankas)
	auth.GET("/savings/hutang", savingsHandler.GetHutangList)
	auth.POST("/savings/hutang", savingsHandler.CreateHutang)
	auth.PUT("/savings/hutang/:id", savingsHandler.UpdateHutang)
	auth.DELETE("/savings/hutang/:id", savingsHandler.CancelHutang)
	auth.POST("/savings/hutang/:id/pay-cash", savingsHandler.PayHutangCash)
	auth.POST("/savings/hutang/:id/settle-savings", savingsHandler.SettleHutangFromTabungan)
	auth.GET("/savings/hutang/:id/payments", savingsHandler.GetHutangPayments)
	auth.GET("/savings/kelas", savingsHandler.GetClassesWithReps)
	auth.POST("/savings/kelas", savingsHandler.CreateKelas)
	auth.PUT("/savings/kelas/:id", savingsHandler.UpdateKelas)
	auth.DELETE("/savings/kelas/:id", savingsHandler.DeleteKelas)
	auth.GET("/savings/treasurer", savingsHandler.GetTreasurer)
	auth.POST("/savings/treasurer", savingsHandler.AssignTreasurer)
	auth.POST("/savings/kelas/:id/rep", savingsHandler.AssignClassRep)
	auth.GET("/savings/classes/reps", savingsHandler.GetClassesWithReps)
	auth.PUT("/savings/classes/:id/rep", savingsHandler.AssignClassRep)
	auth.GET("/savings/reports/final", savingsHandler.GetFinalReport)
	auth.GET("/savings/reports/statement", savingsHandler.GetStatement)
	auth.GET("/savings/reports/verify", savingsHandler.VerifyStatement)

	// Tabungan route aliases (frontend legacy uses /api/tabungan/*)
	tabunganGroup := auth.Group("/tabungan")
	tabunganGroup.GET("/stats", savingsHandler.GetStats)
	tabunganGroup.GET("/data", savingsHandler.GetStats)
	tabunganGroup.GET("/students", savingsHandler.GetSiswa)
	tabunganGroup.POST("/students", savingsHandler.CreateSiswa)
	tabunganGroup.POST("/students/sync", savingsHandler.SyncSavings)
	tabunganGroup.GET("/siswa", savingsHandler.GetSiswa)
	tabunganGroup.POST("/siswa", savingsHandler.CreateSiswa)
	tabunganGroup.POST("/siswa/sync", savingsHandler.SyncSavings)
	tabunganGroup.GET("/siswa/:id", savingsHandler.GetDetailSiswa)
	tabunganGroup.PUT("/siswa/:id", savingsHandler.UpdateSiswa)
	tabunganGroup.DELETE("/siswa/:id", savingsHandler.DeleteSiswa)
	tabunganGroup.GET("/transactions", savingsHandler.GetTransactions)
	tabunganGroup.GET("/transaksi", savingsHandler.GetTransactions)
	tabunganGroup.POST("/transactions", savingsHandler.CreateTransaksi)
	tabunganGroup.POST("/transaksi", savingsHandler.CreateTransaksi)
	tabunganGroup.GET("/setoran", savingsHandler.GetSetoranList)
	tabunganGroup.GET("/setoran/pending", savingsHandler.GetSetoranPending)
	tabunganGroup.GET("/setoran/history", savingsHandler.GetSetoranByGuru)
	tabunganGroup.GET("/setoran/detail", savingsHandler.GetSetoranDetail)
	tabunganGroup.PUT("/setoran/detail", savingsHandler.ResubmitSetoran)
	tabunganGroup.POST("/setoran", savingsHandler.CreateSetoran)
	tabunganGroup.POST("/setoran/verify", savingsHandler.VerifySetoran)
	tabunganGroup.GET("/brankas", savingsHandler.GetBrankasStatus)
	tabunganGroup.POST("/brankas", savingsHandler.CreateBrankas)
	tabunganGroup.PATCH("/brankas", savingsHandler.TransferBrankas)
	tabunganGroup.PUT("/brankas/:id", savingsHandler.UpdateBrankas)
	tabunganGroup.GET("/hutang", savingsHandler.GetHutangList)
	tabunganGroup.POST("/hutang", savingsHandler.CreateHutang)
	tabunganGroup.POST("/hutang/batch", savingsHandler.CreateHutangBatch)
	tabunganGroup.PUT("/hutang/:id", savingsHandler.UpdateHutang)
	tabunganGroup.DELETE("/hutang/:id", savingsHandler.CancelHutang)
	tabunganGroup.POST("/hutang/:id/pay-cash", savingsHandler.PayHutangCash)
	tabunganGroup.POST("/hutang/:id/settle-savings", savingsHandler.SettleHutangFromTabungan)
	tabunganGroup.GET("/hutang/:id/payments", savingsHandler.GetHutangPayments)
	tabunganGroup.GET("/kelas", savingsHandler.GetClassesWithReps)
	tabunganGroup.POST("/kelas", savingsHandler.CreateKelas)
	tabunganGroup.PUT("/kelas/:id", savingsHandler.UpdateKelas)
	tabunganGroup.DELETE("/kelas/:id", savingsHandler.DeleteKelas)
	tabunganGroup.GET("/laporan/akhir-tahun", savingsHandler.GetFinalReport)
	tabunganGroup.GET("/rekening-koran", savingsHandler.GetStatement)
	tabunganGroup.GET("/rekening-koran/verify/detail", savingsHandler.VerifyStatement)

	// Library Admin (admin only)
	adminGroup.GET("/library/stats", libraryHandler.GetStats)
	adminGroup.GET("/library/books", libraryHandler.GetBooks)
	adminGroup.GET("/library/books/qr/:code", libraryHandler.GetBookByQRCode)
	adminGroup.POST("/library/books", libraryHandler.CreateBook)
	adminGroup.PUT("/library/books/:id", libraryHandler.UpdateBook)
	adminGroup.DELETE("/library/books/:id", libraryHandler.DeleteBook)
	adminGroup.GET("/library/isbn/:isbn", libraryHandler.LookupISBN)
	adminGroup.POST("/library/assets/bind", libraryHandler.BindAsset)
	adminGroup.POST("/library/assets/swap", libraryHandler.SwapQR)
	adminGroup.POST("/library/catalog/cover", uploadHandler.LibraryCoverUpload)
	adminGroup.POST("/library/catalog/ai-classify", libraryHandler.AIClassify)
	adminGroup.GET("/library/members", libraryHandler.GetMembers)
	adminGroup.GET("/library/members/qr/:code", libraryHandler.GetMemberByQRCode)
	adminGroup.POST("/library/members", libraryHandler.CreateMember)
	adminGroup.PATCH("/library/members/:id", libraryHandler.UpdateMember)
	adminGroup.DELETE("/library/members/:id", libraryHandler.DeleteMember)
	adminGroup.POST("/library/members/sync", libraryHandler.SyncLibrary)
	adminGroup.GET("/library/loans", libraryHandler.GetLoans)
	adminGroup.POST("/library/loans", libraryHandler.BorrowBook)
	adminGroup.POST("/library/loans/:id/return", libraryHandler.ReturnBook)
	adminGroup.POST("/library/loans/:id/pay-fine", libraryHandler.PayFine)
	adminGroup.POST("/library/loans/:id/renew", libraryHandler.RenewLoan)
	adminGroup.GET("/library/members/:id/history", libraryHandler.GetMemberLoanHistory)
	adminGroup.GET("/library/assets/:id", libraryHandler.GetBookByQRCode)
	adminGroup.POST("/library/visits/manual", libraryHandler.RecordVisit)
	adminGroup.GET("/library/visits", libraryHandler.GetVisits)
	adminGroup.GET("/library/reports", libraryHandler.GetReports)
	adminGroup.GET("/library/qr-generator", libraryHandler.GetQRCodeBatches)
	adminGroup.POST("/library/qr-generator", libraryHandler.GenerateQRCodeBatch)
	server.POST("/api/kiosk/scan-complete", libraryHandler.KioskScanComplete)
	server.POST("/api/kiosk/scan", libraryHandler.KioskScan)
	server.POST("/api/kiosk/transaction", libraryHandler.KioskTransaction)

	// Announcements Admin (admin only)
	auth.GET("/announcements", announcementHandler.GetAnnouncements)
	adminGroup.POST("/announcements", announcementHandler.CreateAnnouncement)
	adminGroup.PUT("/announcements/:id", announcementHandler.UpdateAnnouncement)
	adminGroup.PATCH("/announcements/:id", announcementHandler.UpdateAnnouncement)
	adminGroup.DELETE("/announcements/:id", announcementHandler.DeleteAnnouncement)

	// User Management Admin (admin only)
	adminGroup.GET("/users", userHandler.GetUsers)
	adminGroup.POST("/users", userHandler.CreateUser)
	adminGroup.PATCH("/users/:id", userHandler.UpdateUser)
	adminGroup.DELETE("/users/:id", userHandler.DeleteUser)
	adminGroup.POST("/users/generate", userHandler.GenerateAccounts)

	// Other Admin (admin only)
	adminGroup.GET("/audit-logs", auditLogHandler.GetLogs)
	adminGroup.POST("/audit-logs", auditLogHandler.CreateAuditLog)
	adminGroup.GET("/school-settings", settingHandler.GetSettings)
	adminGroup.POST("/school-settings", settingHandler.UpdateSettings)
	adminGroup.GET("/gallery/stats", galleryHandler.GetStats)
	adminGroup.POST("/gallery/bulk-delete", galleryHandler.BulkDelete)
	adminGroup.GET("/gallery", galleryHandler.GetGallery)
	adminGroup.POST("/gallery/upload", galleryHandler.Upload)
	adminGroup.PUT("/gallery/:id", galleryHandler.Update)
	adminGroup.PATCH("/gallery/:id", galleryHandler.Update)
	adminGroup.DELETE("/gallery/:id", galleryHandler.Delete)

	// E-Office Admin (admin only)
	adminGroup.GET("/eoffice/arsip/stats", eofficeHandler.GetArsipStats)
	adminGroup.GET("/eoffice/klasifikasi", eofficeHandler.GetKlasifikasi)
	adminGroup.POST("/eoffice/klasifikasi", eofficeHandler.CreateKlasifikasi)
	adminGroup.PUT("/eoffice/klasifikasi/:code", eofficeHandler.UpdateKlasifikasi)
	adminGroup.DELETE("/eoffice/klasifikasi/:code", eofficeHandler.DeleteKlasifikasi)
	adminGroup.POST("/eoffice/letter-numbering", eofficeHandler.Numbering)
	adminGroup.POST("/eoffice/letter-increment", eofficeHandler.Increment)
	adminGroup.GET("/eoffice/surat-masuk", eofficeHandler.GetSuratMasuk)
	adminGroup.POST("/eoffice/surat-masuk", eofficeHandler.CreateSuratMasuk)
	adminGroup.POST("/eoffice/surat-masuk/analyze-ai", eofficeHandler.AIAnalyzeSuratMasuk)
	adminGroup.GET("/eoffice/surat-keluar", eofficeHandler.GetSuratKeluar)
	adminGroup.POST("/eoffice/surat-keluar", eofficeHandler.CreateSuratKeluar)
	adminGroup.GET("/eoffice/surat-masuk/detail", eofficeHandler.GetSuratMasukDetail)
	adminGroup.GET("/eoffice/surat-keluar/detail", eofficeHandler.GetSuratKeluarDetail)
	adminGroup.POST("/eoffice/disposisi", eofficeHandler.CreateDisposisi)
	adminGroup.GET("/eoffice/letter-templates", eofficeHandler.GetLetterTemplates)
	adminGroup.GET("/eoffice/letter-templates/:id", eofficeHandler.GetLetterTemplateByID)
	adminGroup.GET("/eoffice/letter-templates/:id/variables", eofficeHandler.GetTemplateVariables)
	adminGroup.POST("/eoffice/letter-templates", eofficeHandler.CreateLetterTemplate)
	adminGroup.POST("/eoffice/letter-templates/import", eofficeHandler.ImportLetterTemplate)
	adminGroup.PATCH("/eoffice/letter-templates/:id", eofficeHandler.UpdateLetterTemplate)
	adminGroup.POST("/eoffice/letter-batch-generate", eofficeHandler.GenerateBatch)
	adminGroup.DELETE("/eoffice/letter-templates/:id", eofficeHandler.DeleteLetterTemplate)

	// Template Groups (admin only)
	adminGroup.GET("/eoffice/template-groups", eofficeHandler.GetTemplateGroups)
	adminGroup.GET("/eoffice/template-groups/:id", eofficeHandler.GetTemplateGroupByID)
	adminGroup.POST("/eoffice/template-groups", eofficeHandler.CreateTemplateGroup)
	adminGroup.PUT("/eoffice/template-groups/:id", eofficeHandler.UpdateTemplateGroup)
	adminGroup.DELETE("/eoffice/template-groups/:id", eofficeHandler.DeleteTemplateGroup)
	adminGroup.POST("/eoffice/template-groups/generate", eofficeHandler.GenerateGroupAndSubmit)
	adminGroup.POST("/eoffice/letter-generate-submit", eofficeHandler.GenerateAndSubmit)
	adminGroup.POST("/eoffice/surat-keluar/verify", eofficeHandler.VerifySuratKeluar)
	adminGroup.POST("/eoffice/surat-keluar/revision", eofficeHandler.SetSuratKeluarRevision)
	adminGroup.POST("/eoffice/upload-docx", eofficeHandler.UploadDocx)

	// Arsip route aliases (admin only)
	adminGroup.GET("/arsip/stats", eofficeHandler.GetArsipStats)
	adminGroup.GET("/arsip/surat-masuk", eofficeHandler.GetSuratMasuk)
	adminGroup.GET("/arsip/surat-masuk/detail", eofficeHandler.GetSuratMasukDetail)
	adminGroup.POST("/arsip/surat-masuk", eofficeHandler.CreateSuratMasuk)
	adminGroup.POST("/arsip/surat-masuk/analyze-ai", eofficeHandler.AIAnalyzeSuratMasuk)
	adminGroup.GET("/arsip/surat-keluar", eofficeHandler.GetSuratKeluar)
	adminGroup.GET("/arsip/surat-keluar/detail", eofficeHandler.GetSuratKeluarDetail)
	adminGroup.POST("/arsip/surat-keluar", eofficeHandler.CreateSuratKeluar)
	adminGroup.PATCH("/arsip/surat-keluar/detail", eofficeHandler.UpdateSuratKeluar)
	adminGroup.POST("/arsip/disposisi", eofficeHandler.CreateDisposisi)
	adminGroup.GET("/arsip/klasifikasi", eofficeHandler.GetKlasifikasi)
	adminGroup.POST("/arsip/surat-keluar/verify", eofficeHandler.VerifySuratKeluar)
	adminGroup.POST("/arsip/surat-keluar/revision", eofficeHandler.SetSuratKeluarRevision)
	adminGroup.POST("/arsip/dokumen", documentHandler.Create)
	adminGroup.GET("/arsip/dokumen", documentHandler.List)
	adminGroup.GET("/arsip/dokumen/:id", documentHandler.GetByID)
	adminGroup.PUT("/arsip/dokumen/:id", documentHandler.Update)
	adminGroup.DELETE("/arsip/dokumen/:id", documentHandler.Delete)
	adminGroup.GET("/arsip/daftar-1", eofficeHandler.GetDaftar1Stats)

	// Academic Advanced Admin (admin only)
	adminGroup.POST("/academic/adv/scan", academicAdvHandler.RecordQRScan)
	adminGroup.POST("/academic/adv/bulk-grades", academicAdvHandler.BulkGrades)

	// Attendance Admin
	auth.GET("/attendance/stats", attendanceHandler.GetStats)
	auth.GET("/attendance/sessions", attendanceHandler.GetSessions)
	auth.POST("/attendance/sessions", attendanceHandler.CreateSession)
	auth.GET("/attendance/sessions/:id", attendanceHandler.GetSessionByID)
	auth.PUT("/attendance/sessions/:id", attendanceHandler.UpdateSession)
	auth.PATCH("/attendance/sessions/:id", attendanceHandler.UpdateSession)
	auth.POST("/attendance/manual", attendanceHandler.RecordManual)
	auth.POST("/attendance/scan", attendanceHandler.ScanQR)
	auth.GET("/attendance/report", attendanceHandler.GetReport)
	auth.GET("/attendance/export", attendanceHandler.ExportCSV)
	auth.GET("/attendance/student-summary/:studentId", attendanceHandler.GetStudentSummary)

	// Loan Admin (admin only)
	adminGroup.GET("/loans", loanHandler.GetLoans)
	adminGroup.POST("/loans", loanHandler.CreateLoan)
	adminGroup.POST("/loans/:id/approve", loanHandler.ApproveLoan)
	adminGroup.POST("/loans/:id/pay", loanHandler.AddPayment)
	adminGroup.POST("/loans/:id/reject", loanHandler.RejectLoan)

	// Alumni Admin (admin only)
	adminGroup.GET("/alumni/stats", alumniHandler.GetAlumniStats)
	auth.GET("/alumni/document-types", alumniHandler.GetDocumentTypes)
	adminGroup.POST("/alumni/graduate", alumniHandler.GraduateStudents)
	adminGroup.POST("/alumni/import-bulk", alumniHandler.ImportBulkAlumni)
	adminGroup.POST("/alumni/import-grades-bulk", alumniHandler.ImportBulkGrades)
	adminGroup.GET("/integrations/settings", integrationHandler.GetSettings)
	adminGroup.POST("/integrations/settings", integrationHandler.UpdateSettings)
	adminGroup.GET("/settings/backup/telegram", telegramBackupHandler.GetSettings)
	adminGroup.PUT("/settings/backup/telegram", telegramBackupHandler.UpdateSettings)
	adminGroup.POST("/settings/backup/telegram/test", telegramBackupHandler.TestBackup)
	adminGroup.POST("/settings/backup/telegram/restore", telegramBackupHandler.RestoreBackup)
	adminGroup.POST("/integrations/test-connection", integrationHandler.TestConnection)
	adminGroup.POST("/integrations/sync", integrationHandler.SyncNow)
	adminGroup.GET("/alumni", alumniHandler.GetAlumni)
	adminGroup.POST("/alumni", alumniHandler.CreateAlumni)
	adminGroup.GET("/alumni/documents/:docId/download", alumniHandler.DownloadDocument)
	adminGroup.POST("/alumni/documents/:docId/verify", alumniHandler.VerifyDocument)
	adminGroup.DELETE("/alumni/documents/:docId", alumniHandler.DeleteDocument)
	adminGroup.GET("/alumni/:id", alumniHandler.GetAlumniByID)
	adminGroup.PUT("/alumni/:id", alumniHandler.UpdateAlumni)
	adminGroup.PATCH("/alumni/:id", alumniHandler.UpdateAlumni)
	adminGroup.DELETE("/alumni/:id", alumniHandler.DeleteAlumni)
	adminGroup.POST("/alumni/:id/photo", alumniHandler.UploadPhoto)
	adminGroup.DELETE("/alumni/:id/photo", alumniHandler.RemovePhoto)
	adminGroup.POST("/alumni/:id/documents", alumniHandler.CreateDocument)
	adminGroup.POST("/alumni/:id/pickups", alumniHandler.CreatePickup)
	// Buku Induk: Achievements
	adminGroup.GET("/alumni/:id/achievements", alumniHandler.GetAchievements)
	adminGroup.POST("/alumni/:id/achievements", alumniHandler.CreateAchievement)
	adminGroup.PUT("/alumni/achievements/:achId", alumniHandler.UpdateAchievement)
	adminGroup.DELETE("/alumni/achievements/:achId", alumniHandler.DeleteAchievement)
	// Buku Induk: Extracurriculars
	adminGroup.GET("/alumni/:id/extracurriculars", alumniHandler.GetExtracurriculars)
	adminGroup.POST("/alumni/:id/extracurriculars", alumniHandler.CreateExtracurricular)
	adminGroup.PUT("/alumni/extracurriculars/:exId", alumniHandler.UpdateExtracurricular)
	adminGroup.DELETE("/alumni/extracurriculars/:exId", alumniHandler.DeleteExtracurricular)

	// Buku Induk: Transcripts
	adminGroup.GET("/alumni/:id/transcripts", alumniHandler.GetTranscripts)
	adminGroup.POST("/alumni/:id/transcripts", alumniHandler.CreateTranscript)
	adminGroup.POST("/alumni/:id/transcripts/bulk", alumniHandler.SaveTranscriptsBulk)
	adminGroup.PUT("/alumni/transcripts/:transId", alumniHandler.UpdateTranscript)
	adminGroup.DELETE("/alumni/transcripts/:transId", alumniHandler.DeleteTranscript)

	// Buku Induk: Attendance Summaries
	adminGroup.GET("/alumni/:id/attendance", alumniHandler.GetAttendanceSummaries)
	adminGroup.POST("/alumni/:id/attendance", alumniHandler.CreateAttendanceSummary)
	adminGroup.PUT("/alumni/attendance/:attId", alumniHandler.UpdateAttendanceSummary)
	adminGroup.DELETE("/alumni/attendance/:attId", alumniHandler.DeleteAttendanceSummary)

	// Buku Induk: Health Records
	adminGroup.GET("/alumni/:id/health-records", alumniHandler.GetHealthRecords)
	adminGroup.POST("/alumni/:id/health-records", alumniHandler.CreateHealthRecord)
	adminGroup.PUT("/alumni/health-records/:hrId", alumniHandler.UpdateHealthRecord)
	adminGroup.DELETE("/alumni/health-records/:hrId", alumniHandler.DeleteHealthRecord)

	// Mutasi Admin Pages (admin only)
	adminGroup.GET("/admin/mutasi", mutasiHandler.GetMutasiRequests)
	adminGroup.PATCH("/admin/mutasi/:id", mutasiHandler.UpdateMutasiRequest)
	adminGroup.GET("/admin/mutasi-keluar", mutasiHandler.GetMutasiOutRequests)
	adminGroup.GET("/admin/mutasi-keluar/:id/check", mutasiHandler.CheckStudentLiability)
	adminGroup.PATCH("/admin/mutasi-keluar/:id", mutasiHandler.UpdateMutasiOutStatus)
	adminGroup.POST("/admin/mutasi/masuk/langsung", mutasiHandler.DirectMutasiMasuk)
	adminGroup.POST("/admin/mutasi-keluar/langsung", mutasiHandler.DirectMutasiKeluar)
	adminGroup.GET("/admin/mutasi/logs", mutasiHandler.GetMutasiLogs)
	adminGroup.GET("/admin/mutasi/rekap", mutasiHandler.GetMutasiRekap)

	// Notifications (Protected)
	notifs := server.Group("/api/notifications")
	notifs.Use(authMiddleware.JWTMiddleware)
	notifs.GET("", notificationHandler.GetNotifications)
	notifs.GET("/stats", notificationHandler.GetStats)
	notifs.PATCH("/:id/read", notificationHandler.MarkAsRead)
	notifs.POST("/read-all", notificationHandler.MarkAllAsRead)

	// Profile (Protected)
	profile := server.Group("/api/profile")
	profile.Use(authMiddleware.JWTMiddleware)
	profile.GET("", userHandler.GetProfile)
	profile.PATCH("", userHandler.UpdateProfile)
	profile.GET("/logs", userHandler.GetProfileLogs)

	// Upload routes
	auth.POST("/upload", uploadHandler.GeneralUpload)
	// SPMB upload is public (user is not logged in after registration).
	// Security: only accepts files for a specific registrant ID (cuid2, unguessable).
	server.POST("/api/spmb/upload", spmbHandler.UploadDocuments)

	// Static file server
	publicUploadPath := resolvePublicUploadsDir()
	legacyUploadPath := filepath.Join("uploads")
	subDirs := []string{"announcements", "spmb", "profiles", "gallery", "alumni", "staff", "library", "arsip"}
	for _, d := range subDirs {
		_ = os.MkdirAll(filepath.Join(publicUploadPath, d), 0755)
		_ = os.MkdirAll(filepath.Join(legacyUploadPath, d), 0755)
	}
	server.GET("/uploads/*", func(c echo.Context) error {
		return serveUploadFile(c, []string{publicUploadPath, legacyUploadPath})
	})

	// SPA Fallback logic
	frontendFS := getFrontendFS()

	// Direct asset routes - priority (Using custom seeker-capable handler)
	server.GET("/_next/*", func(c echo.Context) error {
		p := strings.TrimPrefix(c.Request().URL.Path, "/")
		return serveEmbeddedFile(c, frontendFS, p)
	})
	server.GET("/images/*", func(c echo.Context) error {
		p := strings.TrimPrefix(c.Request().URL.Path, "/")
		return serveEmbeddedFile(c, frontendFS, p)
	})
	server.GET("/favicon.ico", func(c echo.Context) error { return serveEmbeddedFile(c, frontendFS, "favicon.ico") })
	server.GET("/manifest.json", func(c echo.Context) error { return serveEmbeddedFile(c, frontendFS, "manifest.json") })
	server.GET("/logo.png", func(c echo.Context) error { return serveEmbeddedFile(c, frontendFS, "logo.png") })
	server.GET("/sw.js", func(c echo.Context) error { return serveEmbeddedFile(c, frontendFS, "sw.js") })

	server.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			path := c.Request().URL.Path

			// Let API and Direct Static Routes pass through
			if strings.HasPrefix(path, "/api/") ||
				strings.HasPrefix(path, "/_next/") ||
				strings.HasPrefix(path, "/uploads/") ||
				strings.HasPrefix(path, "/images/") ||
				path == "/favicon.ico" ||
				path == "/sw.js" {
				return next(c)
			}

			cleanPath := strings.TrimPrefix(path, "/")
			if cleanPath == "" {
				return serveEmbeddedFile(c, frontendFS, "index.html")
			}

			// Try to serve the exact file if it exists (for .css, .js, etc)
			if fileExists(frontendFS, cleanPath) {
				return serveEmbeddedFile(c, frontendFS, cleanPath)
			}

			// Try adding .html (Next.js static export pattern)
			if !strings.Contains(cleanPath, ".") {
				altPath := cleanPath + ".html"
				if fileExists(frontendFS, altPath) {
					return serveEmbeddedFile(c, frontendFS, altPath)
				}
			}

			// Fallback to index.html for SPA client-side routing and stale Next.js RSC requests
			if strings.HasPrefix(cleanPath, "__next") || c.QueryParam("_rsc") != "" {
				return serveEmbeddedFile(c, frontendFS, "index.html")
			}

			if !strings.Contains(cleanPath, ".") && !strings.HasPrefix(cleanPath, "_next/") {
				return serveEmbeddedFile(c, frontendFS, "index.html")
			}

			return next(c)
		}
	})

	// Server start
	go func() {
		port := os.Getenv("PORT")
		if port == "" {
			port = "8181"
		}
		if !strings.HasPrefix(port, ":") {
			port = ":" + port
		}
		if err := server.Start(port); err != nil && err != http.ErrServerClosed {
			server.Logger.Fatal("Shutting down the server")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		server.Logger.Fatal(err)
	}
}

func getFrontendFS() http.FileSystem {
	fsys, err := fs.Sub(frontendFiles, "dist")
	if err != nil {
		log.Fatal(err)
	}
	return http.FS(fsys)
}

func fileExists(fsys http.FileSystem, name string) bool {
	f, err := fsys.Open(name)
	if err != nil {
		return false
	}
	defer f.Close()

	d, err := f.Stat()
	if err != nil || d.IsDir() {
		return false
	}

	return true
}

func serveEmbeddedFile(c echo.Context, fsys http.FileSystem, name string) error {
	f, err := fsys.Open(name)
	if err != nil {
		return c.NoContent(http.StatusNotFound)
	}
	defer f.Close()
	d, err := f.Stat()
	if err != nil {
		return c.NoContent(http.StatusNotFound)
	}

	// Read entire file into memory to support seeking (io.ReadSeeker)
	// This is necessary because fs.File from embed.FS doesn't implement Seek()
	// and http.ServeContent requires it for range requests (common in modern browsers).
	data, err := io.ReadAll(f)
	if err != nil {
		return c.NoContent(http.StatusInternalServerError)
	}
	seeker := bytes.NewReader(data)

	ext := filepath.Ext(name)
	contentType := "text/plain"
	cacheControl := "public, max-age=31536000, immutable" // 1 year for hashed assets

	if name == "sw.js" || strings.HasSuffix(name, "/sw.js") || name == "manifest.json" {
		cacheControl = "no-cache, no-store, must-revalidate, max-age=0"
	}

	switch ext {
	case ".html":
		contentType = "text/html"
		cacheControl = "no-cache, no-store, must-revalidate, max-age=0" // HTML must be fresh
	case ".js", ".mjs":
		contentType = "application/javascript"
	case ".css":
		contentType = "text/css"
	case ".svg":
		contentType = "image/svg+xml"
	case ".png":
		contentType = "image/png"
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".webp":
		contentType = "image/webp"
	case ".json":
		contentType = "application/json"
		cacheControl = "public, max-age=3600" // 1 hour for JSON
	case ".ico":
		contentType = "image/x-icon"
	}
	c.Response().Header().Set(echo.HeaderContentType, contentType)
	c.Response().Header().Set(echo.HeaderCacheControl, cacheControl)

	http.ServeContent(c.Response(), c.Request(), name, d.ModTime(), seeker)
	return nil
}

func resolvePublicUploadsDir() string {
	candidates := []string{
		filepath.Join("public", "uploads"),
		filepath.Join("..", "public", "uploads"),
	}

	for _, candidate := range candidates {
		if info, err := os.Stat(filepath.Dir(candidate)); err == nil && info.IsDir() {
			return candidate
		}
	}

	return filepath.Join("public", "uploads")
}

func serveUploadFile(c echo.Context, roots []string) error {
	relPath := filepath.Clean(c.Param("*"))
	if relPath == "." || strings.HasPrefix(relPath, "..") || filepath.IsAbs(relPath) {
		return c.NoContent(http.StatusBadRequest)
	}

	for _, root := range roots {
		fullPath := filepath.Join(root, relPath)
		info, err := os.Stat(fullPath)
		if err == nil && !info.IsDir() {
			c.Response().Header().Set(echo.HeaderCacheControl, "public, max-age=86400") // 1 day for uploads
			return c.File(fullPath)
		}
	}

	return c.NoContent(http.StatusNotFound)
}

func RepairDatabase(db *sql.DB, logger echo.Logger) {
	type ColumnFix struct {
		Table   string
		Name    string
		SQLType string
		Default string
	}

	fixes := []ColumnFix{
		// faqs
		{Table: "faqs", Name: "order_rank", SQLType: "INTEGER", Default: "0"},
		{Table: "faqs", Name: "category", SQLType: "TEXT"},

		// students
		{Table: "students", Name: "nik", SQLType: "TEXT"},
		{Table: "students", Name: "religion", SQLType: "TEXT"},
		{Table: "students", Name: "father_name", SQLType: "TEXT"},
		{Table: "students", Name: "father_nik", SQLType: "TEXT"},
		{Table: "students", Name: "mother_name", SQLType: "TEXT"},
		{Table: "students", Name: "mother_nik", SQLType: "TEXT"},
		{Table: "students", Name: "guardian_name", SQLType: "TEXT"},
		{Table: "students", Name: "guardian_nik", SQLType: "TEXT"},
		{Table: "students", Name: "guardian_job", SQLType: "TEXT"},
		{Table: "students", Name: "class_id", SQLType: "TEXT"},
		{Table: "students", Name: "status", SQLType: "TEXT", Default: "'active'"},
		{Table: "students", Name: "meta_data", SQLType: "TEXT"},
		{Table: "students", Name: "is_active", SQLType: "INTEGER", Default: "1"},
		{Table: "students", Name: "kip", SQLType: "TEXT"},

		// library_loans
		{Table: "library_loans", Name: "status", SQLType: "TEXT", Default: "'borrowed'"},
		{Table: "library_loans", Name: "overdue_at", SQLType: "INTEGER"},

		// library_visits
		{Table: "library_visits", Name: "time", SQLType: "TEXT"},
		{Table: "library_visits", Name: "timestamp", SQLType: "INTEGER", Default: "0"},
		{Table: "library_visits", Name: "guest_name", SQLType: "TEXT"},
		{Table: "library_visits", Name: "guest_institution", SQLType: "TEXT"},
		{Table: "library_visits", Name: "guest_purpose", SQLType: "TEXT"},

		// users
		{Table: "users", Name: "email_verified", SQLType: "INTEGER"},
		{Table: "users", Name: "image", SQLType: "TEXT"},
		{Table: "users", Name: "username", SQLType: "TEXT"},
		{Table: "users", Name: "password_hash", SQLType: "TEXT"},
		{Table: "users", Name: "role", SQLType: "TEXT", Default: "'user'"},
		{Table: "users", Name: "full_name", SQLType: "TEXT"},
		{Table: "users", Name: "phone", SQLType: "TEXT"},
		{Table: "users", Name: "is_active", SQLType: "INTEGER", Default: "1"},
		{Table: "users", Name: "created_at", SQLType: "INTEGER"},
		{Table: "users", Name: "updated_at", SQLType: "INTEGER"},

		// school_settings
		{Table: "school_settings", Name: "school_npsn", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_website", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_logo", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_lat", SQLType: "REAL"},
		{Table: "school_settings", Name: "school_lng", SQLType: "REAL"},
		{Table: "school_settings", Name: "max_distance_km", SQLType: "REAL", Default: "3.0"},
		{Table: "school_settings", Name: "spmb_is_open", SQLType: "INTEGER", Default: "0"},
		{Table: "school_settings", Name: "current_academic_year", SQLType: "TEXT"},
		{Table: "school_settings", Name: "is_maintenance", SQLType: "INTEGER", Default: "0"},
		{Table: "school_settings", Name: "savings_treasurer_id", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_vision", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_mission", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_indicators", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_history_timeline", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_history_achievements", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_curriculum", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_extracurriculars", SQLType: "TEXT"},
		{Table: "school_settings", Name: "landing_tagline", SQLType: "TEXT"},
		{Table: "school_settings", Name: "landing_description", SQLType: "TEXT"},
		{Table: "school_settings", Name: "landing_texts", SQLType: "TEXT"},
		{Table: "school_settings", Name: "landing_sections", SQLType: "TEXT"},
		{Table: "school_settings", Name: "principal_name", SQLType: "TEXT"},
		{Table: "school_settings", Name: "principal_nip", SQLType: "TEXT"},
		{Table: "school_settings", Name: "supervisor_name", SQLType: "TEXT"},
		{Table: "school_settings", Name: "supervisor_nip", SQLType: "TEXT"},
		{Table: "school_settings", Name: "last_letter_number", SQLType: "INTEGER", Default: "0"},
		{Table: "school_settings", Name: "letter_number_format", SQLType: "TEXT", Default: "'421/{nomor}/SDN1-KNG/{bulan}/{tahun}'"},
		{Table: "school_settings", Name: "created_at", SQLType: "INTEGER"},
		{Table: "school_settings", Name: "updated_at", SQLType: "INTEGER"},

		// employee details
		{Table: "employee_details", Name: "phone", SQLType: "TEXT"},

		// audit logs
		{Table: "audit_logs", Name: "details", SQLType: "TEXT"},
		{Table: "audit_logs", Name: "user_id", SQLType: "TEXT"},
		{Table: "audit_logs", Name: "user_name", SQLType: "TEXT"},
		{Table: "audit_logs", Name: "user_email", SQLType: "TEXT"},
		{Table: "audit_logs", Name: "ip_address", SQLType: "TEXT"},
		{Table: "audit_logs", Name: "user_agent", SQLType: "TEXT"},
		{Table: "audit_logs", Name: "created_at", SQLType: "INTEGER"},

		// e-office letter generator
		{Table: "letter_templates", Name: "content", SQLType: "TEXT"},
		{Table: "letter_templates", Name: "file_path", SQLType: "TEXT"},
		{Table: "letter_templates", Name: "type", SQLType: "TEXT", Default: "'EDITOR'"},
		{Table: "letter_templates", Name: "paper_size", SQLType: "TEXT", Default: "'A4'"},
		{Table: "letter_templates", Name: "orientation", SQLType: "TEXT", Default: "'portrait'"},
		{Table: "letter_templates", Name: "is_active", SQLType: "INTEGER", Default: "1"},
		{Table: "letter_templates", Name: "created_at", SQLType: "INTEGER"},
		{Table: "letter_templates", Name: "updated_at", SQLType: "INTEGER"},
		{Table: "generated_letters", Name: "classification_code", SQLType: "TEXT"},
		{Table: "generated_letters", Name: "sequence_number", SQLType: "INTEGER"},
		{Table: "generated_letters", Name: "recipient", SQLType: "TEXT"},
		{Table: "generated_letters", Name: "template_id", SQLType: "TEXT"},
		{Table: "generated_letters", Name: "created_at", SQLType: "INTEGER"},

		// spmb
		{Table: "spmb_periods", Name: "year", SQLType: "TEXT", Default: fmt.Sprintf("'%d'", time.Now().Year())},
		{Table: "spmb_periods", Name: "academic_year", SQLType: "TEXT", Default: fmt.Sprintf("'%d/%d'", time.Now().Year(), time.Now().Year()+1)},
		{Table: "spmb_periods", Name: "committee_name", SQLType: "TEXT"},
		{Table: "spmb_periods", Name: "status", SQLType: "TEXT", Default: "'draft'"},
		{Table: "spmb_periods", Name: "quota", SQLType: "INTEGER", Default: "100"},
		{Table: "spmb_periods", Name: "updated_at", SQLType: "INTEGER"},
		{Table: "spmb_registrants", Name: "nisn", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "kk_number", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "birth_certificate_no", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "birth_place", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "birth_date", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "gender", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "religion", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "special_needs", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "living_arrangement", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "transport_mode", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "child_order", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "has_kps_pkh", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "has_kip", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "previous_school", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "hobby", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "ambition", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "height", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "weight", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "head_circumference", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "sibling_count", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "travel_time", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "address_street", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "address_rt", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "address_rw", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "address_village", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "postal_code", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "home_address", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "home_lat", SQLType: "REAL", Default: "0"},
		{Table: "spmb_registrants", Name: "home_lng", SQLType: "REAL", Default: "0"},
		{Table: "spmb_registrants", Name: "distance_km", SQLType: "REAL", Default: "0"},
		{Table: "spmb_registrants", Name: "is_in_zone", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "parent_phone", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "parent_email", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_name", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_nik", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_birth_year", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_education", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_job", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_income", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_name", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_nik", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_birth_year", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_education", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_job", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_income", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_name", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_nik", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_birth_year", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_education", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_job", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_income", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "status", SQLType: "TEXT", Default: "'pending'"},
		{Table: "spmb_registrants", Name: "period_id", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "notes", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "documents", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "verified_by", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "verified_at", SQLType: "INTEGER"},
		{Table: "spmb_registrants", Name: "created_at", SQLType: "INTEGER"},
		{Table: "spmb_registrants", Name: "updated_at", SQLType: "INTEGER"},

		// alumni buku induk
		{Table: "alumni", Name: "status", SQLType: "TEXT", Default: "'graduated'"},
		{Table: "alumni", Name: "nik", SQLType: "TEXT"},
		{Table: "alumni", Name: "religion", SQLType: "TEXT"},
		{Table: "alumni", Name: "address", SQLType: "TEXT"},
		{Table: "alumni", Name: "enrolled_year", SQLType: "TEXT"},
		{Table: "alumni", Name: "previous_school", SQLType: "TEXT"},
		{Table: "alumni", Name: "father_name", SQLType: "TEXT"},
		{Table: "alumni", Name: "father_nik", SQLType: "TEXT"},
		{Table: "alumni", Name: "father_education", SQLType: "TEXT"},
		{Table: "alumni", Name: "father_job", SQLType: "TEXT"},
		{Table: "alumni", Name: "mother_name", SQLType: "TEXT"},
		{Table: "alumni", Name: "mother_nik", SQLType: "TEXT"},
		{Table: "alumni", Name: "mother_education", SQLType: "TEXT"},
		{Table: "alumni", Name: "mother_job", SQLType: "TEXT"},
		{Table: "alumni", Name: "guardian_name", SQLType: "TEXT"},
		{Table: "alumni", Name: "guardian_nik", SQLType: "TEXT"},
		{Table: "alumni", Name: "guardian_relation", SQLType: "TEXT"},
		{Table: "alumni", Name: "guardian_job", SQLType: "TEXT"},
		{Table: "alumni", Name: "guardian_phone", SQLType: "TEXT"},
		{Table: "alumni", Name: "sibling_count", SQLType: "INTEGER", Default: "0"},
		{Table: "alumni", Name: "child_order", SQLType: "INTEGER", Default: "0"},
		{Table: "alumni", Name: "height", SQLType: "INTEGER", Default: "0"},
		{Table: "alumni", Name: "weight", SQLType: "INTEGER", Default: "0"},
		{Table: "alumni", Name: "blood_type", SQLType: "TEXT"},
		{Table: "alumni", Name: "medical_notes", SQLType: "TEXT"},
		{Table: "alumni", Name: "special_needs", SQLType: "TEXT"},
		{Table: "alumni", Name: "current_occupation", SQLType: "TEXT"},
		{Table: "alumni", Name: "current_institution", SQLType: "TEXT"},
		{Table: "alumni", Name: "last_education_level", SQLType: "TEXT"},
		{Table: "alumni", Name: "final_grade_avg", SQLType: "REAL"},

		// content management
		{Table: "gallery", Name: "public_id", SQLType: "TEXT"},
		{Table: "gallery", Name: "updated_at", SQLType: "INTEGER"},
		{Table: "announcements", Name: "thumbnail", SQLType: "TEXT"},
		{Table: "announcements", Name: "is_published", SQLType: "INTEGER"},
		{Table: "announcements", Name: "is_featured", SQLType: "INTEGER"},
		{Table: "announcements", Name: "published_at", SQLType: "INTEGER"},
		{Table: "announcements", Name: "author_id", SQLType: "TEXT"},
		{Table: "announcements", Name: "cover_image", SQLType: "TEXT"},
		{Table: "announcements", Name: "status", SQLType: "TEXT", Default: "'PUBLISHED'"},

		// savings
		{Table: "tabungan_transaksi", Name: "setoran_id", SQLType: "TEXT"},
		{Table: "tabungan_brankas", Name: "pic_id", SQLType: "TEXT"},

		// employee_details
		{Table: "employee_details", Name: "category", SQLType: "TEXT"},
		{Table: "employee_details", Name: "degree", SQLType: "TEXT"},
		{Table: "employee_details", Name: "quote", SQLType: "TEXT"},
		{Table: "employee_details", Name: "photo_url", SQLType: "TEXT"},
		{Table: "employee_details", Name: "display_order", SQLType: "INTEGER", Default: "0"},
		{Table: "employee_details", Name: "name_without_degree", SQLType: "TEXT"},
	}

	for _, col := range fixes {
		// More compatible way to check if column exists in SQLite
		rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", col.Table))
		if err != nil {
			continue
		}

		exists := false
		for rows.Next() {
			var cid int
			var name, dtype string
			var notnull, pk int
			var dflt_value interface{}
			if err := rows.Scan(&cid, &name, &dtype, &notnull, &dflt_value, &pk); err == nil {
				if name == col.Name {
					exists = true
					break
				}
			}
		}
		rows.Close()

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", col.Table, col.Name, col.SQLType)
			if col.Default != "" {
				alterQuery += fmt.Sprintf(" DEFAULT %s", col.Default)
			}
			_, err := db.Exec(alterQuery)
			if err != nil {
				logger.Warnf("Failed to add column %s to table %s: %v", col.Name, col.Table, err)
			} else {
				logger.Infof("Added missing column %s to table %s", col.Name, col.Table)
			}
		}
	}

	if _, err := db.Exec(`
		UPDATE gallery
		SET updated_at = COALESCE(updated_at, created_at, strftime('%s','now') * 1000)
		WHERE updated_at IS NULL OR updated_at = 0;
	`); err != nil {
		logger.Warnf("Failed to backfill gallery updated_at: %v", err)
	}

	if _, err := db.Exec(`
		INSERT OR IGNORE INTO gallery (id, title, description, category, image_url, public_id, created_at, updated_at)
		SELECT id, title, description, category, image_url, public_id, created_at, updated_at
		FROM galleries;
	`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "no such table") {
			logger.Warnf("Skipped legacy galleries sync: %v", err)
		}
	}

	if _, err := db.Exec(`
		UPDATE announcements
		SET thumbnail = cover_image
		WHERE (thumbnail IS NULL OR thumbnail = '')
		  AND cover_image IS NOT NULL
		  AND cover_image != '';
	`); err != nil {
		logger.Warnf("Failed to backfill announcement thumbnails: %v", err)
	}

	if _, err := db.Exec(`
		UPDATE announcements
		SET is_published = CASE
			WHEN UPPER(COALESCE(status, 'PUBLISHED')) = 'PUBLISHED' THEN 1
			ELSE 0
		END
		WHERE is_published IS NULL;
	`); err != nil {
		logger.Warnf("Failed to backfill announcement publish status: %v", err)
	}

	if _, err := db.Exec(`
		UPDATE announcements
		SET is_featured = 0
		WHERE is_featured IS NULL;
	`); err != nil {
		logger.Warnf("Failed to backfill announcement featured status: %v", err)
	}

	if _, err := db.Exec(`
		UPDATE announcements
		SET published_at = COALESCE(created_at, updated_at, strftime('%s','now') * 1000)
		WHERE is_published = 1
		  AND (published_at IS NULL OR published_at = 0);
	`); err != nil {
		logger.Warnf("Failed to backfill announcement published_at: %v", err)
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS library_qr_batches (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			prefix TEXT NOT NULL,
			start_sequence INTEGER NOT NULL,
			end_sequence INTEGER NOT NULL,
			batch_size INTEGER NOT NULL,
			created_at INTEGER
		)
	`); err != nil {
		logger.Warnf("Failed to ensure library_qr_batches table: %v", err)
	}
}

func SeedDefaultAdmin(db *sql.DB, logger echo.Logger) {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil || count > 0 {
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		logger.Warnf("Failed to hash admin password: %v", err)
		return
	}

	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err = db.Exec(`INSERT OR IGNORE INTO users (id, email, username, password_hash, role, name, full_name, is_active, must_change_password, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
		id, "admin@sekolah.sch.id", "admin", string(hash), "superadmin", "Administrator", "Administrator Sekolah", now, now)
	if err != nil {
		logger.Warnf("Failed to seed admin user: %v", err)
		return
	}
	logger.Info("Default admin user created (admin@sekolah.sch.id / admin123) — wajib ganti password setelah login pertama.")
}

func SeedDefaultKlasifikasi(db *sql.DB, logger echo.Logger) {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM klasifikasi_surat").Scan(&count); err != nil || count > 0 {
		return
	}

	presets := []struct {
		Code        string
		Name        string
		Description string
	}{
		{"400.3.5.01", "Penerimaan Peserta Didik Baru (PPDB)", "Surat dan berkas administrasi penerimaan siswa baru."},
		{"400.3.5.02", "Kelulusan dan Kenaikan Kelas", "Surat keterangan kelulusan, kenaikan kelas, rapat kelulusan, dsb."},
		{"400.3.5.03", "Proses Belajar Mengajar & Kurikulum", "Rencana pembelajaran, pembagian tugas mengajar, kalender akademik."},
		{"400.3.5.04", "Penilaian, Ujian, dan Evaluasi", "Administrasi ujian sekolah, penilaian harian, tengah semester, dsb."},
		{"400.3.5.05", "Kegiatan Ekstrakurikuler & OSIS", "Surat izin kegiatan kesiswaan di luar jam sekolah, kepramukaan, dsb."},
		{"400.3.5.06", "Beasiswa & Bantuan Siswa", "Administrasi PIP, KIP, beasiswa berprestasi, dsb."},
		{"400.3.5.07", "Pelaporan Kemajuan Belajar (Rapor)", "Surat undangan pembagian rapor, laporan berkala, dsb."},
		{"400.3.5.08", "Pendidik & Tenaga Kependidikan", "Berkas penugasan guru, surat tugas pelatihan, pembinaan PTK."},
		{"400.3.5.09", "Mutasi dan Pindahan Siswa", "Surat keterangan pindah sekolah (keluar/masuk) beserta kelengkapannya."},
		{"400.3.5.10", "Ijazah & Sertifikat Kelulusan", "Administrasi penyerahan ijazah, penulisan ijazah, ralat ijazah, dsb."},
		{"400.3.5.11", "Tata Tertib & Kedisiplinan Siswa", "Surat pemanggilan orang tua, surat peringatan siswa, tata tertib sekolah."},
		{"400.3.5.12", "Administrasi Personalia & SK", "Surat Keputusan (SK) Kepala Sekolah, SK pembagian tugas, dsb."},
		{"421", "Umum / Pendidikan", "Klasifikasi umum penyelenggaraan pendidikan dinas sekolah."},
	}

	tx, err := db.Begin()
	if err != nil {
		logger.Warnf("Failed to start transaction for seeding classifications: %v", err)
		return
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("INSERT INTO klasifikasi_surat (code, name, description, is_active) VALUES (?, ?, ?, 1)")
	if err != nil {
		logger.Warnf("Failed to prepare statement for seeding classifications: %v", err)
		return
	}
	defer stmt.Close()

	for _, p := range presets {
		if _, err := stmt.Exec(p.Code, p.Name, p.Description); err != nil {
			logger.Warnf("Failed to seed classification %s: %v", p.Code, err)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		logger.Warnf("Failed to commit transaction for seeding classifications: %v", err)
		return
	}

	logger.Info("Default letter classification codes seeded successfully!")
}
