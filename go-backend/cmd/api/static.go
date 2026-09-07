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

	"github.com/labstack/echo/v4"
)

//go:embed all:dist
var frontendFiles embed.FS

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
			c.Response().Header().Set(echo.HeaderCacheControl, "public, max-age=86400")
			return c.File(fullPath)
		}
	}

	return c.NoContent(http.StatusNotFound)
}

// registerStaticRoutes sets up static file serving and SPA fallback.
func registerStaticRoutes(server *echo.Echo) {
	publicUploadPath := resolvePublicUploadsDir()
	legacyUploadPath := filepath.Join("uploads")
	subDirs := []string{"announcements", "spmb", "profiles", "gallery", "alumni", "staff", "library", "arsip", "inventory"}
	for _, d := range subDirs {
		_ = os.MkdirAll(filepath.Join(publicUploadPath, d), 0755)
		_ = os.MkdirAll(filepath.Join(legacyUploadPath, d), 0755)
	}
	server.GET("/uploads/*", func(c echo.Context) error {
		return serveUploadFile(c, []string{publicUploadPath, legacyUploadPath})
	})

	frontendFS := getFrontendFS()

	// Direct asset routes
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
				return serveEmbeddedFile(c, frontendFS, "index.html")
			}

			// Try to serve the exact file if it exists
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

			// Fallback to index.html for SPA client-side routing
			if strings.HasPrefix(cleanPath, "__next") || c.QueryParam("_rsc") != "" {
				return serveEmbeddedFile(c, frontendFS, "index.html")
			}

			if !strings.Contains(cleanPath, ".") && !strings.HasPrefix(cleanPath, "_next/") {
				return serveEmbeddedFile(c, frontendFS, "index.html")
			}

			return next(c)
		}
	})
}