package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/db/migrations"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

// initDatabase opens the SQLite database, applies PRAGMAs, runs migrations,
// creates core tables, seeds defaults, repairs schema, and creates indexes.
func initDatabase(server *echo.Echo) *sql.DB {
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

	// SQLite connection pooling tuning
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(30 * time.Minute)

	// Performance tuning
	_, err = db.Exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA synchronous = NORMAL;
		PRAGMA temp_store = MEMORY;
		PRAGMA cache_size = -2000;
		PRAGMA journal_size_limit = 10485760;
		PRAGMA auto_vacuum = INCREMENTAL;
	`)
	if err != nil {
		server.Logger.Warn("Failed to apply SQLite performance tuning:", err)
	}

	if err := db.Ping(); err != nil {
		server.Logger.Fatal("Database ping failed:", err)
	}

	// Run migrations
	if err := migrations.RunMigrations(db); err != nil {
		server.Logger.Warn("Migration failed (might be ok if tables exist):", err)
	}

	// Ensure core tables exist
	createCoreTables(db, server.Logger)

	// Enable foreign keys
	_, err = db.Exec(`PRAGMA foreign_keys = ON`)
	if err != nil {
		server.Logger.Warn("Failed to enable foreign keys:", err)
	}

	// Seed defaults
	SeedDefaultAdmin(db, server.Logger)
	SeedDefaultKlasifikasi(db, server.Logger)

	// Create indexes
	createIndexes(db, server.Logger)

	// Initialize default settings
	initDefaultSettings(db, server.Logger)

	// Create alumni tables
	createAlumniTables(db, server.Logger)

	// Create admin notifications table
	createAdminNotifications(db, server.Logger)

	// Seed integration settings
	seedIntegrationSettings(db, server.Logger)

	// Automated schema repair
	RepairDatabase(db, server.Logger)

	server.Logger.Info("Database initialized with default settings and core tables")
	return db
}

func createCoreTables(db *sql.DB, logger echo.Logger) {
	_, err := db.Exec(`
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
	`)
	if err != nil {
		logger.Warn("Failed to create core tables:", err)
	}
}

func createIndexes(db *sql.DB, logger echo.Logger) {
	_, err := db.Exec(`
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
		logger.Warn("Failed to create database indexes:", err)
	}
}

func initDefaultSettings(db *sql.DB, logger echo.Logger) {
	// Gunakan env vars jika ada, fallback ke default
	schoolName := getEnvOrDefault("SCHOOL_NAME", "UPTD SDN 1 Kenanga")
	academicYear := getEnvOrDefault("ACADEMIC_YEAR", "2026/2027")
	maxDistance := getEnvOrDefault("MAX_DISTANCE_KM", "3.0")

	if _, err := db.Exec(`
		INSERT OR IGNORE INTO school_settings (id, school_name, current_academic_year, spmb_is_open, max_distance_km)
		VALUES ('default', ?, ?, 1, ?)
	`, schoolName, academicYear, maxDistance); err != nil {
		logger.Warn("Failed to initialize default settings:", err)
	}

	// Clean up duplicate settings rows
	if _, err := db.Exec("DELETE FROM school_settings WHERE id != 'default'"); err != nil {
		logger.Warn("Failed to clean up duplicate settings rows:", err)
	}
}

func createAlumniTables(db *sql.DB, logger echo.Logger) {
	_, err := db.Exec(`
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
	`)
	if err != nil {
		logger.Warn("Failed to create alumni Buku Induk tables:", err)
	}
}

func createAdminNotifications(db *sql.DB, logger echo.Logger) {
	_, err := db.Exec(`
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
	`)
	if err != nil {
		logger.Warn("Failed to create admin_notifications table:", err)
	}
}

func seedIntegrationSettings(db *sql.DB, logger echo.Logger) {
	var integrationCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM integration_settings").Scan(&integrationCount); err == nil && integrationCount == 0 {
		now := time.Now().UnixMilli()
		_, err = db.Exec(`
			INSERT INTO integration_settings (
				id, dapodik_url, dapodik_token, dapodik_npsn, erapor_url, erapor_token, is_sandbox, created_at, updated_at
			) VALUES ('default', 'http://localhost:5774', '', '12345678', 'http://localhost:8080', '', 1, ?, ?)
		`, now, now)
		if err != nil {
			logger.Warn("Failed to seed default integration settings:", err)
		}
	}
}

func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// SeedDefaultAdmin creates a default superadmin user if the users table is empty.
func SeedDefaultAdmin(db *sql.DB, logger echo.Logger) {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil || count > 0 {
		return
	}

	adminEmail := getEnvOrDefault("ADMIN_EMAIL", "admin@sekolah.sch.id")
	adminPassword := getEnvOrDefault("ADMIN_PASSWORD", "admin123")
	adminUsername := getEnvOrDefault("ADMIN_USERNAME", "admin")

	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		logger.Warnf("Failed to hash admin password: %v", err)
		return
	}

	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err = db.Exec(`INSERT OR IGNORE INTO users (id, email, username, password_hash, role, name, full_name, is_active, must_change_password, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
		id, adminEmail, adminUsername, string(hash), "superadmin", "Administrator", "Administrator Sekolah", now, now)
	if err != nil {
		logger.Warnf("Failed to seed admin user: %v", err)
		return
	}
	logger.Infof("Default admin user created (%s / %s) — wajib ganti password setelah login pertama.", adminEmail, adminPassword)
}

// SeedDefaultKlasifikasi creates default letter classification codes if the table is empty.
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

// RepairDatabase adds missing columns to existing tables for schema evolution.
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
		{Table: "employee_details", Name: "category", SQLType: "TEXT"},
		{Table: "employee_details", Name: "degree", SQLType: "TEXT"},
		{Table: "employee_details", Name: "quote", SQLType: "TEXT"},
		{Table: "employee_details", Name: "photo_url", SQLType: "TEXT"},
		{Table: "employee_details", Name: "display_order", SQLType: "INTEGER", Default: "0"},
		{Table: "employee_details", Name: "name_without_degree", SQLType: "TEXT"},

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
	}

	for _, col := range fixes {
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

	// Backfill gallery updated_at
	if _, err := db.Exec(`
		UPDATE gallery
		SET updated_at = COALESCE(updated_at, created_at, strftime('%s','now') * 1000)
		WHERE updated_at IS NULL OR updated_at = 0;
	`); err != nil {
		logger.Warnf("Failed to backfill gallery updated_at: %v", err)
	}

	// Migrate from legacy galleries table
	if _, err := db.Exec(`
		INSERT OR IGNORE INTO gallery (id, title, description, category, image_url, public_id, created_at, updated_at)
		SELECT id, title, description, category, image_url, public_id, created_at, updated_at
		FROM galleries;
	`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "no such table") {
			logger.Warnf("Skipped legacy galleries sync: %v", err)
		}
	}

	// Backfill announcement fields
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

	// Ensure library_qr_batches table
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