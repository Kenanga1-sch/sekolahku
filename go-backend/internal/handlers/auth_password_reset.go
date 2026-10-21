package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

const passwordResetTTL = 60 * time.Minute

// ForgotPassword menerima permintaan reset dan meneruskannya ke admin.
// Respons SELALU sama (generik) agar tidak bisa dipakai menebak email terdaftar.
// Tidak ada SMTP di deployment ini, jadi tautan reset dikirim sebagai
// notifikasi in-app ke superadmin/admin.
func (h *AuthHandler) ForgotPassword(c echo.Context) error {
	var req struct {
		Email string `json:"email"`
	}
	_ = c.Bind(&req)

	generic := map[string]interface{}{
		"success": true,
		"message": "Jika email terdaftar, permintaan reset telah diteruskan ke admin sekolah.",
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		return c.JSON(http.StatusOK, generic)
	}

	user, err := h.Repo.GetUserByEmail(email)
	if err != nil {
		log.Printf("forgot-password: lookup %s: %v", email, err)
		return c.JSON(http.StatusOK, generic)
	}
	if user == nil || !user.IsActive {
		return c.JSON(http.StatusOK, generic)
	}

	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		log.Printf("forgot-password: generate token: %v", err)
		return c.JSON(http.StatusOK, generic)
	}
	token := base64.RawURLEncoding.EncodeToString(raw)

	if err := h.ResetRepo.Create(user.ID, repository.HashResetToken(token), passwordResetTTL); err != nil {
		log.Printf("forgot-password: simpan token: %v", err)
		return c.JSON(http.StatusOK, generic)
	}

	if h.Notifications != nil {
		target := "/reset-password?token=" + token
		_ = h.Notifications.NotifyRoles(models.Notification{
			Type:      "warning",
			Category:  "account",
			Title:     "Permintaan Reset Password",
			Message:   "Permintaan reset password untuk " + user.Email + ". Buka tautan ini untuk membuat password baru, lalu sampaikan ke pengguna. Tautan berlaku 60 menit dan sekali pakai.",
			TargetURL: &target,
		}, "superadmin", "admin")
	}

	return c.JSON(http.StatusOK, generic)
}

// ResetPassword menukar token sekali pakai dengan password baru.
func (h *AuthHandler) ResetPassword(c echo.Context) error {
	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request payload"})
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Token wajib diisi"})
	}
	if len(req.NewPassword) < 8 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password minimal 8 karakter"})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 10)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat password"})
	}

	userID, ok, err := h.ResetRepo.ConsumeForPasswordReset(
		repository.HashResetToken(req.Token), string(hash),
	)
	if err != nil {
		log.Printf("reset-password: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Tautan reset tidak valid atau sudah kedaluwarsa",
		})
	}

	if h.AuditRepo != nil {
		ip := c.RealIP()
		ua := c.Request().UserAgent()
		details := "Reset password via tautan token"
		_ = h.AuditRepo.CreateLog(models.AuditLog{
			Action:    "reset_password",
			Resource:  "user",
			UserID:    &userID,
			IPAddress: &ip,
			UserAgent: &ua,
			Details:   &details,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Password berhasil diperbarui. Silakan masuk dengan password baru.",
	})
}
