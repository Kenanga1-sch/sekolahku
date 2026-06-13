package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

var jwtSecret []byte

const (
	RoleSuperadmin = "superadmin"
	RoleAdmin      = "admin"
	RoleStaff      = "staff"
	RoleGuru       = "guru"
	RoleBendahara  = "bendahara"
	RoleUser       = "user"
)

func InitJWTMiddleware() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "sekolahku-dev-secret-key-12345"
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
	return func(c echo.Context) error {
		c.Response().Header().Set("X-Content-Type-Options", "nosniff")
		c.Response().Header().Set("X-Frame-Options", "DENY")
		c.Response().Header().Set("X-XSS-Protection", "1; mode=block")
		c.Response().Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
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

		return next(c)
	}
}
