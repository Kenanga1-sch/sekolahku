package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
)

const csrfCookieName = "csrf_token"
const csrfHeaderName = "X-CSRF-Token"

// allowedOriginSuffixes adalah daftar domain/host yang diperbolehkan
// sebagai asal request (Origin header). Semua trafik publik masuk lewat
// Cloudflare Tunnel dengan host sdn1kenanga.sch.id atau localhost.
var allowedOriginSuffixes = []string{
	"sdn1kenanga.sch.id",
	"localhost",
	"127.0.0.1",
	"100.97.52.50",
}

func generateCSRFToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func SetCSRFCookie(c echo.Context, token string) {
	cookieSecure := os.Getenv("COOKIE_SECURE") != "false"
	cookie := &http.Cookie{
		Name:     csrfCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: false,
		Secure:   cookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
	c.SetCookie(cookie)
}

func GetCSRFToken(c echo.Context) string {
	// Token yang baru dibuat dalam request yang sama tersedia via context.
	if v, ok := c.Get("csrf_token").(string); ok && v != "" {
		return v
	}
	cookie, err := c.Cookie(csrfCookieName)
	if err == nil {
		return cookie.Value
	}
	return ""
}

func EnsureCSRFToken(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		token := GetCSRFToken(c)
		if token == "" {
			generated, err := generateCSRFToken()
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not generate CSRF token"})
			}
			token = generated
			c.Set("csrf_token", token)
			SetCSRFCookie(c, token)
		}
		return next(c)
	}
}

// isAllowedOrigin memeriksa apakah Origin request cocok dengan host aplikasi.
func isAllowedOrigin(c echo.Context) bool {
	origin := c.Request().Header.Get("Origin")
	if origin == "" {
		// Browser always sends Origin for cross-origin POST; a missing Origin
		// usually means same-origin (older clients) or non-browser tools.
		// Fall back to Referer check for defense in depth.
		referer := c.Request().Referer()
		if referer == "" {
			return true
		}
		for _, s := range allowedOriginSuffixes {
			if strings.Contains(referer, s) {
				return true
			}
		}
		return false
	}

	// origin format: scheme://host[:port]
	hostPart := origin
	if idx := strings.Index(origin, "://"); idx >= 0 {
		hostPart = origin[idx+3:]
	}
	if idx := strings.Index(hostPart, "/"); idx >= 0 {
		hostPart = hostPart[:idx]
	}
	if idx := strings.Index(hostPart, ":"); idx >= 0 {
		hostPart = hostPart[:idx]
	}

	for _, s := range allowedOriginSuffixes {
		if strings.EqualFold(hostPart, s) || strings.HasSuffix(strings.ToLower(hostPart), "."+strings.ToLower(s)) {
			return true
		}
	}
	return false
}

// CSRFProtected memberikan pertahanan CSRF berlapis:
//  1. Origin/Referer check untuk semua mutating request /api/* (tanpa mengubah
//     frontend sama sekali).
//  2. Double-submit cookie token untuk endpoint auth-sensitive yang memakai
//     header X-CSRF-Token (logout, ganti password, update profil).
func CSRFProtected() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			path := c.Request().URL.Path

			// Static assets & health check are safe.
			if !strings.HasPrefix(path, "/api/") || path == "/api/health" {
				return next(c)
			}

			method := c.Request().Method
			if method == "GET" || method == "HEAD" || method == "OPTIONS" {
				return next(c)
			}

			// Layer 1: Origin/Referer check (global, non-breaking).
			if !isAllowedOrigin(c) {
				return c.JSON(http.StatusForbidden, map[string]string{"error": "Request origin tidak diizinkan"})
			}

			// Layer 2: Double-submit token untuk endpoint auth-sensitive.
			if isAuthSensitivePath(path) {
				cookieToken := GetCSRFToken(c)
				headerToken := c.Request().Header.Get(csrfHeaderName)
				if cookieToken == "" || headerToken == "" || cookieToken != headerToken {
					return c.JSON(http.StatusForbidden, map[string]string{"error": "CSRF token missing or invalid"})
				}
			}

			return next(c)
		}
	}
}

func isAuthSensitivePath(path string) bool {
	authSensitive := []string{
		"/api/auth/logout",
		"/api/profile",
		"/api/auth/change-password",
		"/api/users/change-password",
	}
	for _, p := range authSensitive {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}
