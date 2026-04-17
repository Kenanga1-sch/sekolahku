package handlers

import (
	"net/http"
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

	// Fetch user directly from sqlite via repository
	user, err := h.Repo.GetUserByEmail(req.Email)
	if err != nil {
		c.Logger().Errorf("LOGIN DEBUG: Database error for %s: %v", req.Email, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error: " + err.Error()})
	}

	if user == nil || user.PasswordHash == nil {
		c.Logger().Errorf("LOGIN DEBUG: User not found or has no password hash for email: [%s]", req.Email)
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Username/email atau password salah."})
	}

	// Verify the password using bcrypt
	err = bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password))
	if err != nil {
		c.Logger().Errorf("LOGIN DEBUG: Password comparison failed for %s. Error: %v", req.Email, err)
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Username/email atau password salah."})
	}

	// Generate JWT
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default_secret_for_development_only"
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

	// Set session cookie for frontend compatibility
	cookie := new(http.Cookie)
	cookie.Name = "session"
	cookie.Value = tokenString
	cookie.Expires = time.Now().Add(time.Hour * 24 * 7)
	cookie.Path = "/"
	cookie.HttpOnly = false // Must be accessible for frontend lib/auth.ts decoding
	cookie.SameSite = http.SameSiteLaxMode
	c.SetCookie(cookie)

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
		"success": true,
		"token":   tokenString,
		"user":    user,
	})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	// Clear session cookie
	cookie := new(http.Cookie)
	cookie.Name = "session"
	cookie.Value = ""
	cookie.Expires = time.Now().Add(-1 * time.Hour)
	cookie.Path = "/"
	cookie.HttpOnly = false
	c.SetCookie(cookie)

	return c.JSON(http.StatusOK, map[string]string{"message": "Logged out successfully"})
}
