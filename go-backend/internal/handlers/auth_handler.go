package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AuthHandler struct {
	Repo      *repository.UserRepository
	AuditRepo *repository.AuditLogRepository
}

func NewAuthHandler(repo *repository.UserRepository, auditRepo *repository.AuditLogRepository) *AuthHandler {
	return &AuthHandler{
		Repo:      repo,
		AuditRepo: auditRepo,
	}
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request payload"})
	}

	user, err := h.Repo.GetUserByEmail(req.Email)
	if err != nil {
		c.Logger().Errorf("login database error for %s: %v", req.Email, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan sistem"})
	}

	if user == nil || user.PasswordHash == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Username/email atau password salah."})
	}

	err = bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password))
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Username/email atau password salah."})
	}

	// Generate JWT
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "sekolahku-dev-secret-key-12345"
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"name":  user.Name,
		"exp":   time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days expiration
	})

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		c.Logger().Error("Error signing JWT:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not generate token"})
	}

	// Set session cookie for backend security (HttpOnly) - Session-only cookie
	sessionCookie := new(http.Cookie)
	sessionCookie.Name = "session"
	sessionCookie.Value = tokenString
	sessionCookie.Path = "/"
	sessionCookie.HttpOnly = true
	sessionCookie.Secure = c.Request().TLS != nil
	sessionCookie.SameSite = http.SameSiteStrictMode
	c.SetCookie(sessionCookie)

	// Extract name safely
	userName := ""
	if user.Name != nil {
		userName = *user.Name
	}
	// Set a public user info cookie for frontend display (Non-HttpOnly)
	// This contains non-sensitive info only.
	userInfo := map[string]string{
		"id":   user.ID,
		"name": userName,
		"role": user.Role,
	}
	userInfoJSON, err := json.Marshal(userInfo)
	if err != nil {
		c.Logger().Error("Error encoding user info:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not encode user info"})
	}

	infoCookie := new(http.Cookie)
	infoCookie.Name = "user_info"
	infoCookie.Value = url.QueryEscape(string(userInfoJSON))
	infoCookie.Path = "/"
	infoCookie.HttpOnly = false
	infoCookie.SameSite = http.SameSiteLaxMode
	c.SetCookie(infoCookie)

	// Record Audit Log
	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := "User logged in successfully"
	h.AuditRepo.CreateLog(models.AuditLog{
		Action:    "login",
		Resource:  "user",
		UserID:    &user.ID,
		UserName:  user.Name,
		UserEmail: &user.Email,
		IPAddress: &ip,
		UserAgent: &ua,
		Details:   &details,
	})

	// Return token and user object
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":             true,
		"token":               tokenString,
		"user":                user,
		"public_info":         userInfo,
		"mustChangePassword":  user.MustChangePassword,
	})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	// Clear session cookie
	c.SetCookie(&http.Cookie{
		Name:     "session",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		Path:     "/",
		HttpOnly: true,
	})
	// Clear info cookie
	c.SetCookie(&http.Cookie{
		Name:     "user_info",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		Path:     "/",
		HttpOnly: false,
	})

	return c.JSON(http.StatusOK, map[string]string{"message": "Logged out successfully"})
}
