package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

func TestSecurityHeaders(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	handler := SecurityHeaders(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	if err := handler(ctx); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}

	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("expected X-Content-Type-Options: nosniff, got %s", rec.Header().Get("X-Content-Type-Options"))
	}
	if rec.Header().Get("X-Frame-Options") != "DENY" {
		t.Errorf("expected X-Frame-Options: DENY, got %s", rec.Header().Get("X-Frame-Options"))
	}
	if rec.Header().Get("X-XSS-Protection") != "1; mode=block" {
		t.Errorf("expected X-XSS-Protection header, got %s", rec.Header().Get("X-XSS-Protection"))
	}
	if rec.Header().Get("Referrer-Policy") != "strict-origin-when-cross-origin" {
		t.Errorf("expected Referrer-Policy header, got %s", rec.Header().Get("Referrer-Policy"))
	}
}

func TestRoleMiddlewareAllowsCorrectRole(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	ctx.Set("user_role", "admin")

	handler := RoleMiddleware(RoleSuperadmin, RoleAdmin)(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	if err := handler(ctx); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for allowed role, got %d", rec.Code)
	}
}

func TestRoleMiddlewareDeniesWrongRole(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	ctx.Set("user_role", "user")

	handler := RoleMiddleware(RoleSuperadmin, RoleAdmin)(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	err := handler(ctx)
	if err != nil {
		t.Fatalf("handler returned unexpected error: %v", err)
	}
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 for wrong role, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRoleMiddlewareDeniesNoRole(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	handler := RoleMiddleware(RoleAdmin)(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	err := handler(ctx)
	if err != nil {
		t.Fatalf("handler returned unexpected error: %v", err)
	}
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 for missing role, got %d", rec.Code)
	}
}

func TestJWTMiddlewareValidToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-12345")
	InitJWTMiddleware()
	defer os.Unsetenv("JWT_SECRET")

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   "user-1",
		"email": "test@test.com",
		"role":  "admin",
		"name":  "Test User",
	})
	tokenString, _ := token.SignedString(jwtSecret)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	handler := JWTMiddleware(func(c echo.Context) error {
		uid := c.Get("user_id")
		role := c.Get("user_role")
		if uid != "user-1" || role != "admin" {
			t.Errorf("expected user_id=user-1, role=admin, got user_id=%v, role=%v", uid, role)
		}
		return c.String(http.StatusOK, "ok")
	})

	if err := handler(ctx); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestJWTMiddlewareMissingToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-12345")
	InitJWTMiddleware()
	defer os.Unsetenv("JWT_SECRET")

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/protected", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	handler := JWTMiddleware(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	err := handler(ctx)
	if err != nil {
		t.Fatalf("handler returned unexpected error: %v", err)
	}
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing token, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestJWTMiddlewarePublicPathBypass(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-12345")
	InitJWTMiddleware()
	defer os.Unsetenv("JWT_SECRET")

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	handler := JWTMiddleware(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	if err := handler(ctx); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for public path, got %d", rec.Code)
	}
}

func TestJWTMiddlewareInvalidToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-12345")
	InitJWTMiddleware()
	defer os.Unsetenv("JWT_SECRET")

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/protected", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	handler := JWTMiddleware(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	err := handler(ctx)
	if err != nil {
		t.Fatalf("handler returned unexpected error: %v", err)
	}
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid token, got %d: %s", rec.Code, rec.Body.String())
	}
}
