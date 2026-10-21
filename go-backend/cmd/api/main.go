package main

import (
	"context"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	gommonLog "github.com/labstack/gommon/log"
	"github.com/sekolahku/go-backend/internal/chat"
	authMiddleware "github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/notify"
	"github.com/sekolahku/go-backend/internal/push"
	"github.com/sekolahku/go-backend/internal/repository"
	"github.com/sekolahku/go-backend/internal/scheduler"

	"github.com/sekolahku/go-backend/internal/handlers"
)

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
			continue
		}
		defer file.Close()

		data, err := io.ReadAll(file)
		if err != nil {
			continue
		}

		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}

			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				continue
			}

			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])

			if (strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"")) ||
				(strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'")) {
				if len(val) >= 2 {
					val = val[1 : len(val)-1]
				}
			}

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

// newCloudStorageHandler membangun handler Cloud Storage sekaligus menyambung
// repo sesi upload bertahap (dipisah via setter untuk menghindari import cycle).
func newCloudStorageHandler(repos *Repositories) *handlers.CloudStorageHandler {
	h := handlers.NewCloudStorageHandler(repos.CloudStorage)
	h.Svc.SetSessionRepo(repos.CloudUploadSession)
	return h
}

func main() {
	loadEnv()
	startTime := time.Now()
	server := echo.New()

	// Semua trafik publik masuk via Cloudflare Tunnel. Dengan IPExtractor dari
	// X-Forwarded-For, RealIP() memakai IP pengguna asli sehingga rate limiter
	// & audit log tidak melihat IP tunnel yang sama untuk semua pengguna.
	server.IPExtractor = echo.ExtractIPFromXFFHeader()

	authMiddleware.InitJWTMiddleware()

	// Log level
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

	// Global Middleware
	server.Use(middleware.RequestID())
	server.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: `{"time":"${time_rfc3339_nano}","id":"${id}","remote_ip":"${remote_ip}","host":"${host}","method":"${method}","uri":"${uri}","status":${status},"error":"${error}","latency":"${latency}","latency_human":"${latency_human}","bytes_in":${bytes_in},"bytes_out":${bytes_out}}` + "\n",
		Output: os.Stdout,
	}))
	server.Use(middleware.Recover())
	// Batas body global 60M. Upload Cloud Storage dikecualikan di sini karena
	// bisa mencapai 2GB (upload biasa) atau 30MB per potongan (upload
	// bertahap); handler-nya memasang MaxBytesReader sendiri sesuai
	// CLOUDSTORAGE_MAX_UPLOAD_MB.
	server.Use(middleware.BodyLimitWithConfig(middleware.BodyLimitConfig{
		Limit: "60M",
		Skipper: func(c echo.Context) bool {
			if c.Request().Method != http.MethodPost {
				return false
			}
			path := c.Path()
			return path == "/api/cloud/files" || strings.HasPrefix(path, "/api/cloud/upload-sessions/")
		},
	}))
	server.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 5,
		// WebSocket handshake (HTTP 101) tidak boleh melewati gzip:
		// 101 yang ditulis melalui gzip.Writer tersangkut di buffer dan
		// handshake client tidak pernah selesai.
		//
		// Unduhan ZIP juga dilewati: isinya sudah terkompresi, dan menyalurkan
		// arsip besar lewat gzip.Writer hanya menambah beban + buffering.
		Skipper: func(c echo.Context) bool {
			path := c.Request().URL.Path
			if strings.HasSuffix(path, "/api/chat/ws") {
				return true
			}
			// Cloud Storage ZIP: /api/cloud/files/zip atau /api/cloud/s/<token>/zip
			if path == "/api/cloud/files/zip" {
				return true
			}
			if strings.HasPrefix(path, "/api/cloud/s/") && strings.HasSuffix(path, "/zip") {
				return true
			}
			return false
		},
	}))
	server.Use(authMiddleware.SecurityHeaders)
	// CSRF defense-in-depth: Origin/Referer check untuk semua mutating /api/*
	// + double-submit token untuk endpoint auth-sensitive.
	server.Use(authMiddleware.CSRFProtected())
	// Pastikan cookie csrf_token tersedia untuk frontend di semua response.
	server.Use(authMiddleware.EnsureCSRFToken)

	// HTTPS redirect in production
	if os.Getenv("ENV") == "production" && os.Getenv("TRUST_PROXY") != "true" {
		server.Use(middleware.HTTPSRedirect())
	}
	// AllowOrigins: produksi hanya domain resmi; origin dev (localhost,
	// 127.0.0.1, hostname Tailscale) hanya dimuat saat ENV != production
	// agar binary produksi tidak menerima asal dev. Host dev/LAN tambahan
	// selalu bisa ditambah via EXTRA_ALLOWED_ORIGINS tanpa rebuild.
	allowOrigins := []string{
		"https://sdn1kenanga.sch.id",
	}
	if os.Getenv("ENV") != "production" {
		allowOrigins = append(allowOrigins,
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:3001",
			"http://127.0.0.1:3001",
			"https://server-kenanga.tail747644.ts.net",
		)
	}
	if extra := os.Getenv("EXTRA_ALLOWED_ORIGINS"); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			if o = strings.TrimSpace(o); o != "" {
				allowOrigins = append(allowOrigins, o)
			}
		}
	}
	server.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     allowOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "X-CSRF-Token"},
		AllowCredentials: true,
	}))

	// Database initialization
	db := initDatabase(server)
	defer db.Close()

	repository.SetHolidayDB(db)

	// Repositories
	repos := &Repositories{
		User:               repository.NewUserRepository(db),
		Academic:           repository.NewAcademicRepository(db),
		Inventory:          repository.NewInventoryRepository(db),
		SPMB:               repository.NewSPMBRepository(db),
		Student:            repository.NewStudentRepository(db),
		Employee:           repository.NewEmployeeRepository(db),
		Savings:            repository.NewSavingsRepository(db),
		SavingsGTK:         repository.NewSavingsGTKRepository(db),
		Library:            repository.NewLibraryRepository(db),
		EOffice:            repository.NewEOfficeRepository(db),
		Attendance:         repository.NewAttendanceRepository(db),
		AttendanceGTK:      repository.NewAttendanceGTKRepository(db),
		Loan:               repository.NewLoanRepository(db),
		Setting:            repository.NewSettingRepository(db),
		Alumni:             repository.NewAlumniRepository(db),
		Mutasi:             repository.NewMutasiRepository(db),
		Gallery:            repository.NewGalleryRepository(db),
		Announcement:       repository.NewAnnouncementRepository(db),
		AuditLog:           repository.NewAuditLogRepository(db),
		Notification:       repository.NewNotificationRepository(db),
		PasswordReset:      repository.NewPasswordResetRepository(db),
		StudentDocument:    repository.NewStudentDocumentRepository(db),
		TelegramBackup:     repository.NewTelegramBackupRepository(db),
		Dashboard:          repository.NewDashboardRepository(db, startTime),
		Public:             repository.NewPublicRepository(db),
		PublicLibrary:      repository.NewPublicLibraryRepository(db),
		Booking:            repository.NewLibraryBookingRepository(db),
		Computer:           repository.NewComputerRepository(db),
		Finance:            repository.NewFinanceRepository(db),
		StickerPreset:      repository.NewLibraryStickerPresetRepository(db),
		FAQ:                repository.NewFAQRepository(db),
		Contact:            repository.NewContactRepository(db),
		Sync:               repository.NewSyncRepository(db),
		Integration:        repository.NewIntegrationRepository(db),
		Document:           repository.NewDocumentRepository(db),
		Holiday:            repository.NewSchoolHolidayRepository(db),
		Push:               repository.NewPushRepository(db),
		Parent:             repository.NewParentRepository(db),
		BankSoal:           repository.NewBankSoalRepository(db),
		ExamAssignment:     repository.NewExamAssignmentRepository(db),
		Kurikulum:          repository.NewKurikulumRepository(db),
		Chat:               repository.NewChatRepository(db),
		Skrining:           repository.NewSkriningRepository(db),
		Tugas:              repository.NewTugasRepository(db),
		CloudStorage:       repository.NewCloudStorageRepository(db),
		CloudUploadSession: repository.NewCloudUploadSessionRepository(db),
		ReportTemplate:     repository.NewReportTemplateRepository(db),
		PrintSettings:      repository.NewPrintSettingsRepository(db),
		AIProvider:         repository.NewAIProviderRepository(db),
		ThemePreset:        repository.NewThemePresetRepository(db),
	}

	// Aktifkan pemeriksaan status user pada setiap request terautentikasi,
	// sehingga token milik akun yang sudah dinonaktifkan segera ditolak.
	authMiddleware.InitJWTUserLookup(repos.User)

	// Auto sync students on startup
	log.Println("[Startup] Running initial synchronization of active students...")
	if filled, err := repository.BackfillStudentQRCodes(db); err != nil {
		log.Printf("[Startup] Warning: Student QR backfill failed: %v", err)
	} else if filled > 0 {
		log.Printf("[Startup] Backfilled %d student QR codes (STU- namespace).", filled)
	}
	if syncCount, err := repos.Savings.SyncFromStudents(); err != nil {
		log.Printf("[Startup] Warning: Savings initial sync failed: %v", err)
	} else {
		log.Printf("[Startup] Savings initial sync completed, %d active students synchronized.", syncCount)
	}
	if syncCount, err := repos.Library.SyncFromStudents(); err != nil {
		log.Printf("[Startup] Warning: Library initial sync failed: %v", err)
	} else {
		log.Printf("[Startup] Library initial sync completed, %d active students synchronized.", syncCount)
	}
	if syncCount, err := repos.Alumni.SyncFromStudents(); err != nil {
		log.Printf("[Startup] Warning: Buku Induk initial sync failed: %v", err)
	} else {
		log.Printf("[Startup] Buku Induk initial sync completed, %d students synchronized.", syncCount)
	}

	// Web Push (PWA): VAPID keys dari .env. Bila belum diisi, fitur push
	// otomatis nonaktif tanpa mengganggu fitur lain.
	pushSvc := push.NewService(
		repos.Push,
		os.Getenv("VAPID_PUBLIC_KEY"),
		os.Getenv("VAPID_PRIVATE_KEY"),
		os.Getenv("VAPID_SUBJECT"),
	)
	if pushSvc.Enabled() {
		log.Println("[Startup] Web Push aktif (VAPID keys ditemukan).")
	} else {
		log.Println("[Startup] Web Push nonaktif — VAPID_PUBLIC_KEY/PRIVATE_KEY belum diisi.")
	}

	// Notifikasi orang tua (in-app + web push) menghormati preferensi kategori.
	prefsRepo := repository.NewPreferenceRepository(db)
	parentNotify := notify.NewParentNotifier(
		repos.Parent, repos.Notification, prefsRepo, pushSvc,
	)

	// Hub WebSocket chat (in-memory; tidak menyentuh DB).
	chatHub := chat.NewHub()

	// Pengguna yang sedang membuka PWA tidak perlu Web Push (notifikasi
	// in-app sudah tampil) — hub menjadi sumber kebenaran status terlihat.
	parentNotify.Presence = chatHub

	// Backup Telegram memakai bot & chat yang SAMA dengan Cloud Storage
	// (CLOUDSTORAGE_BOT_TOKEN / CLOUDSTORAGE_CHAT_ID). Seed default di DB dan
	// aktifkan secara bawaan bila kredensial tersedia.
	if err := repos.TelegramBackup.EnsureDefaults(); err != nil {
		log.Printf("[startup] Gagal menyiapkan default backup Telegram: %v", err)
	}

	// Background scheduler (perlu pushSvc supaya notifikasi otomatis ke ortu
	// (alpha warning + daily digest) juga dapat muncul via Web Push).
	cronScheduler := scheduler.NewScheduler(db, pushSvc)
	cronScheduler.Start()
	defer cronScheduler.Stop()

	// Handlers
	h := &AllHandlers{
		Sync:            handlers.NewSyncHandler(repos.Sync),
		Auth:            handlers.NewAuthHandler(repos.User, repos.AuditLog, repos.PasswordReset, repos.Notification),
		Academic:        handlers.NewAcademicHandler(repos.Academic),
		Inventory:       handlers.NewInventoryHandler(repos.Inventory, repos.Notification),
		SPMB:            handlers.NewSPMBHandler(repos.SPMB, repos.Notification),
		Student:         handlers.NewStudentHandler(repos.Student, db),
		Employee:        handlers.NewEmployeeHandler(repos.Employee),
		Savings:         handlers.NewSavingsHandler(repos.Savings, repos.Notification, parentNotify, repos.AuditLog),
		SavingsGTK:      handlers.NewSavingsGTKHandler(repos.SavingsGTK),
		Library:         handlers.NewLibraryHandler(repos.Library, repos.Notification),
		EOffice:         handlers.NewEOfficeHandler(repos.EOffice, repos.Notification),
		Attendance:      handlers.NewAttendanceHandler(repos.Attendance, parentNotify),
		AttendanceGTK:   handlers.NewAttendanceGTKHandler(repos.AttendanceGTK),
		ScanResolve:     handlers.NewScanResolveHandler(db),
		Loan:            handlers.NewLoanHandler(repos.Loan),
		Setting:         handlers.NewSettingHandler(repos.Setting, repos.AuditLog),
		Alumni:          handlers.NewAlumniHandler(repos.Alumni),
		Mutasi:          handlers.NewMutasiHandler(repos.Mutasi, repos.Library, repos.Savings, repos.Notification),
		Gallery:         handlers.NewGalleryHandler(repos.Gallery),
		Announcement:    handlers.NewAnnouncementHandler(repos.Announcement, repos.Notification, parentNotify),
		AuditLog:        handlers.NewAuditLogHandler(repos.AuditLog),
		Notification:    handlers.NewNotificationHandler(repos.Notification),
		TelegramBackup:  handlers.NewTelegramBackupHandler(repos.TelegramBackup, db),
		User:            handlers.NewUserHandler(repos.User, repos.Student, repos.Employee, repos.AuditLog),
		Dashboard:       handlers.NewDashboardHandler(repos.Dashboard),
		Public:          handlers.NewPublicHandler(repos.Public),
		PublicLibrary:   handlers.NewPublicLibraryHandler(repos.PublicLibrary),
		Booking:         handlers.NewBookingHandler(repos.Booking),
		Computer:        handlers.NewComputerHandler(repos.Computer, repos.Notification, db),
		Finance:         handlers.NewFinanceHandler(repos.Finance, db),
		StickerPreset:   handlers.NewStickerPresetHandler(repos.StickerPreset),
		FAQ:             handlers.NewFAQHandler(repos.FAQ),
		Contact:         handlers.NewContactHandler(repos.Contact, repos.Notification),
		Upload:          handlers.NewUploadHandler(),
		Integration:     handlers.NewIntegrationHandler(repos.Integration),
		Document:        handlers.NewDocumentHandler(repos.Document),
		StudentDocument: handlers.NewStudentDocumentHandler(repos.StudentDocument),
		Push:            handlers.NewPushHandler(pushSvc),
		Parent:          handlers.NewParentHandler(repos.Parent, repos.User, repos.Attendance, repos.Notification, pushSvc, prefsRepo, repos.Mutasi, repos.Savings, repos.Tugas),
		StudentMe:       handlers.NewStudentMeHandler(repos.Student, repos.Attendance, repos.Savings, repos.Announcement, db),
		BankSoal:        handlers.NewBankSoalHandler(repos.BankSoal, repos.ExamAssignment),
		Kurikulum:       handlers.NewKurikulumHandler(repos.Kurikulum),
		Chat:            handlers.NewChatHandler(repos.Chat, repos.Notification, pushSvc, chatHub),
		Skrining:        handlers.NewSkriningHandler(repos.Skrining, repos.Academic, repos.AuditLog, repos.Notification, db),
		Tugas:           handlers.NewTugasHandler(repos.Tugas, repos.Academic, repos.AuditLog, repos.Notification, db),
		File:            handlers.NewFileHandler(),
		DocStation:      handlers.NewDocStationHandler(),
		CloudStorage:    newCloudStorageHandler(repos),
		ReportTemplate:  handlers.NewReportTemplateHandler(repos.ReportTemplate),
		PrintSettings:   handlers.NewPrintSettingsHandler(repos.PrintSettings),
		AIProvider:      handlers.NewAIProviderHandler(repos.AIProvider),
		ThemePreset:     handlers.NewThemePresetHandler(repos.ThemePreset, repos.Setting, repos.AuditLog),
		PDF:             handlers.NewPDFHandler(),
		PushSvc:         pushSvc,
	}

	// Pembersih thumbnail Cloud Storage berkala (harian).
	h.CloudStorage.StartThumbCleaner()

	// EOffice memakai Cloud Storage untuk mengarsipkan hasil scan ke ruang
	// arsip bersama (opsional — lewati bila cloud tak dikonfigurasi).
	h.EOffice.Cloud = h.CloudStorage

	// Register routes
	registerRoutes(server, h, repos)

	h.Attendance.Holiday = repos.Holiday

	// Register static file serving + SPA fallback
	registerStaticRoutes(server)

	// Start server
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

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		server.Logger.Fatal(err)
	}
}
