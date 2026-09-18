package middleware

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

var jwtSecret []byte

// userLookup dipakai untuk memverifikasi bahwa user pemilik token masih aktif.
// Diisi lewat InitJWTUserLookup pada saat startup; bila kosong, pemeriksaan
// status user dilewati (misalnya pada tes unit).
var userLookup *repository.UserRepository

// InitJWTUserLookup mengaktifkan pemeriksaan status user pada setiap request
// terautentikasi. Tanpa ini, JWT yang sudah diterbitkan tetap berlaku sampai
// kedaluwarsa meski akunnya sudah dinonaktifkan.
func InitJWTUserLookup(repo *repository.UserRepository) {
	userLookup = repo
}

const (
	RoleSuperadmin = "superadmin"
	RoleAdmin      = "admin"
	RoleStaff      = "staff"
	RoleGuru       = "guru"
	RoleBendahara  = "bendahara"
	RoleSiswa      = "siswa"
	RoleUser       = "user"
	RoleOrangtua   = "orangtua"
)

func InitJWTMiddleware() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		panic("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. Please set JWT_SECRET in production.")
	}
	jwtSecret = []byte(secret)
}

func RoleMiddleware(allowedRoles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			role, ok := c.Get("user_role").(string)
			if !ok || role == "" {
				return c.JSON(http.StatusForbidden, map[string]string{"error": "Access denied: no role found"})
			}
			for _, allowed := range allowedRoles {
				if role == allowed {
					return next(c)
				}
			}
			return c.JSON(http.StatusForbidden, map[string]string{"error": "Access denied: insufficient role"})
		}
	}
}

func SecurityHeaders(next echo.HandlerFunc) echo.HandlerFunc {
	isProd := os.Getenv("ENV") == "production"

	return func(c echo.Context) error {
		h := c.Response().Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		// X-XSS-Protection sudah dihapus dari browser modern; nilai "1" justru
		// dapat membuka celah pada konten yang disaring agresif. Standar baru
		// adalah mematikannya dan mengandalkan CSP.
		h.Set("X-XSS-Protection", "0")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(self), payment=()")

		// HSTS hanya masuk akal saat trafik benar-benar lewat HTTPS.
		if isProd {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		return next(c)
	}
}

func JWTMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		path := c.Request().URL.Path

		// Whitelist public paths
		publicPaths := []string{
			"/api/auth/login",
		"/api/health",
		}

		isPublic := false
		for _, p := range publicPaths {
			if path == p {
				isPublic = true
				break
			}
		}

		if isPublic || strings.HasPrefix(path, "/api/public/") {
			return next(c)
		}

		tokenString := ""
		authHeader := c.Request().Header.Get("Authorization")

		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}

		// Fallback to cookie if header is missing or invalid
		if tokenString == "" {
			cookie, err := c.Cookie("session")
			if err == nil {
				tokenString = cookie.Value
			}
		}

		if tokenString == "" {
			c.Logger().Errorf("AUTH ERROR: Missing Authorization header or session cookie for path: %s", path)
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Missing authorization header or session cookie"})
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil {
			c.Logger().Errorf("AUTH ERROR: Token parsing failed for path %s: %v", path, err)
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token: " + err.Error()})
		}

		if !token.Valid {
			c.Logger().Errorf("AUTH ERROR: Token is invalid for path %s", path)
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Token is not valid"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token claims"})
		}

		// Inject into context
		c.Set("user_id", claims["sub"])
		c.Set("userId", claims["sub"])
		c.Set("user_email", claims["email"])
		c.Set("user_role", claims["role"])
		c.Set("user_name", claims["name"])

		// Klaim imp (impersonated-by) hanya ada pada sesi hasil admin switch.
		// Dipakai endpoint /api/auth/return untuk kembali ke akun admin asal.
		if imp, ok := claims["imp"].(string); ok && imp != "" {
			c.Set("imp", imp)
		}

		// Pastikan akun pemilik token masih aktif. JWT berlaku 7 hari, jadi
		// tanpa pemeriksaan ini user yang dinonaktifkan tetap bisa memakai
		// token lamanya selama berminggu-minggu.
		if userLookup != nil {
			if id, ok := claims["sub"].(string); ok && id != "" {
				user, err := userLookup.GetUserByID(id)
				if err != nil && err != sql.ErrNoRows {
					c.Logger().Errorf("AUTH ERROR: gagal memeriksa status user %s: %v", id, err)
				}
				// ErrNoRows → user sudah dihapus: tolak akses.
				if err == sql.ErrNoRows || user == nil || !user.IsActive {
					return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun tidak aktif atau sudah dihapus"})
				}
			}
		}

		return next(c)
	}
}
