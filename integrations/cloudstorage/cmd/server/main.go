package main

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"flag"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"

	"cloudstorage/internal/config"
	"cloudstorage/internal/handler"
	"cloudstorage/internal/repository"
	"cloudstorage/internal/service"
	"cloudstorage/web"
)

func main() {
	backupPath := flag.String("backup", "", "buat backup database ke path ini lalu keluar")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	cfg := config.Load()
	if cfg.TelegramToken == "" {
		log.Println("WARNING: TELEGRAM_TOKEN kosong - fitur upload tidak akan berfungsi")
	}
	if cfg.TelegramChatID == "" {
		log.Println("WARNING: TELEGRAM_CHAT_ID kosong - fitur upload tidak akan berfungsi")
	}
	db := repository.InitDB(cfg.DBPath)

	if *backupPath != "" {
		if err := backupDatabase(db, *backupPath); err != nil {
			log.Fatalf("backup gagal: %v", err)
		}
		log.Printf("Backup tersimpan ke %s", *backupPath)
		return
	}

	app := buildApp(cfg, db)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stop
		log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = app.ShutdownWithContext(ctx)
	}()

	addr := cfg.Host + ":" + cfg.Port
	log.Printf("Server running on http://localhost:%s", cfg.Port)
	log.Fatal(app.Listen(addr))
}

// backupDatabase membuat snapshot database yang konsisten menggunakan
// VACUUM INTO (menggabungkan data WAL, kompak, aman untuk di-copy).
func backupDatabase(db *sql.DB, dest string) error {
	quoted := "'" + strings.ReplaceAll(dest, "'", "''") + "'"
	_, err := db.Exec("VACUUM INTO " + quoted)
	return err
}

func buildApp(cfg *config.Config, db *sql.DB) *fiber.App {
	repo := repository.NewRepository(db)
	svc := service.NewService(repo, cfg)
	h := handler.NewHandler(svc)

	if cfg.ThumbCacheDir != "" {
		go func() {
			_ = svc.CleanThumbCache()
			if cfg.ThumbCleanHours <= 0 {
				return
			}
			ticker := time.NewTicker(time.Duration(cfg.ThumbCleanHours) * time.Hour)
			defer ticker.Stop()
			for range ticker.C {
				_ = svc.CleanThumbCache()
			}
		}()
	}

	app := fiber.New(fiber.Config{
		BodyLimit: int(cfg.MaxUploadSize + 1*1024*1024),
	})
	app.Use(recover.New())
	app.Use(cors.New(corsConfig(cfg)))
	app.Use(csrfMiddleware(cfg))
	if cfg.AuthToken != "" {
		app.Use(authMiddleware(cfg))
	}

	subFS, err := fs.Sub(web.StaticFS, "static")
	if err != nil {
		log.Fatalf("failed to create static sub fs: %v", err)
	}

	api := app.Group("/api")
	api.Get("/config", h.GetConfig)
	api.Post("/login", loginHandler(cfg, newRateLimiter(time.Minute, 10)))
	api.Get("/files", h.ListFiles)
	api.Post("/files", h.UploadFile)
	api.Post("/folders", h.CreateFolder)
	api.Get("/folders/all", h.ListAllFolders)
	api.Get("/files/:id", h.GetFile)
	api.Get("/files/:id/download", h.DownloadFile)
	api.Get("/files/:id/thumb", h.Thumbnail)
	api.Put("/files/:id", h.RenameFile)
	api.Delete("/files/:id", h.DeleteFile)
	api.Post("/files/:id/share", h.CreateShareLink)
	api.Delete("/files/:id/share", h.RevokeShare)
	api.Post("/files/copy", h.CopyFiles)
	api.Post("/files/move", h.MoveFiles)
	api.Get("/search", h.Search)
	api.Get("/trash", h.ListTrash)
	api.Post("/trash/restore-all", h.RestoreAll)
	api.Post("/trash/:id/restore", h.RestoreFile)
	api.Delete("/trash", h.EmptyTrash)
	api.Delete("/trash/:id", h.PermanentDelete)

	api.Get("/healthz", h.HealthCheck)
	app.Get("/s/:token/download", h.DownloadSharedFile)
	app.Get("/login", loginPage)

	app.Get("/*", func(c *fiber.Ctx) error {
		path := strings.TrimPrefix(c.Path(), "/")
		if path == "" {
			path = "index.html"
		}

		data, err := fs.ReadFile(subFS, path)
		if err != nil {
			return c.Status(http.StatusNotFound).SendString("Not Found")
		}

		contentType := mime.TypeByExtension(filepath.Ext(path))
		if contentType != "" {
			c.Set("Content-Type", contentType)
		}
		if path == "index.html" || filepath.Ext(path) == ".js" || filepath.Ext(path) == ".css" {
			c.Set("Cache-Control", "no-cache")
		} else {
			c.Set("Cache-Control", "public, max-age=3600")
		}
		return c.Send(data)
	})

	return app
}

func corsConfig(cfg *config.Config) cors.Config {
	if cfg.AllowedOrigins == "" {
		return cors.ConfigDefault
	}
	return cors.Config{
		AllowOrigins: cfg.AllowedOrigins,
		AllowMethods: strings.Join([]string{
			http.MethodGet, http.MethodPost, http.MethodPut,
			http.MethodDelete, http.MethodOptions,
		}, ","),
		AllowHeaders: "Origin, Content-Type, Authorization",
	}
}

// csrfMiddleware menolak request stateful (non-GET) pada /api yang membawa
// header Origin dari sumber yang tidak diizinkan (cross-origin). Ini mencegah
// serangan CSRF terhadap sesi cookie. Klien non-browser yang tidak mengirim
// Origin tetap diperbolehkan.
func csrfMiddleware(cfg *config.Config) fiber.Handler {
	allowed := []string{}
	for _, o := range strings.Split(cfg.AllowedOrigins, ",") {
		o = strings.TrimSpace(strings.TrimRight(o, "/"))
		if o != "" {
			allowed = append(allowed, o)
		}
	}
	return func(c *fiber.Ctx) error {
		switch c.Method() {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			return c.Next()
		}
		if !strings.HasPrefix(c.Path(), "/api/") {
			return c.Next()
		}
		origin := strings.TrimRight(c.Get("Origin"), "/")
		if origin == "" {
			return c.Next()
		}
		host := c.Hostname()
		if origin == "http://"+host || origin == "https://"+host {
			return c.Next()
		}
		for _, o := range allowed {
			if o == origin {
				return c.Next()
			}
		}
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "origin tidak diizinkan"})
	}
}

func authMiddleware(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		path := c.Path()
		if strings.HasPrefix(path, "/s/") || path == "/login" || path == "/api/login" {
			return c.Next()
		}

		token := ""
		if ah := c.Get("Authorization"); strings.HasPrefix(ah, "Bearer ") {
			token = strings.TrimPrefix(ah, "Bearer ")
		}
		if token == "" {
			token = c.Cookies("token")
		}

		if token != "" && subtle.ConstantTimeCompare([]byte(token), []byte(cfg.AuthToken)) == 1 {
			return c.Next()
		}

		if strings.HasPrefix(path, "/api/") {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		return c.Redirect("/login", http.StatusFound)
	}
}

type rateLimiter struct {
	mu     sync.Mutex
	window time.Duration
	max    int
	hits   map[string][]time.Time
}

func newRateLimiter(window time.Duration, max int) *rateLimiter {
	return &rateLimiter{window: window, max: max, hits: make(map[string][]time.Time)}
}

func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	cutoff := now.Add(-l.window)
	recent := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	l.hits[key] = recent
	if len(recent) >= l.max {
		return false
	}
	l.hits[key] = append(l.hits[key], now)
	return true
}

func loginHandler(cfg *config.Config, limiter *rateLimiter) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !limiter.allow(c.IP()) {
			return c.Status(http.StatusTooManyRequests).JSON(fiber.Map{"error": "terlalu banyak percobaan, coba lagi nanti"})
		}
		var req struct {
			Token string `json:"token"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
		}
		if cfg.AuthToken != "" && subtle.ConstantTimeCompare([]byte(req.Token), []byte(cfg.AuthToken)) == 1 {
			return c.JSON(fiber.Map{"ok": true})
		}
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "token salah"})
	}
}

func loginPage(c *fiber.Ctx) error {
	html := `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Masuk - Cloud Storage</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8f9fa; margin: 0; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 360px; }
    h2 { margin: 16px 0 8px; color: #202124; font-size: 20px; }
    p { color: #5f6368; font-size: 14px; margin-bottom: 20px; }
    input { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px; margin-bottom: 16px; }
    button { width: 100%; background: #1a73e8; color: white; border: none; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; }
    button:hover { background: #1557b0; }
    .error { color: #d93025; font-size: 13px; margin-bottom: 12px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="#1a73e8"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
    <h2>Masuk ke Cloud Storage</h2>
    <p>Masukkan token akses yang sudah dikonfigurasi.</p>
    <div class="error" id="err"></div>
    <input type="password" id="token" placeholder="Token akses" autocomplete="current-password" />
    <button id="btn">Masuk</button>
  </div>
  <script>
    function save(token) {
      localStorage.setItem('token', token);
      document.cookie = 'token=' + encodeURIComponent(token) + '; path=/; SameSite=Lax';
    }
    function showError(msg) {
      var err = document.getElementById('err');
      err.textContent = msg;
      err.style.display = 'block';
    }
    function submit() {
      var t = document.getElementById('token').value.trim();
      var err = document.getElementById('err');
      err.style.display = 'none';
      if (!t) { showError('Token tidak boleh kosong'); return; }
      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t })
      }).then(function (res) {
        if (res.ok) {
          save(t);
          location.href = '/';
          return;
        }
        return res.json().then(function (d) {
          showError((d && d.error) || 'Token salah');
        }).catch(function () {
          showError('Token salah');
        });
      }).catch(function () {
        showError('Gagal menghubungi server');
      });
    }
    document.getElementById('btn').addEventListener('click', submit);
    document.getElementById('token').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });
    document.getElementById('token').focus();
  </script>
</body>
</html>`

	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.SendString(html)
}
