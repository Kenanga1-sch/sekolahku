package main

import (
	"bytes"
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/handlers"
)

//go:embed all:dist
var frontendFiles embed.FS

var (
	embedFS http.FileSystem // fallback: files compiled ke dalam binary
	diskFS  http.FileSystem // hot-swap: files dari volume mount /app/dist
)

func initFrontendFS() {
	fsys, err := fs.Sub(frontendFiles, "dist")
	if err != nil {
		log.Fatal(err)
	}
	embedFS = http.FS(fsys)

	// Coba buka /app/dist/ sebagai disk fallback (volume mount).
	for _, candidate := range []string{"/app/dist", "../dist", "dist"} {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			diskFS = http.Dir(candidate)
			log.Printf("[static] disk frontend: %s", candidate)
			return
		}
	}
	// Tidak ada disk → embed saja (backward compatible, single-binary).
}

// serveFrontendFile mencoba serve dari disk dulu, lalu fallback ke embed.
// Ini memungkinkan hot-swap frontend tanpa rebuild binary.
func serveFrontendFile(c echo.Context, name string) error {
	// 1. Coba disk (volume mount) — file terbaru.
	if diskFS != nil {
		f, err := diskFS.Open(name)
		if err == nil {
			defer f.Close()
			d, err := f.Stat()
			if err == nil && !d.IsDir() {
				data, err := io.ReadAll(f)
				if err == nil {
					setCacheHeaders(c, name, d.ModTime(), data)
					return nil
				}
			}
		}
	}

	// 2. Fallback ke embed (compiled dalam binary).
	return serveEmbeddedFile(c, embedFS, name)
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

// diskFileExists mengecek file di disk (volume mount) saja.
func diskFileExists(name string) bool {
	if diskFS == nil {
		return false
	}
	f, err := diskFS.Open(name)
	if err != nil {
		return false
	}
	defer f.Close()
	d, err := f.Stat()
	return err == nil && !d.IsDir()
}

func setCacheHeaders(c echo.Context, name string, modTime time.Time, data []byte) {
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
		cacheControl = "no-cache, no-store, must-revalidate, max-age=0"
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
		cacheControl = "public, max-age=3600"
	case ".ico":
		contentType = "image/x-icon"
	}
	c.Response().Header().Set(echo.HeaderContentType, contentType)
	c.Response().Header().Set(echo.HeaderCacheControl, cacheControl)

	http.ServeContent(c.Response(), c.Request(), name, modTime, seeker)
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

	data, err := io.ReadAll(f)
	if err != nil {
		return c.NoContent(http.StatusInternalServerError)
	}

	setCacheHeaders(c, name, d.ModTime(), data)
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

	// Folder privat tidak disajikan di route anonim ini; lihat FileHandler.
	if !handlers.IsPublicUploadPath(relPath) {
		return c.NoContent(http.StatusNotFound)
	}

	for _, root := range roots {
		fullPath := filepath.Join(root, relPath)
		info, err := os.Stat(fullPath)
		if err == nil && !info.IsDir() {
			c.Response().Header().Set(echo.HeaderCacheControl, "public, max-age=86400")
			return c.File(fullPath)
		}
	}

	return c.NoContent(http.StatusNotFound)
}

// registerStaticRoutes sets up static file serving and SPA fallback.
func registerStaticRoutes(server *echo.Echo) {
	initFrontendFS()

	publicUploadPath := resolvePublicUploadsDir()
	legacyUploadPath := filepath.Join("uploads")
	subDirs := []string{"announcements", "spmb", "profiles", "gallery", "alumni", "staff", "library", "arsip", "inventory", "templates"}
	for _, d := range subDirs {
		_ = os.MkdirAll(filepath.Join(publicUploadPath, d), 0755)
		_ = os.MkdirAll(filepath.Join(legacyUploadPath, d), 0755)
	}
	server.GET("/uploads/*", func(c echo.Context) error {
		return serveUploadFile(c, []string{publicUploadPath, legacyUploadPath})
	})

	// Direct asset routes — serveFrontendFile tries disk first, then embed.
	server.GET("/_next/*", func(c echo.Context) error {
		p := strings.TrimPrefix(c.Request().URL.Path, "/")
		return serveFrontendFile(c, p)
	})
	server.GET("/images/*", func(c echo.Context) error {
		p := strings.TrimPrefix(c.Request().URL.Path, "/")
		return serveFrontendFile(c, p)
	})
	server.GET("/favicon.ico", func(c echo.Context) error { return serveFrontendFile(c, "favicon.ico") })
	server.GET("/manifest.json", func(c echo.Context) error { return serveFrontendFile(c, "manifest.json") })
	server.GET("/logo.png", func(c echo.Context) error { return serveFrontendFile(c, "logo.png") })
	server.GET("/sw.js", func(c echo.Context) error { return serveFrontendFile(c, "sw.js") })

	// SPA fallback
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
				return serveFrontendFile(c, "index.html")
			}

			// Try to serve the exact file if it exists (disk or embed)
			if diskFileExists(cleanPath) || fileExists(embedFS, cleanPath) {
				return serveFrontendFile(c, cleanPath)
			}

			// Try adding .html (Next.js static export pattern)
			if !strings.Contains(cleanPath, ".") {
				altPath := cleanPath + ".html"
				if diskFileExists(altPath) || fileExists(embedFS, altPath) {
					return serveFrontendFile(c, altPath)
				}
			}

			// Fallback to index.html for SPA client-side routing
			if strings.HasPrefix(cleanPath, "__next") || c.QueryParam("_rsc") != "" {
				return serveFrontendFile(c, "index.html")
			}

			// Path tanpa ekstensi yang tidak cocok file/konten manapun:
			// tampilkan halaman 404 (bukan index.html — selama ini URL lama
			// yang sudah dihapus malah menampilkan Beranda).
			if !strings.Contains(cleanPath, ".") && !strings.HasPrefix(cleanPath, "_next/") {
				if diskFileExists("404.html") || fileExists(embedFS, "404.html") {
					return serveFrontendFile(c, "404.html")
				}
				return serveFrontendFile(c, "index.html")
			}

			return next(c)
		}
	})
}