package main

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/sekolahku/go-backend/internal/handlers"
	authMiddleware "github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/push"
	"github.com/sekolahku/go-backend/internal/repository"
	"net/http"
	"strings"
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
	SavingsGTK         *repository.SavingsGTKRepository
	Library            *repository.LibraryRepository
	EOffice            *repository.EOfficeRepository
	Attendance         *repository.AttendanceRepository
	AttendanceGTK      *repository.AttendanceGTKRepository
	Loan               *repository.LoanRepository
	Setting            *repository.SettingRepository
	Alumni             *repository.AlumniRepository
	Mutasi             *repository.MutasiRepository
	Gallery            *repository.GalleryRepository
	Announcement       *repository.AnnouncementRepository
	AuditLog           *repository.AuditLogRepository
	Notification       *repository.NotificationRepository
	TelegramBackup     *repository.TelegramBackupRepository
	Dashboard          *repository.DashboardRepository
	Public             *repository.PublicRepository
	PublicLibrary      *repository.PublicLibraryRepository
	Booking            *repository.LibraryBookingRepository
	Computer           *repository.ComputerRepository
	Finance            *repository.FinanceRepository
	StickerPreset      *repository.LibraryStickerPresetRepository
	FAQ                *repository.FAQRepository
	Contact            *repository.ContactRepository
	Sync               *repository.SyncRepository
	Integration        *repository.IntegrationRepository
	Document           *repository.DocumentRepository
	Holiday            *repository.SchoolHolidayRepository
	Push               *repository.PushRepository
	Parent             *repository.ParentRepository
	BankSoal           *repository.BankSoalRepository
	ExamAssignment     *repository.ExamAssignmentRepository
	Kurikulum          *repository.KurikulumRepository
	Chat               *repository.ChatRepository
	Skrining           *repository.SkriningRepository
	Tugas              *repository.TugasRepository
	CloudStorage       *repository.CloudStorageRepository
	CloudUploadSession *repository.CloudUploadSessionRepository
	ReportTemplate     *repository.ReportTemplateRepository
	PrintSettings      *repository.PrintSettingsRepository
	AIProvider         *repository.AIProviderRepository
	ThemePreset        *repository.ThemePresetRepository
}

// AllHandlers holds all HTTP handler instances.
type AllHandlers struct {
	Auth           *handlers.AuthHandler
	Academic       *handlers.AcademicHandler
	Inventory      *handlers.InventoryHandler
	SPMB           *handlers.SPMBHandler
	Student        *handlers.StudentHandler
	Employee       *handlers.EmployeeHandler
	Savings        *handlers.SavingsHandler
	SavingsGTK     *handlers.SavingsGTKHandler
	Library        *handlers.LibraryHandler
	EOffice        *handlers.EOfficeHandler
	Attendance     *handlers.AttendanceHandler
	AttendanceGTK  *handlers.AttendanceGTKHandler
	ScanResolve    *handlers.ScanResolveHandler
	Loan           *handlers.LoanHandler
	Setting        *handlers.SettingHandler
	Alumni         *handlers.AlumniHandler
	Mutasi         *handlers.MutasiHandler
	Gallery        *handlers.GalleryHandler
	Announcement   *handlers.AnnouncementHandler
	AuditLog       *handlers.AuditLogHandler
	Notification   *handlers.NotificationHandler
	TelegramBackup *handlers.TelegramBackupHandler
	User           *handlers.UserHandler
	Dashboard      *handlers.DashboardHandler
	Public         *handlers.PublicHandler
	PublicLibrary  *handlers.PublicLibraryHandler
	Booking        *handlers.BookingHandler
	Computer       *handlers.ComputerHandler
	Finance        *handlers.FinanceHandler
	StickerPreset  *handlers.StickerPresetHandler
	FAQ            *handlers.FAQHandler
	Contact        *handlers.ContactHandler
	Upload         *handlers.UploadHandler
	Integration    *handlers.IntegrationHandler
	Document       *handlers.DocumentHandler
	Sync           *handlers.SyncHandler
	Push           *handlers.PushHandler
	Parent         *handlers.ParentHandler
	StudentMe      *handlers.StudentMeHandler
	BankSoal       *handlers.BankSoalHandler
	Kurikulum      *handlers.KurikulumHandler
	Chat           *handlers.ChatHandler
	Skrining       *handlers.SkriningHandler
	Tugas          *handlers.TugasHandler
	File           *handlers.FileHandler
	DocStation     *handlers.DocStationHandler
	CloudStorage   *handlers.CloudStorageHandler
	ReportTemplate *handlers.ReportTemplateHandler
	PrintSettings  *handlers.PrintSettingsHandler
	AIProvider     *handlers.AIProviderHandler
	ThemePreset    *handlers.ThemePresetHandler
	PDF            *handlers.PDFHandler
	// PushSvc dipakai handler lain (absen, tabungan, pengumuman) untuk
	// mengirim push ke orang tua.
	PushSvc *push.Service
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

	// Rate limiter untuk endpoint sensitif terautentikasi:
	// - /api/auth/switch : impersonasi akun (penyalahgunaan = akses penuh akun lain)
	// - /api/files/*     : unduh dokumen privat (PII) — anti scraping massal
	// - backup restore   : operasi berat + restart server
	// Identifier memakai user_id bila ada (lebih akurat dari IP di belakang
	// tunnel/proxy bersama), fallback ke IP.
	sensitiveLimit := middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Skipper: func(c echo.Context) bool {
			path := c.Path()
			switch path {
			case "/api/auth/switch", "/api/settings/backup/telegram/restore":
				return false
			}
			return !strings.HasPrefix(path, "/api/files/")
		},
		IdentifierExtractor: func(c echo.Context) (string, error) {
			if uid, ok := c.Get("user_id").(string); ok && uid != "" {
				return "u:" + uid, nil
			}
			return "ip:" + c.RealIP(), nil
		},
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      30,
			Burst:     30,
			ExpiresIn: 1 * time.Minute,
		}),
		DenyHandler: func(c echo.Context, id string, err error) error {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "Terlalu banyak permintaan. Silakan lambat"})
		},
	})

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

	// Sitemap berita dinamis (melengkapi /sitemap.xml statis dari frontend).
	// Tanpa auth: sitemap memang untuk crawler.
	sitemapHandler := handlers.NewSitemapHandler(repos.Announcement)
	server.GET("/sitemap-news.xml", sitemapHandler.News)

	publicGroup.GET("/homepage", h.Public.GetHomepageData)
	publicGroup.GET("/staff", h.Public.GetPublicStaff)
	publicGroup.GET("/gallery", h.Public.GetPublicGallery)
	publicGroup.GET("/school-settings", h.Setting.GetSettings)
	publicGroup.GET("/news", h.Announcement.GetPublicAnnouncements)
	publicGroup.GET("/news/:slug", h.Announcement.GetPublicAnnouncementBySlug)
	publicGroup.GET("/faqs", h.FAQ.GetPublicFAQs)
	publicGroup.GET("/spmb/landing", h.SPMB.GetLandingData)
	publicGroup.GET("/spmb/registrants", h.SPMB.GetPublicRegistrants)
	publicGroup.GET("/spmb/registrants/:number", h.SPMB.GetPublicRegistrantStatus)
	// Verifikasi rekening koran: halamannya publik (QR discan tanpa login),
	// jadi rute ini harus di luar auth. Rute lama di auth tetap untuk konsistensi.
	publicGroup.GET("/savings/statement/verify", h.Savings.VerifyStatement)
	// Kritik/saran/pengaduan: kini layanan masukan publik (rate-limit),
	// pengaduan boleh anonim, plus cek status via kode tiket.
	publicGroup.POST("/contact", h.Contact.SubmitMessage, publicFormLimit)
	publicGroup.GET("/contact/status/:ticket", h.Contact.GetPublicStatus, publicFormLimit)
	// Public key Web Push (aman dibagikan) untuk pushManager.subscribe.
	publicGroup.GET("/push/vapid-key", h.Push.GetVAPIDKey)
	// Pendaftaran akun orang tua (verifikasi data siswa + rate limit).
	publicGroup.POST("/parent/verify", h.Parent.VerifyStudent, publicFormLimit)
	publicGroup.POST("/parent/register", h.Parent.Register, publicFormLimit)
	publicGroup.POST("/mutasi/request", h.Mutasi.CreateMutasiRequest, publicFormLimit)
	publicGroup.GET("/mutasi/status/:regNum", h.Mutasi.GetPublicMutasiStatus, publicFormLimit)
	publicGroup.POST("/tabungan/check-balance", h.Savings.CheckPublicBalance, publicFormLimit)
	publicGroup.POST("/tabungan/statement", h.Savings.GetPublicStatement, publicFormLimit)
	// Label inventaris: halaman detail yang dibuka lewat QR pada stiker fisik.
	// Sengaja publik — QR harus bisa discan siapa pun. Handler membatasi
	// respons hanya pada field aman (tanpa harga, catatan, user_id).
	publicGroup.GET("/inventory/label", h.Inventory.GetPublicLabel)
	publicGroup.POST("/sync/dapodik/students", h.Sync.SyncDapodikStudents)

	// Public Library Routes - no auth required, read-only with caching
	publicGroup.GET("/library/books", h.PublicLibrary.GetBooks)
	publicGroup.GET("/library/books/:id", h.PublicLibrary.GetBook)
	publicGroup.GET("/library/stats", h.PublicLibrary.GetStats)
	publicGroup.GET("/library/availability/:isbn", h.PublicLibrary.CheckAvailability)

	// Public compatibility aliases
	server.POST("/api/mutasi/request", h.Mutasi.CreateMutasiRequest, publicFormLimit)
	server.GET("/api/mutasi/status/:regNum", h.Mutasi.GetPublicMutasiStatus, publicFormLimit)

	// Admin Protected Routes
	auth := server.Group("/api")
	auth.Use(authMiddleware.JWTMiddleware)

	// File privat (spmb, alumni, arsip, chat, tugas, dll). Role check
	// per-folder dilakukan di handler (lihat FileHandler.folderRoleMatrix).
	// Route anonim /uploads/* hanya melayani folder publik.
	auth.GET("/files/*", h.File.ServeFile, sensitiveLimit)

	adminGroup := auth.Group("")
	adminGroup.Use(authMiddleware.RoleMiddleware(authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin))

	bendaharaGroup := auth.Group("")
	bendaharaGroup.Use(authMiddleware.RoleMiddleware(authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin, authMiddleware.RoleBendahara))

	guruGroup := auth.Group("")
	guruGroup.Use(authMiddleware.RoleMiddleware(authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin, authMiddleware.RoleGuru, authMiddleware.RoleStaff))

	// Dashboard
	adminGroup.GET("/admin/dashboard/stats", h.Dashboard.GetStats)
	adminGroup.GET("/admin/system/health", h.Dashboard.GetHealth)

	// Account switching (admin impersonation)
	// switch = admin-only (pindah ke akun manapun), return = siapapun yang
	// sedang di-impersonasi (klaim JWT imp) untuk kembali ke akun admin asal.
	adminGroup.POST("/auth/switch", h.Auth.SwitchAccount, sensitiveLimit)
	auth.POST("/auth/return", h.Auth.ReturnToAdmin)

	// Academic
	auth.GET("/academic/active-year", h.Academic.GetActiveAcademicYear)
	adminGroup.GET("/academic/years", h.Academic.GetAcademicYears)
	adminGroup.POST("/academic/years", h.Academic.CreateAcademicYear)
	adminGroup.PUT("/academic/years/:id", h.Academic.UpdateAcademicYear)
	adminGroup.DELETE("/academic/years/:id", h.Academic.DeleteAcademicYear)
	guruGroup.GET("/academic/subjects", h.Academic.GetSubjects)
	guruGroup.GET("/academic/kurikulum", h.Kurikulum.ListKurikulum)
	adminGroup.POST("/academic/subjects", h.Academic.CreateSubject)
	adminGroup.POST("/academic/kurikulum", h.Kurikulum.CreateKurikulum)
	adminGroup.PUT("/academic/kurikulum/:id", h.Kurikulum.UpdateKurikulum)
	adminGroup.DELETE("/academic/kurikulum/:id", h.Kurikulum.DeleteKurikulum)
	adminGroup.PUT("/academic/subjects/:id", h.Academic.UpdateSubject)
	adminGroup.DELETE("/academic/subjects/:id", h.Academic.DeleteSubject)
	guruGroup.GET("/academic/classes", h.Academic.GetClasses)
	auth.GET("/academic/classes/suggested-capacity", h.Academic.GetSuggestedCapacity)
	adminGroup.POST("/academic/classes", h.Academic.CreateClass)
	adminGroup.PUT("/academic/classes/:id", h.Academic.UpdateClass)
	adminGroup.DELETE("/academic/classes/:id", h.Academic.DeleteClass)
	adminGroup.POST("/academic/promotion", h.Academic.ProcessPromotion)
	auth.GET("/classes/stats", h.Academic.GetClassesStats)

	// Inventory — scope PIC ruangan: guru bisa kelola ruangannya, admin bebas
	// (lihat inventory_handler_scope.go). Yang bersifat master data / jejak audit
	// dikunci ke admin di level rute, bukan hanya mengandalkan handler.
	auth.GET("/inventory/stats", h.Inventory.GetStats)
	auth.GET("/inventory/data", h.Inventory.GetData)
	auth.GET("/inventory/rooms", h.Inventory.GetRooms)
	auth.GET("/inventory/rooms/:id", h.Inventory.GetRoom)
	auth.PUT("/inventory/rooms/:id", h.Inventory.UpdateRoom) // PIC boleh sunting ruangannya
	auth.GET("/inventory/assets", h.Inventory.GetAssets)
	auth.GET("/inventory/assets/:id", h.Inventory.GetAsset)
	auth.PUT("/inventory/assets/:id", h.Inventory.UpdateAsset)
	auth.GET("/inventory/items", h.Inventory.GetItems)
	auth.GET("/inventory/items/:id", h.Inventory.GetItem)
	auth.PUT("/inventory/items/:id", h.Inventory.UpdateItem)
	auth.GET("/inventory/transactions", h.Inventory.GetTransactions)
	auth.POST("/inventory/transactions", h.Inventory.CreateTransaction)
	// Pelacakan per bungkus (nomor berapa keluar ke mana) untuk barang habis
	// pakai. Mengikuti scope PIC ruangan yang sama dengan item induknya.
	auth.GET("/inventory/items/:id/units", h.Inventory.GetItemUnits)
	auth.GET("/inventory/items/:id/units/:no", h.Inventory.GetItemUnitDetail)
	auth.POST("/inventory/items/:id/units/issue", h.Inventory.IssueItemUnits)
	auth.POST("/inventory/items/:id/units/return", h.Inventory.ReturnItemUnits)
	// Pemeriksaan fisik: kirim nomor yang ditemukan, terima daftar yang hilang.
	auth.POST("/inventory/items/:id/units/audit", h.Inventory.AuditItemUnits)
	auth.GET("/inventory/items/:id/batches", h.Inventory.GetItemBatches)
	auth.GET("/inventory/opname", h.Inventory.GetOpnames)
	auth.POST("/inventory/opname", h.Inventory.CreateOpname)
	auth.POST("/inventory/opname/:id/apply", h.Inventory.ApplyOpname)
	auth.POST("/inventory/borrow-requests", h.Inventory.CreateBorrowRequest)
	auth.GET("/inventory/borrow-requests", h.Inventory.GetBorrowRequests)

	// Struktur ruangan (membuat/menghapus ruangan = menentukan PIC): admin saja.
	adminGroup.POST("/inventory/rooms", h.Inventory.CreateRoom)
	adminGroup.DELETE("/inventory/rooms/:id", h.Inventory.DeleteRoom)

	// Aset & barang: PIC boleh menambah/menghapus di ruangannya sendiri,
	// dijaga oleh ensureAssetRoomScope / ensureItemLocationScope di handler.
	// Dulu CreateAsset dan CreateItem tidak punya cek otorisasi sama sekali.
	auth.POST("/inventory/assets", h.Inventory.CreateAsset)
	auth.DELETE("/inventory/assets/:id", h.Inventory.DeleteAsset)
	auth.POST("/inventory/items", h.Inventory.CreateItem)
	auth.DELETE("/inventory/items/:id", h.Inventory.DeleteItem)

	// Jejak audit memuat nama user, tidak untuk dibaca peran apa pun.
	adminGroup.GET("/inventory/audit", h.Inventory.GetAuditLogs)

	// Persetujuan peminjaman: admin; pengembalian: pemohon atau admin (dicek di repo)
	adminGroup.POST("/inventory/borrow-requests/:id/review", h.Inventory.ReviewBorrowRequest)
	auth.POST("/inventory/borrow-requests/:id/return", h.Inventory.ReturnBorrowRequest)

	adminGroup.POST("/inventory/borrow-requests/:id/review", h.Inventory.ReviewBorrowRequest)

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
	adminGroup.POST("/master/employees/print", h.Employee.GetEmployeesForPrint)
	adminGroup.GET("/master/employees/:id", h.Employee.GetEmployeeByID)
	adminGroup.POST("/master/employees", h.Employee.CreateEmployee)
	adminGroup.PUT("/master/employees/:id", h.Employee.UpdateEmployee)
	adminGroup.DELETE("/master/employees/:id", h.Employee.DeleteEmployee)

	// FAQ & Contact
	adminGroup.GET("/faqs", h.FAQ.ListFAQsAdmin)
	adminGroup.POST("/faqs", h.FAQ.CreateFAQ)
	adminGroup.PUT("/faqs/:id", h.FAQ.UpdateFAQ)
	adminGroup.DELETE("/faqs/:id", h.FAQ.DeleteFAQ)
	adminGroup.GET("/contact-messages", h.Contact.ListMessages)
	adminGroup.GET("/contact-messages/:id", h.Contact.GetMessage)
	adminGroup.POST("/contact-messages/:id/replies", h.Contact.CreateReply)
	adminGroup.GET("/contact-messages/:id/attachments", h.Contact.GetAttachments)
	adminGroup.POST("/contact-messages/:id/attachments", h.Contact.AddResolutionAttachment)
	adminGroup.PATCH("/contact-messages/:id/status", h.Contact.UpdateStatus)
	adminGroup.PUT("/contact-messages/:id/read", h.Contact.MarkAsRead)
	adminGroup.DELETE("/contact-messages/:id", h.Contact.DeleteMessage)

	// Savings
	// Pembacaan finansial dibatasi ke role modul tabungan (sama seperti
	// tabunganGroup). Tulan tetap di bendaharaGroup di bawah.
	savingsRead := auth.Group("/savings")
	savingsRead.Use(authMiddleware.RoleMiddleware(
		authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin,
		authMiddleware.RoleBendahara, authMiddleware.RoleGuru, authMiddleware.RoleStaff,
	))
	savingsRead.GET("/stats", h.Savings.GetStats)
	savingsRead.GET("/students", h.Savings.GetSiswa)
	auth.POST("/savings/students", h.Savings.CreateSiswa)
	auth.POST("/savings/students/sync", h.Savings.SyncSavings)
	savingsRead.GET("/savings/students/:id", h.Savings.GetDetailSiswa)
	auth.PUT("/savings/students/:id", h.Savings.UpdateSiswa)
	auth.DELETE("/savings/students/:id", h.Savings.DeleteSiswa)
	savingsRead.GET("/savings/transactions", h.Savings.GetTransactions)
	bendaharaGroup.POST("/savings/transactions", h.Savings.CreateTransaksi)
	savingsRead.GET("/savings/setoran", h.Savings.GetSetoranList)
	bendaharaGroup.POST("/savings/setoran", h.Savings.CreateSetoran)
	bendaharaGroup.POST("/savings/setoran/verify", h.Savings.VerifySetoran)
	savingsRead.GET("/savings/brankas", h.Savings.GetBrankasStatus)
	savingsRead.GET("/savings/brankas/summary", h.Savings.GetBrankasSummary)
	bendaharaGroup.POST("/savings/brankas", h.Savings.CreateBrankas)
	bendaharaGroup.PUT("/savings/brankas/:id", h.Savings.UpdateBrankas)
	bendaharaGroup.POST("/savings/brankas/transfer", h.Savings.TransferBrankas)
	savingsRead.GET("/savings/hutang", h.Savings.GetHutangList)
	bendaharaGroup.POST("/savings/hutang", h.Savings.CreateHutang)
	bendaharaGroup.PUT("/savings/hutang/:id", h.Savings.UpdateHutang)
	bendaharaGroup.DELETE("/savings/hutang/:id", h.Savings.CancelHutang)
	bendaharaGroup.POST("/savings/hutang/:id/pay-cash", h.Savings.PayHutangCash)
	bendaharaGroup.POST("/savings/hutang/:id/settle-savings", h.Savings.SettleHutangFromTabungan)
	savingsRead.GET("/savings/hutang/:id/payments", h.Savings.GetHutangPayments)
	savingsRead.GET("/savings/kelas", h.Savings.GetClassesWithReps)
	bendaharaGroup.POST("/savings/kelas", h.Savings.CreateKelas)
	bendaharaGroup.PUT("/savings/kelas/:id", h.Savings.UpdateKelas)
	bendaharaGroup.DELETE("/savings/kelas/:id", h.Savings.DeleteKelas)
	savingsRead.GET("/savings/treasurer", h.Savings.GetTreasurer)
	bendaharaGroup.POST("/savings/treasurer", h.Savings.AssignTreasurer)
	bendaharaGroup.POST("/savings/kelas/:id/rep", h.Savings.AssignClassRep)
	savingsRead.GET("/savings/classes/reps", h.Savings.GetClassesWithReps)
	bendaharaGroup.PUT("/savings/classes/:id/rep", h.Savings.AssignClassRep)
	savingsRead.GET("/savings/reports/final", h.Savings.GetFinalReport)
	savingsRead.GET("/savings/reports/statement", h.Savings.GetStatement)
	savingsRead.GET("/savings/reports/verify", h.Savings.VerifyStatement)

	// Tabungan route aliases
	// Pembacaan finansial dibatasi untuk role yang sah memakai modul tabungan
	// (admin/bendahara/guru/staff). Sebelumnya route ini hanya di `auth`, jadi
	// orangtua/calon_siswa/user biasa pun bisa membaca seluruh daftar tabungan,
	// hutang, dan brankas sekolah (horizontal over-exposure). Siswa mengakses
	// tabungannya sendiri via /api/student/me/savings, bukan grup ini.
	tabunganGroup := auth.Group("/tabungan")
	tabunganGroup.Use(authMiddleware.RoleMiddleware(
		authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin,
		authMiddleware.RoleBendahara, authMiddleware.RoleGuru, authMiddleware.RoleStaff,
	))
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
	// Tabungan GTK (guru & tenaga kependidikan) — ringkas: lookup by scan,
	// list rekap, detail. Mutasi (setor/tarik) di bawah (bendahara).
	tabunganGroup.GET("/gtk", h.SavingsGTK.GetGtkList)
	tabunganGroup.GET("/gtk/scan", h.SavingsGTK.GetGtkByQR)
	tabunganGroup.GET("/gtk/:id", h.SavingsGTK.GetGtkDetail)

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
	tabunganGroupBendahara.POST("/gtk/transaksi", h.SavingsGTK.CreateGtkTransaksi)
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
	adminGroup.GET("/library/search", h.Library.SearchBooks)
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
	adminGroup.POST("/library/visits/manual", h.Library.RecordVisit)
	adminGroup.GET("/library/visits", h.Library.GetVisits)
	adminGroup.GET("/library/reports", h.Library.GetReports)
	adminGroup.GET("/library/qr-generator", h.Library.GetQRCodeBatches)
	adminGroup.POST("/library/qr-generator", h.Library.GenerateQRCodeBatch)

	// Preset tata letak stiker QR (hanya admin).
	adminGroup.GET("/library/sticker-presets", h.StickerPreset.GetStickerPresets)
	adminGroup.POST("/library/sticker-presets", h.StickerPreset.CreateStickerPreset)
	adminGroup.PUT("/library/sticker-presets/:id", h.StickerPreset.UpdateStickerPreset)
	adminGroup.DELETE("/library/sticker-presets/:id", h.StickerPreset.DeleteStickerPreset)

	// Kiosk (dibuka dari HP guru yang sudah login; ikut role guru+)
	guruGroup.POST("/kiosk/scan-complete", h.Library.KioskScanComplete)
	guruGroup.POST("/kiosk/scan", h.Library.KioskScan)
	guruGroup.POST("/kiosk/transaction", h.Library.KioskTransaction)
	guruGroup.POST("/kiosk/attendance", h.Attendance.KioskRecordAttendance)
	guruGroup.POST("/kiosk/savings-deposit", h.Savings.KioskDeposit)
	guruGroup.GET("/kiosk/savings-lookup", h.Savings.GetSiswa)

	// Library Booking Routes (authenticated only - students, teachers, staff)
	guruGroup.POST("/library/bookings", h.Booking.CreateBooking)
	guruGroup.GET("/library/bookings", h.Booking.GetMyBookings)
	guruGroup.DELETE("/library/bookings/:id", h.Booking.CancelBooking)

	// Modul Komputer Belajar Perpustakaan.
	// Kelola (admin/guru/staff): stasiun, kuota, laporan, booking, laporan/riwayat.
	guruGroup.GET("/computer/stations", h.Computer.ListStations)
	adminGroup.POST("/computer/stations", h.Computer.CreateStation)
	adminGroup.PUT("/computer/stations/:id", h.Computer.UpdateStation)
	adminGroup.DELETE("/computer/stations/:id", h.Computer.DeleteStation)

	guruGroup.GET("/computer/quota-policies", h.Computer.ListQuotaPolicies)
	adminGroup.PUT("/computer/quota-policies", h.Computer.SetQuotaPolicy)
	guruGroup.GET("/computer/quotas", h.Computer.ListQuotas)
	adminGroup.PUT("/computer/quotas", h.Computer.SetStudentQuota)

	guruGroup.GET("/computer/reading-reports", h.Computer.ListReadingReports)
	guruGroup.POST("/computer/reading-reports/:id/review", h.Computer.ReviewReadingReport)

	guruGroup.POST("/computer/bookings", h.Computer.CreateBooking)
	guruGroup.GET("/computer/bookings", h.Computer.ListBookings)
	guruGroup.DELETE("/computer/bookings/:id", h.Computer.CancelBooking)

	guruGroup.GET("/computer/sessions", h.Computer.ListSessions)
	guruGroup.POST("/computer/sessions/:id/end", h.Computer.EndSession)

	// Kiosk komputer: scan mulai sesi + pantau status stasiun (dibuka di PC, guru login).
	guruGroup.POST("/computer/kiosk/start", h.Computer.StartSessionByScan)
	guruGroup.GET("/computer/kiosk/stations/:code", h.Computer.GetStationSession)

	// Modul Keuangan (buku besar generik multi-unit: sampah, koperasi, dll).
	// Baca: admin/bendahara/guru/staff. Transaksi bisa diinput guru/staff.
	guruGroup.GET("/finance/units", h.Finance.ListUnits)
	guruGroup.GET("/finance/units/:id", h.Finance.GetUnit)
	guruGroup.GET("/finance/categories", h.Finance.ListCategories)
	guruGroup.GET("/finance/transactions", h.Finance.ListTransactions)
	guruGroup.GET("/finance/transactions/:id", h.Finance.GetTransaction)
	guruGroup.POST("/finance/transactions", h.Finance.CreateTransaction)
	guruGroup.PUT("/finance/transactions/:id", h.Finance.UpdateTransaction)
	guruGroup.GET("/finance/summary", h.Finance.Summary)
	guruGroup.GET("/finance/recap/category", h.Finance.RecapByCategory)
	guruGroup.GET("/finance/recap/monthly", h.Finance.RecapMonthly)

	// Kelola unit & kategori + hapus transaksi: admin/bendahara.
	bendaharaGroup.POST("/finance/units", h.Finance.CreateUnit)
	bendaharaGroup.PUT("/finance/units/:id", h.Finance.UpdateUnit)
	bendaharaGroup.DELETE("/finance/units/:id", h.Finance.DeleteUnit)
	bendaharaGroup.POST("/finance/categories", h.Finance.CreateCategory)
	bendaharaGroup.PUT("/finance/categories/:id", h.Finance.UpdateCategory)
	bendaharaGroup.DELETE("/finance/categories/:id", h.Finance.DeleteCategory)
	bendaharaGroup.DELETE("/finance/transactions/:id", h.Finance.DeleteTransaction)
	bendaharaGroup.GET("/finance/audit", h.Finance.ListAuditLog)

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
	adminGroup.PATCH("/users/:id/status", h.User.UpdateUserStatus)
	adminGroup.POST("/users/generate", h.User.GenerateAccounts)
	adminGroup.GET("/users/:id", h.User.GetUserByID)

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
	adminGroup.GET("/eoffice/letter-types", h.EOffice.GetLetterTypes)
	adminGroup.POST("/eoffice/letter-types", h.EOffice.CreateLetterType)
	adminGroup.PUT("/eoffice/letter-types/:id", h.EOffice.UpdateLetterType)
	adminGroup.DELETE("/eoffice/letter-types/:id", h.EOffice.DeleteLetterType)
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
	adminGroup.POST("/eoffice/upload-arsip-pdf", h.EOffice.UploadArsipPDF)

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
	adminGroup.POST("/arsip/upload-pdf", h.EOffice.UploadArsipPDF)

	guruGroup.GET("/kiosk/savings-lookup", h.Savings.GetSiswa)

	// Attendance (mutasi & laporan hanya guru ke atas; siswa hanya rangkuman sendiri)
	guruGroup.GET("/attendance/stats", h.Attendance.GetStats)
	guruGroup.GET("/attendance/daily", h.Attendance.GetDailyClass)
	guruGroup.POST("/attendance/manual", h.Attendance.RecordManual)
	guruGroup.POST("/attendance/scan", h.Attendance.ScanQR)
	guruGroup.GET("/attendance/report", h.Attendance.GetReport)
	guruGroup.GET("/attendance/student-summary/:studentId", h.Attendance.GetStudentSummary)
	// Presensi GTK (guru & tenaga kependidikan) — scan kartu GTK, rekap harian/rentang.
	guruGroup.POST("/gtk-attendance/scan", h.AttendanceGTK.ScanGTK)
	guruGroup.GET("/gtk-attendance/daily", h.AttendanceGTK.GetGTKDaily)
	guruGroup.GET("/gtk-attendance/report", h.AttendanceGTK.GetGTKReport)
	guruGroup.POST("/scan/resolve", h.ScanResolve.Resolve)
	// PDF presensi: LibreOffice headless (satu-satunya mesin sejak 2026-10-08);
	// 503 bila binary tak terpasang → frontend mengarahkan ke export Excel.
	guruGroup.POST("/presensi/pdf/libreoffice", h.PDF.ConvertXlsxLibreOffice)
	auth.GET("/attendance/holiday", h.Attendance.CheckHoliday)
	adminGroup.GET("/school-holidays", h.Attendance.ListSchoolHolidays)
	adminGroup.GET("/school-holidays/national", h.Attendance.GetNationalHolidays)
	adminGroup.POST("/school-holidays", h.Attendance.CreateSchoolHoliday)
	adminGroup.PUT("/school-holidays/:id", h.Attendance.UpdateSchoolHoliday)
	adminGroup.DELETE("/school-holidays/:id", h.Attendance.DeleteSchoolHoliday)

	// Loan
	adminGroup.GET("/loans", h.Loan.GetLoans)
	adminGroup.POST("/loans", h.Loan.CreateLoan)
	adminGroup.POST("/loans/:id/approve", h.Loan.ApproveLoan)
	adminGroup.POST("/loans/:id/pay", h.Loan.AddPayment)
	adminGroup.POST("/loans/:id/reject", h.Loan.RejectLoan)

	// Alumni
	adminGroup.GET("/alumni/stats", h.Alumni.GetAlumniStats)
	adminGroup.GET("/alumni/graduation-years", h.Alumni.GetAlumniGraduationYears)
	auth.GET("/alumni/document-types", h.Alumni.GetDocumentTypes)
	adminGroup.POST("/alumni/graduate", h.Alumni.GraduateStudents)
	adminGroup.POST("/alumni/import-bulk", h.Alumni.ImportBulkAlumni)
	adminGroup.POST("/alumni/import-grades-bulk", h.Alumni.ImportBulkGrades)
	adminGroup.GET("/integrations/settings", h.Integration.GetSettings)
	adminGroup.POST("/integrations/settings", h.Integration.UpdateSettings)
	adminGroup.GET("/settings/backup/telegram", h.TelegramBackup.GetSettings)
	adminGroup.PUT("/settings/backup/telegram", h.TelegramBackup.UpdateSettings)
	adminGroup.POST("/settings/backup/telegram/test", h.TelegramBackup.TestBackup)
	adminGroup.POST("/settings/backup/telegram/restore", h.TelegramBackup.RestoreBackup, sensitiveLimit)
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
	adminGroup.PUT("/admin/mutasi/logs/:id", h.Mutasi.UpdateMutasiLog)
	adminGroup.GET("/admin/mutasi/rekap", h.Mutasi.GetMutasiRekap)

	// Notifications
	notifs := server.Group("/api/notifications")
	notifs.Use(authMiddleware.JWTMiddleware)
	notifs.GET("", h.Notification.GetNotifications)
	notifs.GET("/stats", h.Notification.GetStats)
	notifs.PATCH("/:id/read", h.Notification.MarkAsRead)
	notifs.POST("/read-all", h.Notification.MarkAllAsRead)
	// Pengumuman sistem ke seluruh pengguna dashboard (khusus admin).
	adminGroup.POST("/notifications/broadcast", h.Notification.BroadcastNotification)

	// Web Push (PWA)
	pushGroup := server.Group("/api/push")
	pushGroup.Use(authMiddleware.JWTMiddleware)
	pushGroup.GET("/status", h.Push.Status)
	pushGroup.POST("/subscribe", h.Push.Subscribe)
	pushGroup.DELETE("/subscribe", h.Push.Unsubscribe)
	// Kirim notifikasi uji ke perangkat pemanggil sendiri — semua user
	// terautentikasi boleh, agar orang tua bisa memverifikasi push aktif.
	pushGroup.POST("/test", h.Push.TestSend)

	// Chat (DM 1-1) — semua user terautentikasi. WebSocket route (GET)
	// sengaja dibuat terpisah (lihat bawah) karena middleware-nya beda.
	chatGroup := auth.Group("")
	chatGroup.GET("/chat/conversations", h.Chat.List)
	chatGroup.POST("/chat/conversations", h.Chat.Create)
	chatGroup.GET("/chat/conversations/:id/messages", h.Chat.History)
	chatGroup.POST("/chat/conversations/:id/messages", h.Chat.SendMessage)
	chatGroup.POST("/chat/conversations/:id/read", h.Chat.MarkRead)
	chatGroup.GET("/chat/users", h.Chat.ListUsers)
	chatGroup.GET("/chat/ws", h.Chat.WS)

	// Portal Orang Tua (role: orangtua)
	parentGroup := server.Group("/api/parent")
	parentGroup.Use(authMiddleware.JWTMiddleware, authMiddleware.RoleMiddleware(authMiddleware.RoleOrangtua))
	parentGroup.GET("/children", h.Parent.GetChildren)
	parentGroup.GET("/dashboard", h.Parent.GetDashboard)
	parentGroup.GET("/leave-requests", h.Parent.GetMyLeaves)
	parentGroup.POST("/leave-requests", h.Parent.CreateLeave)
	parentGroup.DELETE("/leave-requests/:id", h.Parent.CancelLeave)
	parentGroup.GET("/attendance", h.Parent.GetChildAttendance)
	parentGroup.GET("/savings/:studentId", h.Parent.GetChildSavings)
	parentGroup.GET("/savings/:studentId/rekening-koran", h.Parent.GetChildStatement)
	parentGroup.GET("/notification-preferences", h.Parent.GetPreferences)
	parentGroup.PUT("/notification-preferences", h.Parent.UpdatePreferences)
	// Mutasi keluar: pengajuan pindah sekolah untuk anak yang tertaut.
	parentGroup.GET("/mutasi-keluar", h.Parent.ListMutasiOut)
	parentGroup.POST("/mutasi-keluar", h.Parent.CreateMutasiOut)
	// Ruang Tumbuh — profil perkembangan anak & pengamatan orang tua (§24/§25/§28)
	parentGroup.GET("/ruang-tumbuh/results", h.Skrining.ListParentResults)
	parentGroup.GET("/ruang-tumbuh/recommendations", h.Skrining.ListParentRecommendations)
	parentGroup.GET("/ruang-tumbuh/observations", h.Skrining.ListParentObservations)
	parentGroup.POST("/ruang-tumbuh/observations", h.Skrining.SaveParentObservation)
	// Modul Tugas & PR: tugas & deadline anak (orang tua memantau pengumpulan).
	parentGroup.GET("/tugas", h.Tugas.ListChildrenTugas)

	// Portal Siswa (role: siswa) — self-service, data ter-scoping
	studentGroup := server.Group("/api/student")
	studentGroup.Use(authMiddleware.JWTMiddleware, authMiddleware.RoleMiddleware(authMiddleware.RoleSiswa))
	studentGroup.GET("/me", h.StudentMe.GetMe)
	studentGroup.GET("/me/attendance", h.StudentMe.GetMyAttendance)
	studentGroup.GET("/me/savings", h.StudentMe.GetMySavings)

	// Bank Soal: Praktik Siswa
	studentGroup.GET("/me/practices", h.BankSoal.ListPractices)
	studentGroup.POST("/me/practices", h.BankSoal.CreatePractice)
	studentGroup.GET("/me/practices/:id", h.BankSoal.GetPractice)
	studentGroup.POST("/me/practices/:id/submit", h.BankSoal.SubmitPractice)
	studentGroup.GET("/me/practices/:id/result", h.BankSoal.GetPracticeResult)

	// Bank Soal: Siswa melihat paket soal
	studentGroup.GET("/me/sets", h.BankSoal.ListSetsForStudent)
	studentGroup.GET("/me/sets/:id/items", h.BankSoal.ListSetItems)

	// Ruang Tumbuh: siswa menjalankan game skrining dari sesi yang aktif.
	studentGroup.GET("/me/ruang-tumbuh/sessions", h.Skrining.ListMySessions)
	studentGroup.POST("/me/ruang-tumbuh/sessions/:id/start", h.Skrining.StartMyAttempt)
	studentGroup.POST("/me/ruang-tumbuh/attempts/:id/submit", h.Skrining.SubmitMyAttempt)
	studentGroup.GET("/me/ruang-tumbuh/attempts/:id/result", h.Skrining.GetMyAttemptResult)
	studentGroup.GET("/me/ruang-tumbuh/history", h.Skrining.MyHistory)

	// Modul Tugas & PR: siswa melihat & mengumpulkan tugas kelasnya.
	studentGroup.GET("/me/tugas", h.Tugas.ListMyTugas)
	studentGroup.GET("/me/tugas/:id", h.Tugas.GetMyTugas)
	studentGroup.POST("/me/tugas/:id/submit", h.Tugas.SubmitMyTugas)

	// Komputer Belajar: kuota, laporan baca, jadwal siswa.
	studentGroup.GET("/me/computer/quota", h.Computer.GetMyQuota)
	studentGroup.GET("/me/computer/reading-reports", h.Computer.ListMyReadingReports)
	studentGroup.POST("/me/computer/reading-reports", h.Computer.CreateReadingReport)
	studentGroup.GET("/me/computer/bookings", h.Computer.ListMyBookings)

	// Pengajuan izin/sakit: guru/admin meninjau
	guruGroup.GET("/leave-requests", h.Parent.ListLeaves)
	guruGroup.POST("/leave-requests/:id/review", h.Parent.ReviewLeave)

	// Ruang Tumbuh: modul skrining & perkembangan peserta didik (guru/staff).
	guruGroup.GET("/ruang-tumbuh/games", h.Skrining.ListGames)
	guruGroup.GET("/ruang-tumbuh/sessions", h.Skrining.ListSessions)
	guruGroup.POST("/ruang-tumbuh/sessions", h.Skrining.CreateSession)
	guruGroup.GET("/ruang-tumbuh/sessions/:id", h.Skrining.GetSession)
	guruGroup.POST("/ruang-tumbuh/sessions/:id/start", h.Skrining.StartSession)
	guruGroup.POST("/ruang-tumbuh/sessions/:id/finish", h.Skrining.FinishSession)
	guruGroup.GET("/ruang-tumbuh/sessions/:id/students/:studentId", h.Skrining.GetStudentResult)
	guruGroup.POST("/ruang-tumbuh/sessions/:id/observations", h.Skrining.SaveObservation)
	guruGroup.GET("/ruang-tumbuh/sessions/:id/recommendations", h.Skrining.ListSessionRecommendations)
	guruGroup.POST("/ruang-tumbuh/sessions/:id/recommendations", h.Skrining.SaveRecommendation)
	guruGroup.PUT("/ruang-tumbuh/recommendations/:recId/share", h.Skrining.ToggleRecommendationShare)
	guruGroup.POST("/ruang-tumbuh/sessions/:id/invite-parents", h.Skrining.InviteParents)
	guruGroup.GET("/ruang-tumbuh/dashboard", h.Skrining.ClassDashboard)
	staffGroup := auth.Group("")
	staffGroup.Use(authMiddleware.RoleMiddleware(authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin, authMiddleware.RoleStaff))
	staffGroup.GET("/ruang-tumbuh/aggregate", h.Skrining.StaffAggregate)

	// DocStation — scan (eSCL) & cetak (IPP/RAW) ke printer LAN, khusus staff.
	// Server hanya proxy; pemrosesan gambar/PDF dilakukan di browser client.
	// Session sudah dipastikan oleh JWTMiddleware + RoleMiddleware di atas.
	staffGroup.GET("/docstation/session", h.DocStation.Session)
	staffGroup.GET("/docstation/printers", h.DocStation.ListPrinters)
	staffGroup.GET("/docstation/status", h.DocStation.PrinterStatus)
	staffGroup.POST("/docstation/print", h.DocStation.PrintJob)
	staffGroup.POST("/docstation/print/ipp", h.DocStation.PrintIPP)
	staffGroup.POST("/docstation/save", h.DocStation.SaveDocument)
	staffGroup.POST("/docstation/archive", h.EOffice.ArchiveFromDocStation)
	staffGroup.Any("/docstation/escl/*", h.DocStation.ProxyESCL)

	// SPMB — input data pendaftar oleh panitia/admin di sekolah.
	// Sebelumnya /api/public/spmb/register (publik, ortu isi sendiri);
	// kini wajib login + role staff/admin/superadmin.
	staffGroup.POST("/spmb/registrants", h.SPMB.Register)
	// Tanggal referensi untuk kalkulasi usia di form input panitia.
	staffGroup.GET("/spmb/reference-date", h.SPMB.GetReferenceDate)

	// Report Templates (Report Builder)
	auth.GET("/reports/templates", h.ReportTemplate.GetAll)
	auth.GET("/print-settings/:module", h.PrintSettings.GetByModule)
	adminGroup.PUT("/print-settings/:module", h.PrintSettings.Save)
	auth.GET("/reports/templates/:id", h.ReportTemplate.GetByID)
	auth.GET("/reports/templates/code/:code", h.ReportTemplate.GetByCode)
	auth.GET("/reports/templates/module/:module", h.ReportTemplate.GetByModule)
	auth.GET("/reports/templates/default/:module", h.ReportTemplate.GetDefaultModule)
	auth.GET("/reports/templates/:id/file", h.ReportTemplate.DownloadFile)
	adminGroup.POST("/reports/templates", h.ReportTemplate.Create)
	adminGroup.PUT("/reports/templates/:id", h.ReportTemplate.Update)
	adminGroup.PUT("/reports/templates/:id/default", h.ReportTemplate.SetDefault)
	adminGroup.POST("/reports/templates/:id/file", h.ReportTemplate.UploadXLSX)
	adminGroup.DELETE("/reports/templates/:id", h.ReportTemplate.Delete)

	// AI Providers Management
	adminGroup.GET("/ai-providers", h.AIProvider.GetAll)
	adminGroup.POST("/ai-providers", h.AIProvider.Create)
	adminGroup.PUT("/ai-providers/:id", h.AIProvider.Update)
	adminGroup.DELETE("/ai-providers/:id", h.AIProvider.Delete)

	// Theme Preset Management (Pengaturan → Landing → Tema Warna)
	adminGroup.GET("/theme-presets", h.ThemePreset.GetAll)
	adminGroup.POST("/theme-presets", h.ThemePreset.Create)
	adminGroup.PUT("/theme-presets/:id", h.ThemePreset.Update)
	adminGroup.DELETE("/theme-presets/:id", h.ThemePreset.Delete)
	adminGroup.POST("/theme-presets/:id/apply", h.ThemePreset.Apply)

	// Modul Tugas & PR (guru → siswa), scoped ke kelas wali.
	guruGroup.GET("/tugas", h.Tugas.ListTugas)
	guruGroup.POST("/tugas", h.Tugas.CreateTugas)
	guruGroup.GET("/tugas/:id", h.Tugas.GetTugas)
	guruGroup.PUT("/tugas/:id", h.Tugas.UpdateTugas)
	guruGroup.DELETE("/tugas/:id", h.Tugas.DeleteTugas)
	guruGroup.POST("/tugas/:id/archive", h.Tugas.ArchiveTugas)
	guruGroup.GET("/tugas/:id/roster", h.Tugas.ListRoster)
	guruGroup.GET("/tugas/:id/submissions", h.Tugas.ListSubmissions)
	guruGroup.GET("/tugas/:id/submissions/:subId", h.Tugas.GetSubmission)
	guruGroup.PUT("/tugas/:id/submissions/:subId/grade", h.Tugas.GradeSubmission)
	guruGroup.POST("/tugas/:id/remind", h.Tugas.Remind)

	// Bank Soal
	guruGroup.GET("/bank-soal/bab", h.BankSoal.ListBabs)
	guruGroup.POST("/bank-soal/bab", h.BankSoal.CreateBab)
	guruGroup.PUT("/bank-soal/bab/reorder", h.BankSoal.ReorderBabs)
	guruGroup.GET("/bank-soal/bab/:id", h.BankSoal.GetBab)
	guruGroup.PUT("/bank-soal/bab/:id", h.BankSoal.UpdateBab)
	guruGroup.DELETE("/bank-soal/bab/:id", h.BankSoal.DeleteBab)

	guruGroup.GET("/bank-soal/questions", h.BankSoal.ListQuestions)
	guruGroup.POST("/bank-soal/questions", h.BankSoal.CreateQuestion)
	guruGroup.GET("/bank-soal/questions/:id", h.BankSoal.GetQuestion)
	guruGroup.PUT("/bank-soal/questions/:id", h.BankSoal.UpdateQuestion)
	guruGroup.DELETE("/bank-soal/questions/:id", h.BankSoal.DeleteQuestion)
	guruGroup.POST("/bank-soal/questions/bulk-delete", h.BankSoal.BulkDeleteQuestions)

	guruGroup.GET("/bank-soal/sets", h.BankSoal.ListSets)
	guruGroup.POST("/bank-soal/sets", h.BankSoal.CreateSet)
	guruGroup.GET("/bank-soal/sets/:id", h.BankSoal.GetSet)
	guruGroup.PUT("/bank-soal/sets/:id", h.BankSoal.UpdateSet)
	guruGroup.DELETE("/bank-soal/sets/:id", h.BankSoal.DeleteSet)
	guruGroup.GET("/bank-soal/sets/:id/items", h.BankSoal.ListSetItems)
	guruGroup.POST("/bank-soal/sets/:id/items", h.BankSoal.AddSetItem)
	guruGroup.POST("/bank-soal/sets/:id/items/bulk", h.BankSoal.BulkAddSetItems)
	guruGroup.DELETE("/bank-soal/sets/:id/items/:questionId", h.BankSoal.RemoveSetItem)
	guruGroup.PUT("/bank-soal/sets/:id/items/reorder", h.BankSoal.ReorderSetItems)
	guruGroup.PUT("/bank-soal/sets/:id/assignments", h.BankSoal.AssignClasses)
	guruGroup.GET("/bank-soal/sets/:id/assignments", h.BankSoal.ListAssignments)
	guruGroup.GET("/bank-soal/sets/:id/analytics", h.BankSoal.GetSetAnalytics)

	guruGroup.GET("/bank-soal/banks", h.BankSoal.ListBanks)
	guruGroup.POST("/bank-soal/banks", h.BankSoal.CreateBank)
	guruGroup.GET("/bank-soal/banks/:id", h.BankSoal.GetBank)
	guruGroup.DELETE("/bank-soal/banks/:id", h.BankSoal.DeleteBank)

	// Student practices (guru/admin bisa melihat semua)
	guruGroup.GET("/bank-soal/practices", h.BankSoal.ListPractices)
	guruGroup.GET("/bank-soal/practices/:id", h.BankSoal.GetPractice)
	guruGroup.GET("/bank-soal/practices/:id/result", h.BankSoal.GetPracticeResult)
	guruGroup.PUT("/bank-soal/practices/:id/answers/:questionId/grade", h.BankSoal.GradeAnswer)
	// Tautan ortu <-> siswa (admin)
	adminGroup.GET("/master/students/:id/parents", h.Parent.GetStudentParents)
	adminGroup.POST("/master/students/:id/parents", h.Parent.LinkParent)
	adminGroup.DELETE("/master/students/:id/parents/:userId", h.Parent.UnlinkParent)

	// Profile
	profile := server.Group("/api/profile")
	profile.Use(authMiddleware.JWTMiddleware)
	profile.GET("", h.User.GetProfile)
	profile.PATCH("", h.User.UpdateProfile)
	profile.GET("/logs", h.User.GetProfileLogs)

	// Upload
	auth.POST("/upload", h.Upload.GeneralUpload)
	// Upload dokumen SPMB oleh panitia/admin (input data di sekolah).
	// Sebelumnya rute ini publik (hanya cek nomor registrasi); kini
	// wajib login + role staff/admin/superadmin.
	staffGroup.POST("/spmb/registrants/:id/upload", h.SPMB.UploadDocuments)

	// Cloud Storage — penyimpanan pribadi per-user dengan backend Telegram
	// Bot API lokal. Setiap user punya ruang sendiri (isolasi owner_id).
	cloudGroup := auth.Group("")
	cloudGroup.Use(authMiddleware.RoleMiddleware(authMiddleware.RoleSuperadmin, authMiddleware.RoleAdmin, authMiddleware.RoleStaff, authMiddleware.RoleGuru))
	cloudGroup.GET("/cloud/config", h.CloudStorage.Config)
	cloudGroup.GET("/cloud/usage", h.CloudStorage.Usage)
	cloudGroup.GET("/cloud/files", h.CloudStorage.ListFiles)
	cloudGroup.POST("/cloud/files", h.CloudStorage.Upload)
	// Upload bertahap (chunked) untuk file besar (batas ~100MB request
	// Cloudflare Tunnel). Lihat handlers/cloudstorage_chunked_handler.go.
	cloudGroup.POST("/cloud/upload-sessions", h.CloudStorage.CreateUploadSession)
	cloudGroup.POST("/cloud/upload-sessions/:id/chunks", h.CloudStorage.UploadChunk)
	cloudGroup.POST("/cloud/upload-sessions/:id/complete", h.CloudStorage.CompleteUploadSession)
	cloudGroup.GET("/cloud/upload-sessions/:id/status", h.CloudStorage.GetUploadSessionStatus)
	cloudGroup.DELETE("/cloud/upload-sessions/:id", h.CloudStorage.AbortUploadSession)
	cloudGroup.GET("/cloud/files/:id", h.CloudStorage.GetFile)
	cloudGroup.GET("/cloud/files/:id/download", h.CloudStorage.Download)
	cloudGroup.GET("/cloud/files/:id/thumb", h.CloudStorage.Thumbnail)
	cloudGroup.PUT("/cloud/files/:id", h.CloudStorage.Rename)
	cloudGroup.DELETE("/cloud/files/:id", h.CloudStorage.Trash)
	cloudGroup.POST("/cloud/files/copy", h.CloudStorage.Copy)
	cloudGroup.POST("/cloud/files/move", h.CloudStorage.Move)
	cloudGroup.POST("/cloud/files/zip", h.CloudStorage.Zip)
	cloudGroup.POST("/cloud/files/reorder", h.CloudStorage.Reorder)
	cloudGroup.POST("/cloud/notes", h.CloudStorage.CreateNote)
	cloudGroup.PUT("/cloud/files/:id/content", h.CloudStorage.UpdateContent)
	cloudGroup.POST("/cloud/files/:id/rotate", h.CloudStorage.Rotate)
	cloudGroup.POST("/cloud/files/:id/star", h.CloudStorage.SetStar)
	cloudGroup.POST("/cloud/folders", h.CloudStorage.CreateFolder)
	cloudGroup.GET("/cloud/search", h.CloudStorage.Search)
	cloudGroup.GET("/cloud/trash", h.CloudStorage.ListTrash)
	cloudGroup.POST("/cloud/trash/restore-all", h.CloudStorage.RestoreAll)
	cloudGroup.POST("/cloud/trash/:id/restore", h.CloudStorage.Restore)
	cloudGroup.DELETE("/cloud/trash/:id", h.CloudStorage.PermanentDelete)
	cloudGroup.DELETE("/cloud/trash", h.CloudStorage.EmptyTrash)
	cloudGroup.POST("/cloud/files/:id/share", h.CloudStorage.CreateShare)
	cloudGroup.DELETE("/cloud/files/:id/share", h.CloudStorage.RevokeShare)

	// Share link publik (tanpa login): hanya file/folder bertoken, tidak bisa
	// menelusuri folder pemilik.
	server.GET("/api/cloud/s/:token", h.CloudStorage.ShareInfo)
	server.GET("/api/cloud/s/:token/download", h.CloudStorage.DownloadShared)
	server.GET("/api/cloud/s/:token/zip", h.CloudStorage.ShareZip)
	server.GET("/api/cloud/s/:token/file/:id", h.CloudStorage.ShareDiskDownload)
}
