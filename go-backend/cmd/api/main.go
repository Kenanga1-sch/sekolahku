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
	"github.com/sekolahku/go-backend/internal/db/migrations"
	"github.com/sekolahku/go-backend/internal/handlers"
	authMiddleware "github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/repository"
	"github.com/sekolahku/go-backend/internal/scheduler"
	_ "modernc.org/sqlite"
)

//go:embed all:dist
var frontendFiles embed.FS

func main() {
	startTime := time.Now()
	server := echo.New()

	// Global Middleware
	server.Use(middleware.Logger())
	server.Use(middleware.Recover())
	server.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 5,
	}))
	server.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:3001",
			"http://127.0.0.1:3001",
		},
		AllowMethods:     []string{http.MethodGet, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	// Database initialization
	dbDir := "data"
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

	// 2. Automated Schema Repair (Add missing columns to existing DB)
	RepairDatabase(db, server.Logger)

	// Create database indexes for performance optimization
	_, err = db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
		CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);
		CREATE INDEX IF NOT EXISTS idx_spmb_registrants_period ON spmb_registrants(period_id);
	`)
	if err != nil {
		server.Logger.Warn("Failed to create database indexes:", err)
	}

	// 2. Initialize default settings if needed
	_, _ = db.Exec(`
		INSERT OR IGNORE INTO school_settings (id, school_name, current_academic_year, spmb_is_open, max_distance_km)
		VALUES ('default', 'UPTD SDN 1 Kenanga', '2026/2027', 1, 3.0);
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
			category TEXT,
			degree TEXT,
			job_type TEXT,
			quote TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			FOREIGN KEY(user_id) REFERENCES users(id)
		);
		CREATE INDEX IF NOT EXISTS idx_finance_transactions_account ON finance_transactions(account_id_source);
		CREATE INDEX IF NOT EXISTS idx_savings_transactions_siswa ON savings_transactions(siswa_id);
		CREATE INDEX IF NOT EXISTS idx_library_loans_status ON library_loans(status);
	`)
	if err != nil {
		server.Logger.Fatal("DB initialization failed:", err)
	}
	server.Logger.Info("Database initialized with default settings and SPMB period")

	// Start background scheduler
	cronScheduler := scheduler.NewScheduler(db)
	cronScheduler.Start()
	defer cronScheduler.Stop()

	// Repositories
	userRepo := repository.NewUserRepository(db)
	academicRepo := repository.NewAcademicRepository(db)
	financeRepo := repository.NewFinanceRepository(db)
	if err := financeRepo.EnsureDefaults(); err != nil {
		server.Logger.Warn("Failed to initialize default BOS finance data:", err)
	}
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
	dashboardRepo := repository.NewDashboardRepository(db, startTime)
	publicRepo := repository.NewPublicRepository(db)
	faqRepo := repository.NewFAQRepository(db)
	contactRepo := repository.NewContactRepository(db)

	// Handlers
	authHandler := handlers.NewAuthHandler(userRepo, auditLogRepo)
	academicHandler := handlers.NewAcademicHandler(academicRepo)
	financeHandler := handlers.NewFinanceHandler(financeRepo)
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
	userHandler := handlers.NewUserHandler(userRepo, studentRepo, employeeRepo, auditLogRepo)
	dashboardHandler := handlers.NewDashboardHandler(dashboardRepo)
	publicHandler := handlers.NewPublicHandler(publicRepo)
	faqHandler := handlers.NewFAQHandler(faqRepo)
	contactHandler := handlers.NewContactHandler(contactRepo)
	uploadHandler := handlers.NewUploadHandler()

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
	server.POST("/api/auth/login", authHandler.Login)
	server.POST("/api/auth/logout", authHandler.Logout)

	// Move other public routes to publicGroup in next chunk
	publicGroup := server.Group("/api/public")
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

	// Public compatibility aliases used by static public pages.
	server.POST("/api/mutasi/request", mutasiHandler.CreateMutasiRequest)
	server.GET("/api/mutasi/status/:regNum", mutasiHandler.GetPublicMutasiStatus)
	server.POST("/api/mutasi-keluar/validate", mutasiHandler.ValidatePublicMutasiOut)
	server.POST("/api/mutasi-keluar/request", mutasiHandler.CreatePublicMutasiOutRequest)

	// Admin Protected Routes
	auth := server.Group("/api")
	auth.Use(authMiddleware.JWTMiddleware)

	// Admin Dashboard
	auth.GET("/admin/dashboard/stats", dashboardHandler.GetStats)
	auth.GET("/admin/system/health", dashboardHandler.GetHealth)

	// Academic Admin
	auth.GET("/academic/active-year", academicHandler.GetActiveAcademicYear)
	auth.GET("/academic/years", academicHandler.GetAcademicYears)
	auth.POST("/academic/years", academicHandler.CreateAcademicYear)
	auth.PUT("/academic/years/:id", academicHandler.UpdateAcademicYear)
	auth.DELETE("/academic/years/:id", academicHandler.DeleteAcademicYear)
	auth.GET("/academic/subjects", academicHandler.GetSubjects)
	auth.POST("/academic/subjects", academicHandler.CreateSubject)
	auth.PUT("/academic/subjects/:id", academicHandler.UpdateSubject)
	auth.DELETE("/academic/subjects/:id", academicHandler.DeleteSubject)
	auth.GET("/academic/classes", academicHandler.GetClasses)
	auth.POST("/academic/classes", academicHandler.CreateClass)
	auth.PUT("/academic/classes/:id", academicHandler.UpdateClass)
	auth.DELETE("/academic/classes/:id", academicHandler.DeleteClass)
	auth.POST("/academic/promotion", academicHandler.ProcessPromotion)
	auth.GET("/classes/stats", academicHandler.GetClassesStats)

	// Finance Admin
	auth.GET("/finance/stats", financeHandler.GetStats)
	auth.GET("/finance/dashboard", financeHandler.GetDashboard)
	auth.GET("/finance/accounts", financeHandler.GetAccounts)
	auth.POST("/finance/accounts", financeHandler.CreateAccount)
	auth.PUT("/finance/accounts/:id", financeHandler.UpdateAccount)
	auth.DELETE("/finance/accounts/:id", financeHandler.DeleteAccount)
	auth.GET("/finance/categories", financeHandler.GetCategories)
	auth.POST("/finance/categories", financeHandler.CreateCategory)
	auth.PUT("/finance/categories/:id", financeHandler.UpdateCategory)
	auth.DELETE("/finance/categories/:id", financeHandler.DeleteCategory)
	auth.GET("/finance/transactions", financeHandler.GetTransactions)
	auth.POST("/finance/transactions", financeHandler.CreateTransaction)
	auth.PUT("/finance/transactions/:id", financeHandler.UpdateTransaction)
	auth.DELETE("/finance/transactions/:id", financeHandler.DeleteTransaction)

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

	// SPMB Admin
	auth.GET("/spmb/periods", spmbHandler.GetPeriods)
	auth.POST("/spmb/periods", spmbHandler.CreatePeriod)
	auth.PATCH("/spmb/periods/:id", spmbHandler.UpdatePeriod)
	auth.DELETE("/spmb/periods/:id", spmbHandler.DeletePeriod)
	auth.GET("/spmb/stats", spmbHandler.GetStats)
	auth.GET("/spmb/registrants", spmbHandler.GetRegistrantsAdmin)
	auth.GET("/spmb/registrants/:number", spmbHandler.GetRegistrant)
	auth.PATCH("/spmb/registrants/:id", spmbHandler.UpdateStatus)
	auth.DELETE("/spmb/registrants/:id", spmbHandler.DeleteRegistrant)
	auth.POST("/spmb/registrants/:id/promote", spmbHandler.PromoteRegistrant)

	// Master Data Admin
	auth.GET("/master/students", studentHandler.GetStudents)
	auth.GET("/master/students/health", studentHandler.GetStudentHealth)
	auth.GET("/master/students/simple-search", studentHandler.SimpleSearch)
	auth.POST("/master/students/print", studentHandler.GetStudentsForPrint)
	auth.POST("/master/students/bulk", studentHandler.BulkCreateStudents)
	auth.GET("/master/students/:id", studentHandler.GetStudentByID)
	auth.POST("/master/students", studentHandler.CreateStudent)
	auth.PUT("/master/students/:id", studentHandler.UpdateStudent)
	auth.DELETE("/master/students/:id", studentHandler.DeleteStudent)

	// Aliases for legacy frontend paths
	auth.GET("/students", studentHandler.GetStudents)
	auth.GET("/students/simple-search", studentHandler.SimpleSearch)
	auth.POST("/students/print", studentHandler.GetStudentsForPrint)
	auth.GET("/students/:id", studentHandler.GetStudentByID)
	auth.POST("/students", studentHandler.CreateStudent)
	auth.PUT("/students/:id", studentHandler.UpdateStudent)
	auth.DELETE("/students/:id", studentHandler.DeleteStudent)
	auth.GET("/classes", studentHandler.GetClasses)
	auth.GET("/master/employees", employeeHandler.GetEmployees)
	auth.POST("/master/employees/import", employeeHandler.BulkImportEmployees)
	auth.GET("/master/employees/:id", employeeHandler.GetEmployeeByID)
	auth.POST("/master/employees", employeeHandler.CreateEmployee)
	auth.PUT("/master/employees/:id", employeeHandler.UpdateEmployee)
	auth.DELETE("/master/employees/:id", employeeHandler.DeleteEmployee)

	// Staff & Profile Admin
	auth.GET("/admin/staff", staffProfileHandler.GetProfiles)
	auth.POST("/admin/staff", staffProfileHandler.CreateProfile)
	auth.PATCH("/admin/staff/:id", staffProfileHandler.UpdateProfile)
	auth.DELETE("/admin/staff/:id", staffProfileHandler.DeleteProfile)

	// FAQ & Contact Admin
	auth.GET("/faqs", faqHandler.ListFAQsAdmin)
	auth.POST("/faqs", faqHandler.CreateFAQ)
	auth.PUT("/faqs/:id", faqHandler.UpdateFAQ)
	auth.DELETE("/faqs/:id", faqHandler.DeleteFAQ)
	auth.GET("/contact-messages", contactHandler.ListMessages)
	auth.PUT("/contact-messages/:id/read", contactHandler.MarkAsRead)
	auth.DELETE("/contact-messages/:id", contactHandler.DeleteMessage)

	// Savings Admin
	auth.GET("/savings/stats", savingsHandler.GetStats)
	auth.GET("/savings/students", savingsHandler.GetSiswa)
	auth.POST("/savings/students", savingsHandler.CreateSiswa)
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
	tabunganGroup.GET("/siswa", savingsHandler.GetSiswa)
	tabunganGroup.POST("/siswa", savingsHandler.CreateSiswa)
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
	tabunganGroup.GET("/kelas", savingsHandler.GetClassesWithReps)
	tabunganGroup.POST("/kelas", savingsHandler.CreateKelas)
	tabunganGroup.PUT("/kelas/:id", savingsHandler.UpdateKelas)
	tabunganGroup.DELETE("/kelas/:id", savingsHandler.DeleteKelas)
	tabunganGroup.GET("/laporan/akhir-tahun", savingsHandler.GetFinalReport)
	tabunganGroup.GET("/rekening-koran", savingsHandler.GetStatement)
	tabunganGroup.GET("/rekening-koran/verify/detail", savingsHandler.VerifyStatement)

	// Library Admin
	auth.GET("/library/stats", libraryHandler.GetStats)
	auth.GET("/library/books", libraryHandler.GetBooks)
	auth.GET("/library/books/qr/:code", libraryHandler.GetBookByQRCode)
	auth.POST("/library/books", libraryHandler.CreateBook)
	auth.PUT("/library/books/:id", libraryHandler.UpdateBook)
	auth.DELETE("/library/books/:id", libraryHandler.DeleteBook)
	auth.GET("/library/isbn/:isbn", libraryHandler.LookupISBN)
	auth.POST("/library/assets/bind", libraryHandler.BindAsset)
	auth.POST("/library/assets/swap", libraryHandler.SwapQR)
	auth.POST("/library/catalog/cover", uploadHandler.LibraryCoverUpload)
	auth.POST("/library/catalog/ai-classify", libraryHandler.AIClassify)
	auth.GET("/library/members", libraryHandler.GetMembers)
	auth.GET("/library/members/qr/:code", libraryHandler.GetMemberByQRCode)
	auth.POST("/library/members", libraryHandler.CreateMember)
	auth.PATCH("/library/members/:id", libraryHandler.UpdateMember)
	auth.DELETE("/library/members/:id", libraryHandler.DeleteMember)
	auth.POST("/library/members/sync", libraryHandler.SyncLibrary)
	auth.GET("/library/loans", libraryHandler.GetLoans)
	auth.POST("/library/loans", libraryHandler.BorrowBook)
	auth.POST("/library/loans/:id/return", libraryHandler.ReturnBook)
	auth.POST("/library/visits/manual", libraryHandler.RecordVisit)
	auth.GET("/library/visits", libraryHandler.GetVisits)
	auth.GET("/library/reports", libraryHandler.GetReports)
	auth.GET("/library/qr-generator", libraryHandler.GetQRCodeBatches)
	auth.POST("/library/qr-generator", libraryHandler.GenerateQRCodeBatch)
	auth.POST("/kiosk/scan-complete", libraryHandler.KioskScanComplete)
	auth.POST("/kiosk/scan", libraryHandler.KioskScan)
	auth.POST("/kiosk/transaction", libraryHandler.KioskTransaction)

	// Announcements Admin
	auth.GET("/announcements", announcementHandler.GetAnnouncements)
	auth.POST("/announcements", announcementHandler.CreateAnnouncement)
	auth.PUT("/announcements/:id", announcementHandler.UpdateAnnouncement)
	auth.PATCH("/announcements/:id", announcementHandler.UpdateAnnouncement)
	auth.DELETE("/announcements/:id", announcementHandler.DeleteAnnouncement)

	// User Management Admin
	auth.GET("/users", userHandler.GetUsers)
	auth.POST("/users", userHandler.CreateUser)
	auth.PATCH("/users/:id", userHandler.UpdateUser)
	auth.DELETE("/users/:id", userHandler.DeleteUser)
	auth.POST("/users/generate", userHandler.GenerateAccounts)

	// Other Admin
	auth.GET("/audit-logs", auditLogHandler.GetLogs)
	auth.POST("/audit-logs", auditLogHandler.CreateAuditLog)
	auth.GET("/school-settings", settingHandler.GetSettings)
	auth.POST("/school-settings", settingHandler.UpdateSettings)
	auth.GET("/gallery/stats", galleryHandler.GetStats)
	auth.POST("/gallery/bulk-delete", galleryHandler.BulkDelete)
	auth.GET("/gallery", galleryHandler.GetGallery)
	auth.POST("/gallery/upload", galleryHandler.Upload)
	auth.PUT("/gallery/:id", galleryHandler.Update)
	auth.PATCH("/gallery/:id", galleryHandler.Update)
	auth.DELETE("/gallery/:id", galleryHandler.Delete)

	// E-Office Admin
	auth.GET("/eoffice/arsip/stats", eofficeHandler.GetArsipStats)
	auth.GET("/eoffice/klasifikasi", eofficeHandler.GetKlasifikasi)
	auth.POST("/eoffice/letter-numbering", eofficeHandler.Numbering)
	auth.POST("/eoffice/letter-increment", eofficeHandler.Increment)
	auth.GET("/eoffice/surat-masuk", eofficeHandler.GetSuratMasuk)
	auth.POST("/eoffice/surat-masuk", eofficeHandler.CreateSuratMasuk)
	auth.GET("/eoffice/surat-keluar", eofficeHandler.GetSuratKeluar)
	auth.POST("/eoffice/surat-keluar", eofficeHandler.CreateSuratKeluar)
	auth.GET("/eoffice/surat-masuk/detail", eofficeHandler.GetSuratMasukDetail)
	auth.GET("/eoffice/surat-keluar/detail", eofficeHandler.GetSuratKeluarDetail)
	auth.POST("/eoffice/disposisi", eofficeHandler.CreateDisposisi)
	auth.GET("/eoffice/letter-templates", eofficeHandler.GetLetterTemplates)
	auth.GET("/eoffice/letter-templates/:id", eofficeHandler.GetLetterTemplateByID)
	auth.GET("/eoffice/letter-templates/:id/variables", eofficeHandler.GetTemplateVariables)
	auth.POST("/eoffice/letter-templates", eofficeHandler.CreateLetterTemplate)
	auth.PATCH("/eoffice/letter-templates/:id", eofficeHandler.UpdateLetterTemplate)
	auth.POST("/eoffice/letter-batch-generate", eofficeHandler.GenerateBatch)
	auth.DELETE("/eoffice/letter-templates/:id", eofficeHandler.DeleteLetterTemplate)

	// Arsip route aliases (frontend uses /api/arsip/*)
	auth.GET("/arsip/stats", eofficeHandler.GetArsipStats)
	auth.GET("/arsip/surat-masuk", eofficeHandler.GetSuratMasuk)
	auth.GET("/arsip/surat-masuk/detail", eofficeHandler.GetSuratMasukDetail)
	auth.POST("/arsip/surat-masuk", eofficeHandler.CreateSuratMasuk)
	auth.GET("/arsip/surat-keluar", eofficeHandler.GetSuratKeluar)
	auth.GET("/arsip/surat-keluar/detail", eofficeHandler.GetSuratKeluarDetail)
	auth.POST("/arsip/surat-keluar", eofficeHandler.CreateSuratKeluar)
	auth.PATCH("/arsip/surat-keluar/detail", eofficeHandler.UpdateSuratKeluar)
	auth.POST("/arsip/disposisi", eofficeHandler.CreateDisposisi)
	auth.GET("/arsip/klasifikasi", eofficeHandler.GetKlasifikasi)

	// Academic Advanced Admin
	auth.POST("/academic/adv/scan", academicAdvHandler.RecordQRScan)
	auth.POST("/academic/adv/bulk-grades", academicAdvHandler.BulkGrades)

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

	// Loan Admin
	auth.GET("/loans", loanHandler.GetLoans)
	auth.POST("/loans", loanHandler.CreateLoan)
	auth.POST("/loans/:id/approve", loanHandler.ApproveLoan)
	auth.POST("/loans/:id/pay", loanHandler.AddPayment)
	auth.POST("/loans/:id/reject", loanHandler.RejectLoan)

	// Alumni Admin
	auth.GET("/alumni/stats", alumniHandler.GetAlumniStats)
	auth.GET("/alumni/document-types", alumniHandler.GetDocumentTypes)
	auth.POST("/alumni/graduate", alumniHandler.GraduateStudents)
	auth.GET("/alumni", alumniHandler.GetAlumni)
	auth.POST("/alumni", alumniHandler.CreateAlumni)
	auth.GET("/alumni/documents/:docId/download", alumniHandler.DownloadDocument)
	auth.POST("/alumni/documents/:docId/verify", alumniHandler.VerifyDocument)
	auth.DELETE("/alumni/documents/:docId", alumniHandler.DeleteDocument)
	auth.GET("/alumni/:id", alumniHandler.GetAlumniByID)
	auth.PUT("/alumni/:id", alumniHandler.UpdateAlumni)
	auth.PATCH("/alumni/:id", alumniHandler.UpdateAlumni)
	auth.DELETE("/alumni/:id", alumniHandler.DeleteAlumni)
	auth.POST("/alumni/:id/photo", alumniHandler.UploadPhoto)
	auth.DELETE("/alumni/:id/photo", alumniHandler.RemovePhoto)
	auth.POST("/alumni/:id/documents", alumniHandler.CreateDocument)
	auth.POST("/alumni/:id/pickups", alumniHandler.CreatePickup)

	// Mutasi Admin Pages (Explicitly prefixed /admin/)
	auth.GET("/admin/mutasi", mutasiHandler.GetMutasiRequests)
	auth.PATCH("/admin/mutasi/:id", mutasiHandler.UpdateMutasiRequest)
	auth.GET("/admin/mutasi-keluar", mutasiHandler.GetMutasiOutRequests)
	auth.GET("/admin/mutasi-keluar/:id/check", mutasiHandler.CheckStudentLiability)
	auth.PATCH("/admin/mutasi-keluar/:id", mutasiHandler.UpdateMutasiOutStatus)

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

	// Upload routes (General)
	server.POST("/api/upload", uploadHandler.GeneralUpload)
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

			// Fallback to index.html for SPA client-side routing,
			// but only for paths that don't look like static files
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

	// Set content type based on extension
	ext := filepath.Ext(name)
	contentType := "text/plain"
	switch ext {
	case ".html":
		contentType = "text/html"
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
	case ".json":
		contentType = "application/json"
	}
	c.Response().Header().Set(echo.HeaderContentType, contentType)

	http.ServeContent(c.Response(), c.Request(), name, d.ModTime(), seeker)
	return nil
}

func resolvePublicUploadsDir() string {
	candidates := []string{
		filepath.Join("..", "public", "uploads"),
		filepath.Join("public", "uploads"),
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
		{Table: "school_settings", Name: "principal_name", SQLType: "TEXT"},
		{Table: "school_settings", Name: "principal_nip", SQLType: "TEXT"},
		{Table: "school_settings", Name: "last_letter_number", SQLType: "INTEGER", Default: "0"},
		{Table: "school_settings", Name: "letter_number_format", SQLType: "TEXT", Default: "'421/{nomor}/SDN1-KNG/{bulan}/{tahun}'"},
		{Table: "school_settings", Name: "created_at", SQLType: "INTEGER"},
		{Table: "school_settings", Name: "updated_at", SQLType: "INTEGER"},

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

		// content management
		{Table: "gallery", Name: "public_id", SQLType: "TEXT"},
		{Table: "gallery", Name: "updated_at", SQLType: "INTEGER"},
		{Table: "announcements", Name: "thumbnail", SQLType: "TEXT"},
		{Table: "announcements", Name: "is_published", SQLType: "INTEGER"},
		{Table: "announcements", Name: "is_featured", SQLType: "INTEGER"},
		{Table: "announcements", Name: "published_at", SQLType: "INTEGER"},
		{Table: "announcements", Name: "author_id", SQLType: "TEXT"},

		// savings
		{Table: "tabungan_transaksi", Name: "setoran_id", SQLType: "TEXT"},
		{Table: "tabungan_brankas", Name: "pic_id", SQLType: "TEXT"},
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
