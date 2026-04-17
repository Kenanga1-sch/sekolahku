package main

import (
	"context"
	"database/sql"
	"embed"
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
	_ "modernc.org/sqlite"
	"github.com/sekolahku/go-backend/internal/handlers"
	authMiddleware "github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/repository"
)

//go:embed all:dist
var frontendFiles embed.FS

func main() {
	startTime := time.Now()
	server := echo.New()

	// Global Middleware
	server.Use(middleware.Logger())
	server.Use(middleware.Recover())
	server.Use(middleware.CORS())

	// Database initialization
	dbPath := filepath.Join("data", "sekolahku.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		server.Logger.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		server.Logger.Fatal("Database ping failed:", err)
	}

	// Repositories
	userRepo := repository.NewUserRepository(db)
	academicRepo := repository.NewAcademicRepository(db)
	financeRepo := repository.NewFinanceRepository(db)
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
	publicGroup.GET("/spmb/registrants/:number", spmbHandler.GetRegistrant)
	publicGroup.POST("/contact", contactHandler.SubmitMessage)
	publicGroup.GET("/mutasi/status/:regNum", mutasiHandler.GetPublicMutasiStatus)
	publicGroup.POST("/mutasi-keluar/validate", mutasiHandler.ValidatePublicMutasiOut)
	publicGroup.POST("/mutasi-keluar/request", mutasiHandler.CreatePublicMutasiOutRequest)
	publicGroup.POST("/tabungan/check-balance", savingsHandler.CheckPublicBalance)

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
	auth.DELETE("/finance/categories/:id", financeHandler.DeleteCategory)
	auth.GET("/finance/transactions", financeHandler.GetTransactions)
	auth.POST("/finance/transactions", financeHandler.CreateTransaction)
	auth.DELETE("/finance/transactions/:id", financeHandler.DeleteTransaction)

	// Inventory Admin
	auth.GET("/inventory/stats", inventoryHandler.GetStats)
	auth.GET("/inventory/rooms", inventoryHandler.GetRooms)
	auth.GET("/inventory/rooms/:id", inventoryHandler.GetRoom)
	auth.POST("/inventory/rooms", inventoryHandler.CreateRoom)
	auth.PUT("/inventory/rooms/:id", inventoryHandler.UpdateRoom)
	auth.DELETE("/inventory/rooms/:id", inventoryHandler.DeleteRoom)
	auth.GET("/inventory/assets", inventoryHandler.GetAssets)
	auth.POST("/inventory/assets", inventoryHandler.CreateAsset)
	auth.PUT("/inventory/assets/:id", inventoryHandler.UpdateAsset)
	auth.DELETE("/inventory/assets/:id", inventoryHandler.DeleteAsset)
	auth.GET("/inventory/items", inventoryHandler.GetItems)
	auth.POST("/inventory/items", inventoryHandler.CreateItem)
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
	auth.PATCH("/spmb/registrants/:id", spmbHandler.UpdateStatus)
	auth.DELETE("/spmb/registrants/:id", spmbHandler.DeleteRegistrant)
	auth.POST("/spmb/registrants/:id/promote", spmbHandler.PromoteRegistrant)

	// Master Data Admin
	auth.GET("/master/students", studentHandler.GetStudents)
	auth.GET("/master/students/:id", studentHandler.GetStudentByID)
	auth.POST("/master/students", studentHandler.CreateStudent)
	auth.PUT("/master/students/:id", studentHandler.UpdateStudent)
	auth.DELETE("/master/students/:id", studentHandler.DeleteStudent)

	// Aliases for legacy frontend paths
	auth.GET("/students", studentHandler.GetStudents)
	auth.GET("/students/:id", studentHandler.GetStudentByID)
	auth.POST("/students", studentHandler.CreateStudent)
	auth.PUT("/students/:id", studentHandler.UpdateStudent)
	auth.DELETE("/students/:id", studentHandler.DeleteStudent)
	auth.GET("/classes", studentHandler.GetClasses)
	auth.GET("/master/employees", employeeHandler.GetEmployees)
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
	auth.GET("/savings/students/:id", savingsHandler.GetDetailSiswa)
	auth.GET("/savings/transactions", savingsHandler.GetTransactions)
	auth.POST("/savings/transactions", savingsHandler.CreateTransaksi)
	auth.GET("/savings/setoran", savingsHandler.GetSetoranList)
	auth.POST("/savings/setoran", savingsHandler.CreateSetoran)
	auth.POST("/savings/setoran/verify", savingsHandler.VerifySetoran)
	auth.GET("/savings/brankas", savingsHandler.GetBrankasStatus)
	auth.GET("/savings/brankas/summary", savingsHandler.GetBrankasSummary)
	auth.POST("/savings/brankas/transfer", savingsHandler.TransferBrankas)
	auth.GET("/savings/hutang", savingsHandler.GetHutangList)

	// Library Admin
	auth.GET("/library/stats", libraryHandler.GetStats)
	auth.GET("/library/books", libraryHandler.GetBooks)
	auth.POST("/library/books", libraryHandler.CreateBook)
	auth.PUT("/library/books/:id", libraryHandler.UpdateBook)
	auth.DELETE("/library/books/:id", libraryHandler.DeleteBook)
	auth.GET("/library/members", libraryHandler.GetMembers)
	auth.POST("/library/members", libraryHandler.CreateMember)
	auth.PATCH("/library/members/:id", libraryHandler.UpdateMember)
	auth.DELETE("/library/members/:id", libraryHandler.DeleteMember)
	auth.GET("/library/loans", libraryHandler.GetLoans)
	auth.POST("/library/loans", libraryHandler.BorrowBook)
	auth.POST("/library/loans/:id/return", libraryHandler.ReturnBook)

	// Announcements Admin
	auth.GET("/announcements", announcementHandler.GetAnnouncements)
	auth.POST("/announcements", announcementHandler.CreateAnnouncement)
	auth.PUT("/announcements/:id", announcementHandler.UpdateAnnouncement)
	auth.DELETE("/announcements/:id", announcementHandler.DeleteAnnouncement)

	// User Management Admin
	auth.GET("/users", userHandler.GetUsers)
	auth.POST("/users", userHandler.CreateUser)
	auth.PATCH("/users/:id", userHandler.UpdateUser)
	auth.DELETE("/users/:id", userHandler.DeleteUser)
	auth.POST("/users/generate", userHandler.GenerateAccounts)

	// Other Admin
	auth.GET("/audit-logs", auditLogHandler.GetLogs)
	auth.GET("/school-settings", settingHandler.GetSettings)
	auth.POST("/school-settings", settingHandler.UpdateSettings)
	auth.GET("/gallery", galleryHandler.GetGallery)
	auth.POST("/gallery/upload", galleryHandler.Upload)
	auth.DELETE("/gallery/:id", galleryHandler.Delete)

	// E-Office Admin
	auth.GET("/eoffice/arsip/stats", eofficeHandler.GetArsipStats)
	auth.GET("/eoffice/klasifikasi", eofficeHandler.GetKlasifikasi)
	auth.POST("/eoffice/letter-numbering", eofficeHandler.Numbering)
	auth.POST("/eoffice/letter-increment", eofficeHandler.Increment)
	auth.GET("/eoffice/surat-masuk", eofficeHandler.GetSuratMasuk)
	auth.POST("/eoffice/surat-masuk", eofficeHandler.CreateSuratMasuk)
	auth.GET("/eoffice/surat-keluar", eofficeHandler.GetSuratKeluar)
	auth.GET("/eoffice/letter-templates", eofficeHandler.GetLetterTemplates)
	auth.GET("/eoffice/letter-templates/:id", eofficeHandler.GetLetterTemplateByID)
	auth.POST("/eoffice/letter-templates", eofficeHandler.CreateLetterTemplate)
	auth.DELETE("/eoffice/letter-templates/:id", eofficeHandler.DeleteLetterTemplate)

	// Academic Advanced Admin
	auth.POST("/academic/adv/scan", academicAdvHandler.RecordQRScan)
	auth.POST("/academic/adv/bulk-grades", academicAdvHandler.BulkGrades)

	// Attendance Admin
	auth.GET("/attendance/stats", attendanceHandler.GetStats)
	auth.GET("/attendance/sessions", attendanceHandler.GetSessions)
	auth.POST("/attendance/sessions", attendanceHandler.CreateSession)
	auth.GET("/attendance/sessions/:id", attendanceHandler.GetSessionByID)
	auth.PATCH("/attendance/sessions/:id", attendanceHandler.UpdateSession)
	auth.POST("/attendance/manual", attendanceHandler.RecordManual)
	auth.POST("/attendance/scan", attendanceHandler.ScanQR)
	auth.GET("/attendance/export", attendanceHandler.ExportCSV)

	// Loan Admin
	auth.GET("/loans", loanHandler.GetLoans)
	auth.POST("/loans", loanHandler.CreateLoan)
	auth.POST("/loans/:id/approve", loanHandler.ApproveLoan)
	auth.POST("/loans/:id/pay", loanHandler.AddPayment)
	auth.POST("/loans/:id/reject", loanHandler.RejectLoan)

	// Alumni Admin
	auth.GET("/alumni/stats", alumniHandler.GetAlumniStats)
	auth.GET("/alumni", alumniHandler.GetAlumni)
	auth.GET("/alumni/:id", alumniHandler.GetAlumniByID)
	auth.POST("/alumni", alumniHandler.CreateAlumni)
	auth.PATCH("/alumni/:id", alumniHandler.UpdateAlumni)
	auth.DELETE("/alumni/:id", alumniHandler.DeleteAlumni)
	auth.GET("/alumni/document-types", alumniHandler.GetDocumentTypes)
	auth.POST("/alumni/:id/documents", alumniHandler.CreateDocument)
	auth.POST("/alumni/:id/pickups", alumniHandler.CreatePickup)
	
	// Mutasi Admin Pages (Explicitly prefixed /admin/)
	auth.GET("/admin/mutasi", func(c echo.Context) error { return c.NoContent(http.StatusNotImplemented) }) // Placeholder if needed
	auth.GET("/admin/mutasi-keluar", func(c echo.Context) error { return c.NoContent(http.StatusNotImplemented) }) // Placeholder if needed

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

	// Upload routes (General)
	server.POST("/api/upload", uploadHandler.GeneralUpload)
	server.POST("/api/spmb/upload", spmbHandler.UploadDocuments)

	// Static file server
	uploadPath := filepath.Join("uploads")
	subDirs := []string{"announcements", "spmb", "profiles", "gallery", "alumni"}
	for _, d := range subDirs {
		_ = os.MkdirAll(filepath.Join(uploadPath, d), 0755)
	}
	server.Static("/uploads", uploadPath)

	// SPA Fallback logic
	frontendFS := getFrontendFS()
	server.GET("/_next/*", echo.WrapHandler(http.FileServer(frontendFS)))
	server.GET("/images/*", echo.WrapHandler(http.FileServer(frontendFS)))
	server.GET("/favicon.ico", echo.WrapHandler(http.FileServer(frontendFS)))

	server.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			path := c.Request().URL.Path
			if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/_next/") ||
				strings.HasPrefix(path, "/uploads/") || strings.HasPrefix(path, "/images/") {
				return next(c)
			}
			cleanPath := strings.TrimPrefix(path, "/")
			if cleanPath == "" {
				return serveEmbeddedFile(c, frontendFS, "index.html")
			}
			if !strings.Contains(cleanPath, ".") {
				altPath := cleanPath + ".html"
				if fileExists(frontendFS, altPath) {
					return serveEmbeddedFile(c, frontendFS, altPath)
				}
			}
			if fileExists(frontendFS, cleanPath) {
				return serveEmbeddedFile(c, frontendFS, cleanPath)
			}
			return serveEmbeddedFile(c, frontendFS, "index.html")
		}
	})

	// Server start
	go func() {
		if err := server.Start(":8181"); err != nil && err != http.ErrServerClosed {
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
	f.Close()
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
	http.ServeContent(c.Response(), c.Request(), name, d.ModTime(), f)
	return nil
}
