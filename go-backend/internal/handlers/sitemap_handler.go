package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

// SitemapHandler menyajikan sitemap XML dinamis untuk konten dari database
// (berita), melengkapi sitemap.xml statis yang dihasilkan Next.js.
type SitemapHandler struct {
	Announcements *repository.AnnouncementRepository
}

func NewSitemapHandler(announcements *repository.AnnouncementRepository) *SitemapHandler {
	return &SitemapHandler{Announcements: announcements}
}

// publicBaseURL mengembalikan basis URL absolut untuk sitemap.
// Tanpa ini Google menolak URL relatif di sitemap.
func publicBaseURL() string {
	if u := os.Getenv("PUBLIC_BASE_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	// Fallback domain produksi — situs ini single-tenant.
	return "https://sdn1kenanga.sch.id"
}

// News menghasilkan /sitemap-news.xml berisi seluruh berita terpublikasi.
// Sitemap ini dinamis: berita baru langsung tersedia tanpa rebuild frontend.
func (h *SitemapHandler) News(c echo.Context) error {
	base := publicBaseURL()

	slugs, err := h.Announcements.GetPublishedSlugs(1000)
	if err != nil {
		c.Logger().Errorf("sitemap-news: gagal query berita: %v", err)
		// Sitemap kosong tetap valid — jangan membuat crawler error.
		slugs = nil
	}

	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	b.WriteString(fmt.Sprintf("<url><loc>%s/berita</loc><changefreq>daily</changefreq><priority>0.8</priority></url>", base))

	for _, s := range slugs {
		lastMod := time.UnixMilli(s.UpdatedAt).UTC().Format("2006-01-02")
		if s.PublishedAt > s.UpdatedAt {
			lastMod = time.UnixMilli(s.PublishedAt).UTC().Format("2006-01-02")
		}
		b.WriteString(fmt.Sprintf(
			"<url><loc>%s/berita/detail?slug=%s</loc><lastmod>%s</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>",
			base, s.Slug, lastMod,
		))
	}

	b.WriteString(`</urlset>`)

	c.Response().Header().Set(echo.HeaderContentType, "application/xml")
	// Sitemap boleh di-cache sebentar; berita jarang berubah per menit.
	c.Response().Header().Set(echo.HeaderCacheControl, "public, max-age=3600")
	return c.String(http.StatusOK, b.String())
}
