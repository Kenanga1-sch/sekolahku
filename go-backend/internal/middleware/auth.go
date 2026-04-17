package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

func JWTMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		path := c.Path()
		
		// Whitelist public paths
		publicPaths := []string{
			"/api/auth/login",
			"/api/school-settings",
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

		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "default_secret_for_development_only"
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.Logger().Errorf("AUTH ERROR: Invalid or expired token: %v", err)
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid or expired token"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token claims"})
		}

		// Inject into context
		c.Set("user_id", claims["sub"])
		c.Set("user_email", claims["email"])
		c.Set("user_role", claims["role"])

		return next(c)
	}
}
