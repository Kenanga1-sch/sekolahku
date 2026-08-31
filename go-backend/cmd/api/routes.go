package main

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/sekolahku/go-backend/internal/handlers"
	authMiddleware "github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/repository"
	"net/http"
	"time"
)

// Repositories holds all repository instances.
type Repositories struct {
	User               *repository.UserRepository
	Academic           *repository.AcademicRepository
	Inventory          *repository.InventoryRepository
	SPMB               *repository.SPMBRepository
	Student            *repository.StudentRepository
	Employee           *repository.EmployeeRepository
	Savings            *repository.SavingsRepository
	Library            *repository.LibraryRepository
	EOffice            *repository.EOfficeRepository
	AcademicAdv        *repository.AcademicAdvRepository
	Attendance         *repository.AttendanceRepository
	Loan               *repository.LoanRepository
	Setting            *repository.SettingRepository
	Alumni             *repository.AlumniRepository
	Mutasi             *repository.MutasiRepository
	Gallery            *repository.GalleryRepository
	StaffProfile       *repository.StaffProfileRepository
	Announcement       *repository.AnnouncementRepository
	AuditLog           *repository.AuditLogRepository
	Notification       *repository.NotificationRepository
	TelegramBackup     *repository.TelegramBackupRepository
	Dashboard          *repository.DashboardRepository
	Public             *repository.PublicRepository
	FAQ                *repository.FAQRepository
	Contact            *repository.ContactRepository
	Sync               *repository.SyncRepository
	Integration        *repository.IntegrationRepository
	Document           *repository.DocumentRepository
	Holiday            *repository.SchoolHolidayRepository
}

// AllHandlers holds all HTTP handler instances.
type AllHandlers struct {
	Auth            *handlers.AuthHandler
	Academic        *handlers.AcademicHandler
	Inventory       *handlers.InventoryHandler
	SPMB            *handlers.SPMBHandler
	Student         *handlers.StudentHandler
	Employee        *handlers.EmployeeHandler
	Savings         *handlers.SavingsHandler
	Library         *handlers.LibraryHandler
	EOffice         *handlers.EOfficeHandler
	AcademicAdv     *handlers.AcademicAdvHandler
	Attendance      *handlers.AttendanceHandler
	Loan            *handlers.LoanHandler
	Setting         *handlers.SettingHandler
	Alumni          *handlers.AlumniHandler
	Mutasi          *handlers.MutasiHandler
	Gallery         *handlers.GalleryHandler
	StaffProfile    *handlers.StaffProfileHandler
	Announcement    *handlers.AnnouncementHandler
	AuditLog        *handlers.AuditLogHandler
	Notification    *handlers.NotificationHandler
	TelegramBackup  *handlers.TelegramBackupHandler
	User            *handlers.UserHandler
	Dashboard       *handlers.DashboardHandler
	Public          *handlers.PublicHandler
	FAQ             *handlers.FAQHandler
	Contact         *handlers.ContactHandler
	Upload          *handlers.UploadHandler
	Integration     *handlers.IntegrationHandler
	Document        *handlers.DocumentHandler
	Sync            *handlers.SyncHandler
}

// registerRoutes registers all API routes on the Echo server.
func registerRoutes(server *echo.Echo, h *AllHandlers, repos *Repositories) {
	// Public health check
	server.GET("/api/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "OK"})
	})
	server.HEAD("/api/health", func(c echo.Context) error {
		return c.NoContent(http.StatusOK)
	})

	// Rate limiter for login
	loginLimit := middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Skipper: func(c echo.Context) bool {
			return c.Path() != "/api/auth/login"
		},
		IdentifierExtractor: func(c echo.Context) (string, error) {
			return c.RealIP(), nil
		},
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      5,
			Burst:     5,
			ExpiresIn: 15 * time.Minute,
		}),
		DenyHandler: func(c echo.Context, id string, err error) error {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit"})
		},
	})
	server.POST("/api/auth/login", h.Auth.Login, loginLimit)
	server.POST("/api/auth/logout", h.Auth.Logout)

	// Rate limiter untuk endpoint pengajuan publik (anti-spam, tanpa auth)
	publicFormLimit := middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		IdentifierExtractor: func(c echo.Context) (string, error) {
			return c.RealIP(), nil
		},
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      5,
			Burst:     5,
			ExpiresIn: 15 * time.Minute,
		}),
		DenyHandler: func(c echo.Context, id string, err error) error {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "Terlalu banyak permintaan. Silakan coba lagi dalam 15 menit"})
		},
	})

	// CSRF token endpoint (available to frontend).
	// EnsureCSRFToken global middleware sudah menjalankan sebelum route ini,
	// sehingga GetCSRFToken selalu mengembalikan token yang valid.
	server.GET("/api/csrf-token", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"csrf_token": authMiddleware.GetCSRFToken(c)})
	})

	// Public routes with caching
	publicGroup := server.Group("/api/public")
	publicGroup.Use(authMiddleware.CacheMiddleware(authMiddleware.CacheConfig{
		TTL:          5 * time.Minute,
		CacheControl: "public, max-age=300",
	}))

	publicGroup.GET("/homepage", h.Public.GetHomepageData)
	publicGroup.GET("/staff", h.Public.GetPublicStaff)
	publicGroup.GET("/gallery", h.Public.GetPublicGallery)
	publicGroup.GET("/school-settings", h.Setting.GetSettings)
	publicGroup.GET("/news", h.Announcement.GetPublicAnnouncements)
	publicGroup.GET("/news/:slug", h.Announcement.GetPublicAnnouncementBySlug)
	publicGroup.GET("/faqs", h.FAQ.GetPublicFAQs)
	publicGroup.GET("/spmb/landing", h.SPMB.GetLandingData)
	publicGroup.POST("/spmb/register", h.SPMB.Register)
	publicGroup.GET("/spmb/registrants", h.SPMB.GetPublicRegistrants)
	publicGroup.GET("/spmb/registrants/:number", h.SPMB.GetRegistrant)
	publicGroup.POST("/contact", h.Contact.SubmitMessage)
	publicGroup.POST("/mutasi/request", h.Mutasi.CreateMutasiRequest, publicFormLimit)
	publicGroup.GET("/mutasi/status/:regNum", h.Mutasi.GetPublicMutasiStatus, publicFormLimit)
	publicGroup.POST("/mutasi-keluar/validate", h.Mutasi.ValidatePublicMutasiOut, publicFormLimit)
	publicGroup.POST("/mutasi-keluar/request", h.Mutasi.CreatePublicMutasiOutRequest, publicFormLimit)
	publicGroup.POST("/tabungan/check-balance", h.Savings.CheckPublicBalance)
	publicGroup.GET("/spmb/reference-date", h.SPMB.GetReferenceDate)
	publicGroup.POST("/kiosk/attendance", h.Attendance.KioskRecordAttendance)
	publicGroup.POST("/kiosk/savings-deposit", h.Savings.KioskDeposit)
	publicGroup.GET("/kiosk/savings-lookup", h.Savings.GetSiswa)
	publicGroup.POST("/sync/dapodik/students", h.Sync.SyncDapodikStudents)

	// Public compatibility aliases
	server.POST("/api/mutasi/request", h.Mutasi.CreateMutasiRequest, publicFormLimit)
	server.GET("/api/mutasi/status/:regNum", h.Mutasi.GetPublicMutasiStatus, publicFormLimit)
	server.POST("/api/mutasi-keluar/validate", h.Mutasi.ValidatePublicMutasiOut, publicFormLimit)
	server.POST("/api/mutasi-keluar/request", h.Mutasi.CreatePublicMutasiOutRequest, publicFormLimit)

	// Admin Protected Routes
	auth := server.Group("/api")
	auth.Use(authMiddleware.JWTMiddleware)

	adminGroup := auth.Group("")
	adminGroup.Use(authMiddleware.RoleMiddleware(authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin))

	bendaharaGroup := auth.Group("")
	bendaharaGroup.Use(authMiddleware.RoleMiddleware(authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin, authMiddleware.RoleBendahara))

	// Dashboard
	adminGroup.GET("/admin/dashboard/stats", h.Dashboard.GetStats)
	adminGroup.GET("/admin/system/health", h.Dashboard.GetHealth)

	// Academic
	auth.GET("/academic/active-year", h.Academic.GetActiveAcademicYear)
	adminGroup.GET("/academic/years", h.Academic.GetAcademicYears)
	adminGroup.POST("/academic/years", h.Academic.CreateAcademicYear)
	adminGroup.PUT("/academic/years/:id", h.Academic.UpdateAcademicYear)
	adminGroup.DELETE("/academic/years/:id", h.Academic.DeleteAcademicYear)
	adminGroup.GET("/academic/subjects", h.Academic.GetSubjects)
	adminGroup.POST("/academic/subjects", h.Academic.CreateSubject)
	adminGroup.PUT("/academic/subjects/:id", h.Academic.UpdateSubject)
	adminGroup.DELETE("/academic/subjects/:id", h.Academic.DeleteSubject)
	adminGroup.GET("/academic/classes", h.Academic.GetClasses)
	auth.GET("/academic/classes/suggested-capacity", h.Academic.GetSuggestedCapacity)
	adminGroup.POST("/academic/classes", h.Academic.CreateClass)
	adminGroup.PUT("/academic/classes/:id", h.Academic.UpdateClass)
	adminGroup.DELETE("/academic/classes/:id", h.Academic.DeleteClass)
	adminGroup.POST("/academic/promotion", h.Academic.ProcessPromotion)
	auth.GET("/classes/stats", h.Academic.GetClassesStats)

	// Inventory
	auth.GET("/inventory/stats", h.Inventory.GetStats)
	auth.GET("/inventory/rooms", h.Inventory.GetRooms)
	auth.GET("/inventory/rooms/:id", h.Inventory.GetRoom)
	auth.POST("/inventory/rooms", h.Inventory.CreateRoom)
	auth.PUT("/inventory/rooms/:id", h.Inventory.UpdateRoom)
	auth.DELETE("/inventory/rooms/:id", h.Inventory.DeleteRoom)
	auth.GET("/inventory/assets", h.Inventory.GetAssets)
	auth.GET("/inventory/assets/:id", h.Inventory.GetAsset)
	auth.POST("/inventory/assets", h.Inventory.CreateAsset)
	auth.PUT("/inventory/assets/:id", h.Inventory.UpdateAsset)
	auth.DELETE("/inventory/assets/:id", h.Inventory.DeleteAsset)
	auth.GET("/inventory/items", h.Inventory.GetItems)
	auth.GET("/inventory/items/:id", h.Inventory.GetItem)
	auth.POST("/inventory/items", h.Inventory.CreateItem)
	auth.PUT("/inventory/items/:id", h.Inventory.UpdateItem)
	auth.DELETE("/inventory/items/:id", h.Inventory.DeleteItem)
	auth.GET("/inventory/transactions", h.Inventory.GetTransactions)
	auth.POST("/inventory/transactions", h.Inventory.CreateTransaction)
	auth.GET("/inventory/opname", h.Inventory.GetOpnames)
	auth.POST("/inventory/opname", h.Inventory.CreateOpname)
	auth.POST("/inventory/opname/:id/apply", h.Inventory.ApplyOpname)
	auth.GET("/inventory/audit", h.Inventory.GetAuditLogs)

	// SPMB
	adminGroup.GET("/spmb/periods/active", h.SPMB.GetActivePeriod)
	adminGroup.GET("/spmb/periods", h.SPMB.GetPeriods)
	adminGroup.POST("/spmb/periods", h.SPMB.CreatePeriod)
	adminGroup.PATCH("/spmb/periods/:id", h.SPMB.UpdatePeriod)
	adminGroup.DELETE("/spmb/periods/:id", h.SPMB.DeletePeriod)
	adminGroup.GET("/spmb/stats", h.SPMB.GetStats)
	adminGroup.GET("/spmb/registrants", h.SPMB.GetRegistrantsAdmin)
	adminGroup.GET("/spmb/registrants/:number", h.SPMB.GetRegistrant)
	adminGroup.PATCH("/spmb/registrants/:id", h.SPMB.UpdateStatus)
	adminGroup.DELETE("/spmb/registrants/:id", h.SPMB.DeleteRegistrant)
	adminGroup.POST("/spmb/registrants/:id/promote", h.SPMB.PromoteRegistrant)
	adminGroup.GET("/spmb/process", h.SPMB.ProcessAcceptancePreview)
	adminGroup.POST("/spmb/process", h.SPMB.ProcessAcceptanceExecute)

	// Master Data - Students
	students := adminGroup.Group("/students")
	students.POST("/sync-buku-induk", h.Student.SyncBukuInduk)
	adminGroup.GET("/master/students", h.Student.GetStudents)
	adminGroup.GET("/master/students/health", h.Student.GetStudentHealth)
	adminGroup.GET("/master/students/simple-search", h.Student.SimpleSearch)
	adminGroup.POST("/master/students/print", h.Student.GetStudentsForPrint)
	adminGroup.POST("/master/students/bulk", h.Student.BulkCreateStudents)
	adminGroup.GET("/master/students/:id", h.Student.GetStudentByID)
	adminGroup.GET("/master/students/:id/grades", h.Student.GetStudentGrades)
	adminGroup.POST("/master/students", h.Student.CreateStudent)
	adminGroup.PUT("/master/students/:id", h.Student.UpdateStudent)
	adminGroup.DELETE("/master/students/:id", h.Student.DeleteStudent)

	// Aliases for legacy frontend paths
	adminGroup.GET("/students", h.Student.GetStudents)
	adminGroup.GET("/students/simple-search", h.Student.SimpleSearch)
	adminGroup.POST("/students/print", h.Student.GetStudentsForPrint)
	adminGroup.GET("/students/:id", h.Student.GetStudentByID)
	adminGroup.POST("/students", h.Student.CreateStudent)
	adminGroup.PUT("/students/:id", h.Student.UpdateStudent)
	adminGroup.DELETE("/students/:id", h.Student.DeleteStudent)
	auth.GET("/classes", h.Student.GetClasses)

	// Master Data - Employees
	adminGroup.GET("/master/employees", h.Employee.GetEmployees)
	adminGroup.GET("/master/employees/without-account", h.Employee.GetEmployeesWithoutAccount)
	adminGroup.POST("/master/employees/import", h.Employee.BulkImportEmployees)
	adminGroup.GET("/master/employees/:id", h.Employee.GetEmployeeByID)
	adminGroup.POST("/master/employees", h.Employee.CreateEmployee)
	adminGroup.PUT("/master/employees/:id", h.Employee.UpdateEmployee)
	adminGroup.DELETE("/master/employees/:id", h.Employee.DeleteEmployee)

	// Staff & Profile
	adminGroup.GET("/admin/staff", h.StaffProfile.GetProfiles)
	adminGroup.POST("/admin/staff", h.StaffProfile.CreateProfile)
	adminGroup.PATCH("/admin/staff/:id", h.StaffProfile.UpdateProfile)
	adminGroup.DELETE("/admin/staff/:id", h.StaffProfile.DeleteProfile)

	// FAQ & Contact
	adminGroup.GET("/faqs", h.FAQ.ListFAQsAdmin)
	adminGroup.POST("/faqs", h.FAQ.CreateFAQ)
	adminGroup.PUT("/faqs/:id", h.FAQ.UpdateFAQ)
	adminGroup.DELETE("/faqs/:id", h.FAQ.DeleteFAQ)
	adminGroup.GET("/contact-messages", h.Contact.ListMessages)
	adminGroup.PUT("/contact-messages/:id/read", h.Contact.MarkAsRead)
	adminGroup.DELETE("/contact-messages/:id", h.Contact.DeleteMessage)

	// Savings
	auth.GET("/savings/stats", h.Savings.GetStats)
	auth.GET("/savings/students", h.Savings.GetSiswa)
	auth.POST("/savings/students", h.Savings.CreateSiswa)
	auth.POST("/savings/students/sync", h.Savings.SyncSavings)
	auth.GET("/savings/students/:id", h.Savings.GetDetailSiswa)
	auth.PUT("/savings/students/:id", h.Savings.UpdateSiswa)
	auth.DELETE("/savings/students/:id", h.Savings.DeleteSiswa)
	auth.GET("/savings/transactions", h.Savings.GetTransactions)
	bendaharaGroup.POST("/savings/transactions", h.Savings.CreateTransaksi)
	auth.GET("/savings/setoran", h.Savings.GetSetoranList)
	bendaharaGroup.POST("/savings/setoran", h.Savings.CreateSetoran)
	bendaharaGroup.POST("/savings/setoran/verify", h.Savings.VerifySetoran)
	auth.GET("/savings/brankas", h.Savings.GetBrankasStatus)
	auth.GET("/savings/brankas/summary", h.Savings.GetBrankasSummary)
	bendaharaGroup.POST("/savings/brankas", h.Savings.CreateBrankas)
	bendaharaGroup.PUT("/savings/brankas/:id", h.Savings.UpdateBrankas)
	bendaharaGroup.POST("/savings/brankas/transfer", h.Savings.TransferBrankas)
	auth.GET("/savings/hutang", h.Savings.GetHutangList)
	bendaharaGroup.POST("/savings/hutang", h.Savings.CreateHutang)
	bendaharaGroup.PUT("/savings/hutang/:id", h.Savings.UpdateHutang)
	bendaharaGroup.DELETE("/savings/hutang/:id", h.Savings.CancelHutang)
	bendaharaGroup.POST("/savings/hutang/:id/pay-cash", h.Savings.PayHutangCash)
	bendaharaGroup.POST("/savings/hutang/:id/settle-savings", h.Savings.SettleHutangFromTabungan)
	auth.GET("/savings/hutang/:id/payments", h.Savings.GetHutangPayments)
	auth.GET("/savings/kelas", h.Savings.GetClassesWithReps)
	bendaharaGroup.POST("/savings/kelas", h.Savings.CreateKelas)
	bendaharaGroup.PUT("/savings/kelas/:id", h.Savings.UpdateKelas)
	bendaharaGroup.DELETE("/savings/kelas/:id", h.Savings.DeleteKelas)
	auth.GET("/savings/treasurer", h.Savings.GetTreasurer)
	bendaharaGroup.POST("/savings/treasurer", h.Savings.AssignTreasurer)
	bendaharaGroup.POST("/savings/kelas/:id/rep", h.Savings.AssignClassRep)
	auth.GET("/savings/classes/reps", h.Savings.GetClassesWithReps)
	bendaharaGroup.PUT("/savings/classes/:id/rep", h.Savings.AssignClassRep)
	auth.GET("/savings/reports/final", h.Savings.GetFinalReport)
	auth.GET("/savings/reports/statement", h.Savings.GetStatement)
	auth.GET("/savings/reports/verify", h.Savings.VerifyStatement)

	// Tabungan route aliases
	tabunganGroup := auth.Group("/tabungan")
	tabunganGroup.GET("/stats", h.Savings.GetStats)
	tabunganGroup.GET("/data", h.Savings.GetStats)
	tabunganGroup.GET("/students", h.Savings.GetSiswa)
	tabunganGroup.GET("/siswa", h.Savings.GetSiswa)
	tabunganGroup.GET("/siswa/:id", h.Savings.GetDetailSiswa)
	tabunganGroup.GET("/transactions", h.Savings.GetTransactions)
	tabunganGroup.GET("/transaksi", h.Savings.GetTransactions)
	tabunganGroup.GET("/setoran", h.Savings.GetSetoranList)
	tabunganGroup.GET("/setoran/pending", h.Savings.GetSetoranPending)
	tabunganGroup.GET("/setoran/history", h.Savings.GetSetoranByGuru)
	tabunganGroup.GET("/setoran/detail", h.Savings.GetSetoranDetail)
	tabunganGroup.GET("/brankas", h.Savings.GetBrankasStatus)
	tabunganGroup.GET("/hutang", h.Savings.GetHutangList)
	tabunganGroup.GET("/hutang/:id/payments", h.Savings.GetHutangPayments)
	tabunganGroup.GET("/kelas", h.Savings.GetClassesWithReps)
	tabunganGroup.GET("/laporan/akhir-tahun", h.Savings.GetFinalReport)
	tabunganGroup.GET("/rekening-koran", h.Savings.GetStatement)
	tabunganGroup.GET("/rekening-koran/verify/detail", h.Savings.VerifyStatement)

	tabunganGroupBendahara := tabunganGroup.Group("")
	tabunganGroupBendahara.Use(authMiddleware.RoleMiddleware(authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin, authMiddleware.RoleBendahara))
	tabunganGroupBendahara.POST("/students", h.Savings.CreateSiswa)
	tabunganGroupBendahara.POST("/students/sync", h.Savings.SyncSavings)
	tabunganGroupBendahara.POST("/siswa", h.Savings.CreateSiswa)
	tabunganGroupBendahara.POST("/siswa/sync", h.Savings.SyncSavings)
	tabunganGroupBendahara.PUT("/siswa/:id", h.Savings.UpdateSiswa)
	tabunganGroupBendahara.DELETE("/siswa/:id", h.Savings.DeleteSiswa)
	tabunganGroupBendahara.POST("/transactions", h.Savings.CreateTransaksi)
	tabunganGroupBendahara.POST("/transaksi", h.Savings.CreateTransaksi)
	tabunganGroupBendahara.PUT("/setoran/detail", h.Savings.ResubmitSetoran)
	tabunganGroupBendahara.POST("/setoran", h.Savings.CreateSetoran)
	tabunganGroupBendahara.POST("/setoran/verify", h.Savings.VerifySetoran)
	tabunganGroupBendahara.POST("/brankas", h.Savings.CreateBrankas)
	tabunganGroupBendahara.PATCH("/brankas", h.Savings.TransferBrankas)
	tabunganGroupBendahara.PUT("/brankas/:id", h.Savings.UpdateBrankas)
	tabunganGroupBendahara.POST("/hutang", h.Savings.CreateHutang)
	tabunganGroupBendahara.POST("/hutang/batch", h.Savings.CreateHutangBatch)
	tabunganGroupBendahara.PUT("/hutang/:id", h.Savings.UpdateHutang)
	tabunganGroupBendahara.DELETE("/hutang/:id", h.Savings.CancelHutang)
	tabunganGroupBendahara.POST("/hutang/:id/pay-cash", h.Savings.PayHutangCash)
	tabunganGroupBendahara.POST("/hutang/:id/settle-savings", h.Savings.SettleHutangFromTabungan)
	tabunganGroupBendahara.POST("/kelas", h.Savings.CreateKelas)
	tabunganGroupBendahara.PUT("/kelas/:id", h.Savings.UpdateKelas)
	tabunganGroupBendahara.DELETE("/kelas/:id", h.Savings.DeleteKelas)

	// Library
	adminGroup.GET("/library/stats", h.Library.GetStats)
	adminGroup.GET("/library/books", h.Library.GetBooks)
	adminGroup.GET("/library/books/qr/:code", h.Library.GetBookByQRCode)
	adminGroup.POST("/library/books", h.Library.CreateBook)
	adminGroup.PUT("/library/books/:id", h.Library.UpdateBook)
	adminGroup.DELETE("/library/books/:id", h.Library.DeleteBook)
	adminGroup.GET("/library/isbn/:isbn", h.Library.LookupISBN)
	adminGroup.POST("/library/assets/bind", h.Library.BindAsset)
	adminGroup.POST("/library/assets/swap", h.Library.SwapQR)
	adminGroup.POST("/library/catalog/cover", h.Upload.LibraryCoverUpload)
	adminGroup.POST("/library/catalog/ai-classify", h.Library.AIClassify)
	adminGroup.GET("/library/members", h.Library.GetMembers)
	adminGroup.GET("/library/members/qr/:code", h.Library.GetMemberByQRCode)
	adminGroup.POST("/library/members", h.Library.CreateMember)
	adminGroup.PATCH("/library/members/:id", h.Library.UpdateMember)
	adminGroup.DELETE("/library/members/:id", h.Library.DeleteMember)
	adminGroup.POST("/library/members/sync", h.Library.SyncLibrary)
	adminGroup.GET("/library/loans", h.Library.GetLoans)
	adminGroup.POST("/library/loans", h.Library.BorrowBook)
	adminGroup.POST("/library/loans/:id/return", h.Library.ReturnBook)
	adminGroup.POST("/library/loans/:id/pay-fine", h.Library.PayFine)
	adminGroup.POST("/library/loans/:id/renew", h.Library.RenewLoan)
	adminGroup.GET("/library/members/:id/history", h.Library.GetMemberLoanHistory)
	adminGroup.GET("/library/assets/:id", h.Library.GetBookByQRCode)
	adminGroup.POST("/library/visits/manual", h.Library.RecordVisit)
	adminGroup.GET("/library/visits", h.Library.GetVisits)
	adminGroup.GET("/library/reports", h.Library.GetReports)
	adminGroup.GET("/library/qr-generator", h.Library.GetQRCodeBatches)
	adminGroup.POST("/library/qr-generator", h.Library.GenerateQRCodeBatch)
	auth.POST("/kiosk/scan-complete", h.Library.KioskScanComplete)
	auth.POST("/kiosk/scan", h.Library.KioskScan)
	auth.POST("/kiosk/transaction", h.Library.KioskTransaction)

	// Announcements
	auth.GET("/announcements", h.Announcement.GetAnnouncements)
	adminGroup.POST("/announcements", h.Announcement.CreateAnnouncement)
	adminGroup.PUT("/announcements/:id", h.Announcement.UpdateAnnouncement)
	adminGroup.PATCH("/announcements/:id", h.Announcement.UpdateAnnouncement)
	adminGroup.DELETE("/announcements/:id", h.Announcement.DeleteAnnouncement)

	// User Management
	adminGroup.GET("/users", h.User.GetUsers)
	adminGroup.POST("/users", h.User.CreateUser)
	adminGroup.PATCH("/users/:id", h.User.UpdateUser)
	adminGroup.DELETE("/users/:id", h.User.DeleteUser)
	adminGroup.POST("/users/generate", h.User.GenerateAccounts)

	// Audit Logs
	adminGroup.GET("/audit-logs", h.AuditLog.GetLogs)
	adminGroup.POST("/audit-logs", h.AuditLog.CreateAuditLog)

	// School Settings
	adminGroup.GET("/school-settings", h.Setting.GetSettings)
	adminGroup.POST("/school-settings", h.Setting.UpdateSettings)

	// Gallery
	adminGroup.GET("/gallery/stats", h.Gallery.GetStats)
	adminGroup.POST("/gallery/bulk-delete", h.Gallery.BulkDelete)
	adminGroup.GET("/gallery", h.Gallery.GetGallery)
	adminGroup.POST("/gallery/upload", h.Gallery.Upload)
	adminGroup.PUT("/gallery/:id", h.Gallery.Update)
	adminGroup.PATCH("/gallery/:id", h.Gallery.Update)
	adminGroup.DELETE("/gallery/:id", h.Gallery.Delete)

	// E-Office
	adminGroup.GET("/eoffice/arsip/stats", h.EOffice.GetArsipStats)
	adminGroup.GET("/eoffice/klasifikasi", h.EOffice.GetKlasifikasi)
	adminGroup.POST("/eoffice/klasifikasi", h.EOffice.CreateKlasifikasi)
	adminGroup.PUT("/eoffice/klasifikasi/:code", h.EOffice.UpdateKlasifikasi)
	adminGroup.DELETE("/eoffice/klasifikasi/:code", h.EOffice.DeleteKlasifikasi)
	adminGroup.POST("/eoffice/letter-numbering", h.EOffice.Numbering)
	adminGroup.POST("/eoffice/letter-increment", h.EOffice.Increment)
	adminGroup.GET("/eoffice/surat-masuk", h.EOffice.GetSuratMasuk)
	adminGroup.POST("/eoffice/surat-masuk", h.EOffice.CreateSuratMasuk)
	adminGroup.POST("/eoffice/surat-masuk/analyze-ai", h.EOffice.AIAnalyzeSuratMasuk)
	adminGroup.GET("/eoffice/surat-keluar", h.EOffice.GetSuratKeluar)
	adminGroup.POST("/eoffice/surat-keluar", h.EOffice.CreateSuratKeluar)
	adminGroup.GET("/eoffice/surat-masuk/detail", h.EOffice.GetSuratMasukDetail)
	adminGroup.GET("/eoffice/surat-keluar/detail", h.EOffice.GetSuratKeluarDetail)
	adminGroup.POST("/eoffice/disposisi", h.EOffice.CreateDisposisi)
	adminGroup.GET("/eoffice/letter-templates", h.EOffice.GetLetterTemplates)
	adminGroup.GET("/eoffice/letter-templates/:id", h.EOffice.GetLetterTemplateByID)
	adminGroup.GET("/eoffice/letter-templates/:id/variables", h.EOffice.GetTemplateVariables)
	adminGroup.POST("/eoffice/letter-templates", h.EOffice.CreateLetterTemplate)
	adminGroup.POST("/eoffice/letter-templates/import", h.EOffice.ImportLetterTemplate)
	adminGroup.PATCH("/eoffice/letter-templates/:id", h.EOffice.UpdateLetterTemplate)
	adminGroup.POST("/eoffice/letter-batch-generate", h.EOffice.GenerateBatch)
	adminGroup.DELETE("/eoffice/letter-templates/:id", h.EOffice.DeleteLetterTemplate)
	adminGroup.GET("/eoffice/template-groups", h.EOffice.GetTemplateGroups)
	adminGroup.GET("/eoffice/template-groups/:id", h.EOffice.GetTemplateGroupByID)
	adminGroup.POST("/eoffice/template-groups", h.EOffice.CreateTemplateGroup)
	adminGroup.PUT("/eoffice/template-groups/:id", h.EOffice.UpdateTemplateGroup)
	adminGroup.DELETE("/eoffice/template-groups/:id", h.EOffice.DeleteTemplateGroup)
	adminGroup.POST("/eoffice/template-groups/generate", h.EOffice.GenerateGroupAndSubmit)
	adminGroup.POST("/eoffice/letter-generate-submit", h.EOffice.GenerateAndSubmit)
	adminGroup.POST("/eoffice/surat-keluar/verify", h.EOffice.VerifySuratKeluar)
	adminGroup.POST("/eoffice/surat-keluar/revision", h.EOffice.SetSuratKeluarRevision)
	adminGroup.POST("/eoffice/surat-keluar/resubmit", h.EOffice.ResubmitSuratKeluar)
	adminGroup.POST("/eoffice/surat-masuk/status", h.EOffice.UpdateSuratMasukStatus)
	adminGroup.POST("/eoffice/disposisi/complete", h.EOffice.CompleteDisposisi)
	adminGroup.POST("/eoffice/upload-docx", h.EOffice.UploadDocx)

	// Arsip route aliases
	adminGroup.GET("/arsip/stats", h.EOffice.GetArsipStats)
	adminGroup.GET("/arsip/surat-masuk", h.EOffice.GetSuratMasuk)
	adminGroup.GET("/arsip/surat-masuk/detail", h.EOffice.GetSuratMasukDetail)
	adminGroup.POST("/arsip/surat-masuk", h.EOffice.CreateSuratMasuk)
	adminGroup.POST("/arsip/surat-masuk/analyze-ai", h.EOffice.AIAnalyzeSuratMasuk)
	adminGroup.GET("/arsip/surat-keluar", h.EOffice.GetSuratKeluar)
	adminGroup.GET("/arsip/surat-keluar/detail", h.EOffice.GetSuratKeluarDetail)
	adminGroup.POST("/arsip/surat-keluar", h.EOffice.CreateSuratKeluar)
	adminGroup.PATCH("/arsip/surat-keluar/detail", h.EOffice.UpdateSuratKeluar)
	adminGroup.POST("/arsip/disposisi", h.EOffice.CreateDisposisi)
	adminGroup.GET("/arsip/klasifikasi", h.EOffice.GetKlasifikasi)
	adminGroup.POST("/arsip/surat-keluar/verify", h.EOffice.VerifySuratKeluar)
	adminGroup.POST("/arsip/surat-keluar/revision", h.EOffice.SetSuratKeluarRevision)
	adminGroup.POST("/arsip/surat-keluar/resubmit", h.EOffice.ResubmitSuratKeluar)
	adminGroup.POST("/arsip/surat-masuk/status", h.EOffice.UpdateSuratMasukStatus)
	adminGroup.POST("/arsip/disposisi/complete", h.EOffice.CompleteDisposisi)
	adminGroup.POST("/arsip/dokumen", h.Document.Create)
	adminGroup.GET("/arsip/dokumen", h.Document.List)
	adminGroup.GET("/arsip/dokumen/:id", h.Document.GetByID)
	adminGroup.PUT("/arsip/dokumen/:id", h.Document.Update)
	adminGroup.DELETE("/arsip/dokumen/:id", h.Document.Delete)
	adminGroup.GET("/arsip/daftar-1", h.EOffice.GetDaftar1Stats)

	// Academic Advanced
	adminGroup.POST("/academic/adv/scan", h.AcademicAdv.RecordQRScan)
	adminGroup.POST("/academic/adv/bulk-grades", h.AcademicAdv.BulkGrades)

	// Attendance
	auth.GET("/attendance/stats", h.Attendance.GetStats)
	auth.GET("/attendance/daily", h.Attendance.GetDailyClass)
	auth.POST("/attendance/manual", h.Attendance.RecordManual)
	auth.POST("/attendance/scan", h.Attendance.ScanQR)
	auth.GET("/attendance/report", h.Attendance.GetReport)
	auth.GET("/attendance/export", h.Attendance.ExportCSV)
	auth.GET("/attendance/student-summary/:studentId", h.Attendance.GetStudentSummary)
	auth.GET("/attendance/holiday", h.Attendance.CheckHoliday)
	adminGroup.GET("/school-holidays", h.Attendance.ListSchoolHolidays)
	adminGroup.POST("/school-holidays", h.Attendance.CreateSchoolHoliday)
	adminGroup.DELETE("/school-holidays/:id", h.Attendance.DeleteSchoolHoliday)

	// Loan
	adminGroup.GET("/loans", h.Loan.GetLoans)
	adminGroup.POST("/loans", h.Loan.CreateLoan)
	adminGroup.POST("/loans/:id/approve", h.Loan.ApproveLoan)
	adminGroup.POST("/loans/:id/pay", h.Loan.AddPayment)
	adminGroup.POST("/loans/:id/reject", h.Loan.RejectLoan)

	// Alumni
	adminGroup.GET("/alumni/stats", h.Alumni.GetAlumniStats)
	auth.GET("/alumni/document-types", h.Alumni.GetDocumentTypes)
	adminGroup.POST("/alumni/graduate", h.Alumni.GraduateStudents)
	adminGroup.POST("/alumni/import-bulk", h.Alumni.ImportBulkAlumni)
	adminGroup.POST("/alumni/import-grades-bulk", h.Alumni.ImportBulkGrades)
	adminGroup.GET("/integrations/settings", h.Integration.GetSettings)
	adminGroup.POST("/integrations/settings", h.Integration.UpdateSettings)
	adminGroup.GET("/settings/backup/telegram", h.TelegramBackup.GetSettings)
	adminGroup.PUT("/settings/backup/telegram", h.TelegramBackup.UpdateSettings)
	adminGroup.POST("/settings/backup/telegram/test", h.TelegramBackup.TestBackup)
	adminGroup.POST("/settings/backup/telegram/restore", h.TelegramBackup.RestoreBackup)
	adminGroup.POST("/integrations/test-connection", h.Integration.TestConnection)
	adminGroup.POST("/integrations/sync", h.Integration.SyncNow)
	adminGroup.GET("/alumni", h.Alumni.GetAlumni)
	adminGroup.POST("/alumni", h.Alumni.CreateAlumni)
	adminGroup.GET("/alumni/documents/:docId/download", h.Alumni.DownloadDocument)
	adminGroup.POST("/alumni/documents/:docId/verify", h.Alumni.VerifyDocument)
	adminGroup.DELETE("/alumni/documents/:docId", h.Alumni.DeleteDocument)
	adminGroup.GET("/alumni/:id", h.Alumni.GetAlumniByID)
	adminGroup.PUT("/alumni/:id", h.Alumni.UpdateAlumni)
	adminGroup.PATCH("/alumni/:id", h.Alumni.UpdateAlumni)
	adminGroup.DELETE("/alumni/:id", h.Alumni.DeleteAlumni)
	adminGroup.POST("/alumni/:id/photo", h.Alumni.UploadPhoto)
	adminGroup.DELETE("/alumni/:id/photo", h.Alumni.RemovePhoto)
	adminGroup.POST("/alumni/:id/documents", h.Alumni.CreateDocument)
	adminGroup.POST("/alumni/:id/pickups", h.Alumni.CreatePickup)
	adminGroup.GET("/alumni/:id/achievements", h.Alumni.GetAchievements)
	adminGroup.POST("/alumni/:id/achievements", h.Alumni.CreateAchievement)
	adminGroup.PUT("/alumni/achievements/:achId", h.Alumni.UpdateAchievement)
	adminGroup.DELETE("/alumni/achievements/:achId", h.Alumni.DeleteAchievement)
	adminGroup.GET("/alumni/:id/extracurriculars", h.Alumni.GetExtracurriculars)
	adminGroup.POST("/alumni/:id/extracurriculars", h.Alumni.CreateExtracurricular)
	adminGroup.PUT("/alumni/extracurriculars/:exId", h.Alumni.UpdateExtracurricular)
	adminGroup.DELETE("/alumni/extracurriculars/:exId", h.Alumni.DeleteExtracurricular)
	adminGroup.GET("/alumni/:id/transcripts", h.Alumni.GetTranscripts)
	adminGroup.POST("/alumni/:id/transcripts", h.Alumni.CreateTranscript)
	adminGroup.POST("/alumni/:id/transcripts/bulk", h.Alumni.SaveTranscriptsBulk)
	adminGroup.PUT("/alumni/transcripts/:transId", h.Alumni.UpdateTranscript)
	adminGroup.DELETE("/alumni/transcripts/:transId", h.Alumni.DeleteTranscript)
	adminGroup.GET("/alumni/:id/attendance", h.Alumni.GetAttendanceSummaries)
	adminGroup.POST("/alumni/:id/attendance", h.Alumni.CreateAttendanceSummary)
	adminGroup.PUT("/alumni/attendance/:attId", h.Alumni.UpdateAttendanceSummary)
	adminGroup.DELETE("/alumni/attendance/:attId", h.Alumni.DeleteAttendanceSummary)
	adminGroup.GET("/alumni/:id/health-records", h.Alumni.GetHealthRecords)
	adminGroup.POST("/alumni/:id/health-records", h.Alumni.CreateHealthRecord)
	adminGroup.PUT("/alumni/health-records/:hrId", h.Alumni.UpdateHealthRecord)
	adminGroup.DELETE("/alumni/health-records/:hrId", h.Alumni.DeleteHealthRecord)

	// Mutasi
	adminGroup.GET("/admin/mutasi", h.Mutasi.GetMutasiRequests)
	adminGroup.PATCH("/admin/mutasi/:id", h.Mutasi.UpdateMutasiRequest)
	adminGroup.GET("/admin/mutasi-keluar", h.Mutasi.GetMutasiOutRequests)
	adminGroup.GET("/admin/mutasi-keluar/:id/check", h.Mutasi.CheckStudentLiability)
	adminGroup.PATCH("/admin/mutasi-keluar/:id", h.Mutasi.UpdateMutasiOutStatus)
	adminGroup.POST("/admin/mutasi/masuk/langsung", h.Mutasi.DirectMutasiMasuk)
	adminGroup.POST("/admin/mutasi-keluar/langsung", h.Mutasi.DirectMutasiKeluar)
	adminGroup.GET("/admin/mutasi/logs", h.Mutasi.GetMutasiLogs)
	adminGroup.GET("/admin/mutasi/rekap", h.Mutasi.GetMutasiRekap)

	// Notifications
	notifs := server.Group("/api/notifications")
	notifs.Use(authMiddleware.JWTMiddleware)
	notifs.GET("", h.Notification.GetNotifications)
	notifs.GET("/stats", h.Notification.GetStats)
	notifs.PATCH("/:id/read", h.Notification.MarkAsRead)
	notifs.POST("/read-all", h.Notification.MarkAllAsRead)

	// Profile
	profile := server.Group("/api/profile")
	profile.Use(authMiddleware.JWTMiddleware)
	profile.GET("", h.User.GetProfile)
	profile.PATCH("", h.User.UpdateProfile)
	profile.GET("/logs", h.User.GetProfileLogs)

	// Upload
	auth.POST("/upload", h.Upload.GeneralUpload)
	server.POST("/api/spmb/upload", h.SPMB.UploadDocuments)
}