package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
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

// SessionTTL: umur sesi login. JWT stateless + cookie persisten agar PWA
// terasa seperti aplikasi native — sekali login, praktis tidak logout lagi
// di perangkat itu (sama seperti aplikasi mobile pada umumnya). Logout tetap
// membutihkan cookie; ganti password tidak membatalkan token lama.
const sessionDays = 365
const SessionTTL = sessionDays * 24 * time.Hour
const sessionMaxAge = sessionDays * 24 * 3600

func NewAuthHandler(repo *repository.UserRepository, auditRepo *repository.AuditLogRepository) *AuthHandler {
	return &AuthHandler{
		Repo:      repo,
		AuditRepo: auditRepo,
	}
}

type LoginRequest struct {
	Email      string `json:"email" form:"email"`
	Password   string `json:"password" form:"password"`
	RememberMe bool   `json:"remember_me" form:"remember_me"`
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

	// Anti user-enumeration timing: saat email tidak terdaftar, tetap jalankan
	// bcrypt (dummy) supaya response time sama dengan saat email ada. Tanpa ini,
	// perbedaan ~50-100ms membocorkan apakah email terdaftar di sistem.
	dummyHash := []byte("$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.")

	if user == nil || user.PasswordHash == nil {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Username/email atau password salah."})
	}

	err = bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password))
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Username/email atau password salah."})
	}

	// User yang sudah dinonaktifkan tidak boleh mendapat sesi baru.
	// Tanpa pengecekan ini, staf/guru yang sudah di-offboarding tetap bisa
	// login selama akunnya ada.
	if !user.IsActive {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun Anda tidak aktif. Silakan hubungi administrator."})
	}

	// Generate JWT
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Server configuration error: JWT_SECRET not set"})
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"name":  user.Name,
		"exp":   time.Now().Add(SessionTTL).Unix(),
	})

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		c.Logger().Error("Error signing JWT:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not generate token"})
	}

	// Set session cookie for backend security (HttpOnly)
	// Secure=true default (produksi via HTTPS/Cloudflare); nonaktifkan untuk dev lokal HTTP.
	cookieSecure := os.Getenv("COOKIE_SECURE") != "false"
	sessionCookie := new(http.Cookie)
	sessionCookie.Name = "session"
	sessionCookie.Value = tokenString
	sessionCookie.Path = "/"
	sessionCookie.HttpOnly = true
	sessionCookie.Secure = cookieSecure
	sessionCookie.SameSite = http.SameSiteLaxMode
	// MaxAge wajib diset SEBELUM SetCookie — Echo menyalin struct cookie
	// saat SetCookie, jadi assignment setelahnya tidak ber efek.
	sessionCookie.MaxAge = sessionMaxAge
	c.SetCookie(sessionCookie)

	// Extract name safely
	userName := ""
	if user.Name != nil {
		userName = *user.Name
	}
	// Foto profil untuk tampilan avatar (path relatif pendek, aman untuk cookie)
	userImage := ""
	if user.Image != nil {
		userImage = *user.Image
	}
	// Set a public user info cookie for frontend display (Non-HttpOnly)
	// This contains non-sensitive info only.
	userInfo := map[string]string{
		"id":    user.ID,
		"name":  userName,
		"role":  user.Role,
		"image": userImage,
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
	infoCookie.Secure = cookieSecure
	infoCookie.SameSite = http.SameSiteLaxMode

	// Session selalu persisten (PWA mode): cookie bertahan setelah app ditutup.
	// "Ingat saya" hanya dipakai frontend untuk prefill identitas.
	infoCookie.MaxAge = sessionMaxAge
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
		"success":            true,
		"token":              tokenString,
		"user":               user,
		"public_info":        userInfo,
		"mustChangePassword": user.MustChangePassword,
	})
}

// ============ Admin Account Switch (impersonation) ============
//
// Admin/superadmin dapat "mengganti akun" ke user manapun untuk pengetesan
// atau dukungan tanpa logout+login. Sesi hasil switch membawa klaim JWT "imp"
// (impersonated-by) yang tidak bisa dipalsukan klien karena ada di dalam
// HttpOnly session cookie. Endpoint Return memakai klaim itu untuk kembali
// ke akun admin asal — satu klik, tanpa password.

type SwitchRequest struct {
	UserID string `json:"userId"`
}

// issueSession membuat JWT + cookie session/user_info untuk user target.
// Jika adminID != "" maka klaim "imp" disisipkan (penanda impersonasi).
func (h *AuthHandler) issueSession(c echo.Context, user *models.User, adminID string, adminName string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET not set")
	}

	claims := jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"name":  user.Name,
		"exp":   time.Now().Add(SessionTTL).Unix(),
	}
	if adminID != "" && adminID != user.ID {
		claims["imp"] = adminID
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", err
	}

	cookieSecure := os.Getenv("COOKIE_SECURE") != "false"

	sessionCookie := &http.Cookie{
		Name:     "session",
		Value:    tokenString,
		Path:     "/",
		HttpOnly: true,
		Secure:   cookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   sessionMaxAge,
	}
	c.SetCookie(sessionCookie)

	userName := ""
	if user.Name != nil {
		userName = *user.Name
	}
	userImage := ""
	if user.Image != nil {
		userImage = *user.Image
	}

	// user_info dibaca frontend untuk tampilan saja (avatar, nama, role,
	// dan tanda impersonasi). HttpOnly session tetap satu-satunya sumber
	// kebenaran yang diverifikasi middleware di setiap request.
	userInfo := map[string]string{
		"id":     user.ID,
		"name":   userName,
		"role":   user.Role,
		"image":  userImage,
		"imp":    adminID,
		"impName": adminName,
	}
	userInfoJSON, _ := json.Marshal(userInfo)

	infoCookie := &http.Cookie{
		Name:     "user_info",
		Value:    url.QueryEscape(string(userInfoJSON)),
		Path:     "/",
		HttpOnly: false,
		Secure:   cookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   sessionMaxAge,
	}
	c.SetCookie(infoCookie)

	return tokenString, nil
}

func (h *AuthHandler) SwitchAccount(c echo.Context) error {
	var req SwitchRequest
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.UserID) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "userId wajib diisi"})
	}

	adminID, _ := c.Get("user_id").(string)
	adminRole, _ := c.Get("user_role").(string)
	adminName, _ := c.Get("user_name").(string)

	target, err := h.Repo.GetUserByID(req.UserID)
	if err != nil || target == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Akun tujuan tidak ditemukan"})
	}

	if !target.IsActive {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun tujuan tidak aktif"})
	}

	// Admin (bukan superadmin) tidak boleh switch ke superadmin — mencegah
	// privilege escalation. Superadmin boleh switch ke siapapun.
	if adminRole != "superadmin" && target.Role == "superadmin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Anda tidak dapat mengganti ke akun superadmin"})
	}

	tokenString, err := h.issueSession(c, target, adminID, adminName)
	if err != nil {
		c.Logger().Error("Error issuing switched session:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat sesi"})
	}

	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := fmt.Sprintf("Admin switched to account: %s (%s)", target.Email, target.Role)
	h.AuditRepo.CreateLog(models.AuditLog{
		Action:    "switch_account",
		Resource:  "user",
		UserID:    &adminID,
		UserName:  &adminName,
		UserEmail: nil,
		IPAddress: &ip,
		UserAgent: &ua,
		Details:   &details,
	})

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"token":   tokenString,
		"user":    target,
	})
}

func (h *AuthHandler) ReturnToAdmin(c echo.Context) error {
	// Klaim imp dibaca dari JWT terverifikasi (middleware sudah inject
	// user_id dari HttpOnly cookie). Klien tidak bisa memalsukan nilai ini.
	impID, _ := c.Get("imp").(string)
	if impID == "" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Sesi ini tidak diimpersonasi"})
	}

	admin, err := h.Repo.GetUserByID(impID)
	if err != nil || admin == nil || !admin.IsActive {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun admin asal tidak tersedia"})
	}

	tokenString, err := h.issueSession(c, admin, "", "")
	if err != nil {
		c.Logger().Error("Error issuing admin session:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat sesi"})
	}

	ip := c.RealIP()
	ua := c.Request().UserAgent()
	adminName := ""
	if admin.Name != nil {
		adminName = *admin.Name
	}
	details := fmt.Sprintf("Returned to admin account: %s", admin.Email)
	h.AuditRepo.CreateLog(models.AuditLog{
		Action:    "return_account",
		Resource:  "user",
		UserID:    &admin.ID,
		UserName:  &adminName,
		UserEmail: &admin.Email,
		IPAddress: &ip,
		UserAgent: &ua,
		Details:   &details,
	})

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"token":   tokenString,
		"user":    admin,
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
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})

	return c.JSON(http.StatusOK, map[string]string{"message": "Logged out successfully"})
}
