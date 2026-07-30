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
	authMiddleware "github.com/sekolahku/go-backend/internal/middleware"
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

func main() {
	loadEnv()
	startTime := time.Now()
	server := echo.New()

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
	server.Use(middleware.BodyLimit("10M"))
	server.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 5,
	}))
	server.Use(authMiddleware.SecurityHeaders)

	// HTTPS redirect in production
	if os.Getenv("ENV") == "production" && os.Getenv("TRUST_PROXY") != "true" {
		server.Use(middleware.HTTPSRedirect())
	}
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
	db := initDatabase(server)
	defer db.Close()

	// Background scheduler
	cronScheduler := scheduler.NewScheduler(db)
	cronScheduler.Start()
	defer cronScheduler.Stop()

	// Repositories
	repos := &Repositories{
		User:           repository.NewUserRepository(db),
		Academic:       repository.NewAcademicRepository(db),
		Inventory:      repository.NewInventoryRepository(db),
		SPMB:           repository.NewSPMBRepository(db),
		Student:        repository.NewStudentRepository(db),
		Employee:       repository.NewEmployeeRepository(db),
		Savings:        repository.NewSavingsRepository(db),
		Library:        repository.NewLibraryRepository(db),
		EOffice:        repository.NewEOfficeRepository(db),
		AcademicAdv:    repository.NewAcademicAdvRepository(db),
		Attendance:     repository.NewAttendanceRepository(db),
		Loan:           repository.NewLoanRepository(db),
		Setting:        repository.NewSettingRepository(db),
		Alumni:         repository.NewAlumniRepository(db),
		Mutasi:         repository.NewMutasiRepository(db),
		Gallery:        repository.NewGalleryRepository(db),
		StaffProfile:   repository.NewStaffProfileRepository(db),
		Announcement:   repository.NewAnnouncementRepository(db),
		AuditLog:       repository.NewAuditLogRepository(db),
		Notification:   repository.NewNotificationRepository(db),
		TelegramBackup: repository.NewTelegramBackupRepository(db),
		Dashboard:      repository.NewDashboardRepository(db, startTime),
		Public:         repository.NewPublicRepository(db),
		FAQ:            repository.NewFAQRepository(db),
		Contact:        repository.NewContactRepository(db),
		Sync:           repository.NewSyncRepository(db),
		Integration:    repository.NewIntegrationRepository(db),
		Document:       repository.NewDocumentRepository(db),
	}

	// Auto sync students on startup
	log.Println("[Startup] Running initial synchronization of active students...")
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

	// Handlers
	h := &AllHandlers{
		Sync:           handlers.NewSyncHandler(repos.Sync),
		Auth:           handlers.NewAuthHandler(repos.User, repos.AuditLog),
		Academic:       handlers.NewAcademicHandler(repos.Academic),
		Inventory:      handlers.NewInventoryHandler(repos.Inventory),
		SPMB:           handlers.NewSPMBHandler(repos.SPMB),
		Student:        handlers.NewStudentHandler(repos.Student),
		Employee:       handlers.NewEmployeeHandler(repos.Employee),
		Savings:        handlers.NewSavingsHandler(repos.Savings),
		Library:        handlers.NewLibraryHandler(repos.Library),
		EOffice:        handlers.NewEOfficeHandler(repos.EOffice),
		AcademicAdv:    handlers.NewAcademicAdvHandler(repos.AcademicAdv),
		Attendance:     handlers.NewAttendanceHandler(repos.Attendance),
		Loan:           handlers.NewLoanHandler(repos.Loan),
		Setting:        handlers.NewSettingHandler(repos.Setting, repos.AuditLog),
		Alumni:         handlers.NewAlumniHandler(repos.Alumni),
		Mutasi:         handlers.NewMutasiHandler(repos.Mutasi, repos.Library, repos.Savings),
		Gallery:        handlers.NewGalleryHandler(repos.Gallery),
		StaffProfile:   handlers.NewStaffProfileHandler(repos.StaffProfile),
		Announcement:   handlers.NewAnnouncementHandler(repos.Announcement),
		AuditLog:       handlers.NewAuditLogHandler(repos.AuditLog),
		Notification:   handlers.NewNotificationHandler(repos.Notification),
		TelegramBackup: handlers.NewTelegramBackupHandler(repos.TelegramBackup),
		User:           handlers.NewUserHandler(repos.User, repos.Student, repos.Employee, repos.AuditLog),
		Dashboard:      handlers.NewDashboardHandler(repos.Dashboard),
		Public:         handlers.NewPublicHandler(repos.Public),
		FAQ:            handlers.NewFAQHandler(repos.FAQ),
		Contact:        handlers.NewContactHandler(repos.Contact),
		Upload:         handlers.NewUploadHandler(),
		Integration:    handlers.NewIntegrationHandler(repos.Integration),
		Document:       handlers.NewDocumentHandler(repos.Document),
	}

	// Register routes
	registerRoutes(server, h, repos)

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