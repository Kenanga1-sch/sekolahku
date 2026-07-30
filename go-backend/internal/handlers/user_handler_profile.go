package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"github.com/sekolahku/go-backend/internal/models"
)

// ============ Profile (Current User) ============

func (h *UserHandler) GetProfile(c echo.Context) error {
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}
	user, err := h.UserRepo.GetUserByID(userID)
	if err != nil || user == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}
	return c.JSON(http.StatusOK, user)
}

func (h *UserHandler) UpdateProfile(c echo.Context) error {
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	var req struct {
		Name            string  `json:"name"`
		FullName        string  `json:"fullName"`
		Username        string  `json:"username"`
		Phone           string  `json:"phone"`
		Image           *string `json:"image"`
		OldPassword     string  `json:"oldPassword"`
		Password        string  `json:"password"`
		PasswordConfirm string  `json:"passwordConfirm"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	// Case 1: Password Change
	if req.OldPassword != "" {
		existingUser, err := h.UserRepo.GetUserByID(userID)
		if err != nil || existingUser == nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
		}
		if existingUser.PasswordHash == nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "User has no password set"})
		}
		err = bcrypt.CompareHashAndPassword([]byte(*existingUser.PasswordHash), []byte(req.OldPassword))
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Password lama salah"})
		}
		if req.Password != req.PasswordConfirm {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Konfirmasi password tidak cocok"})
		}
		if len(req.Password) < 8 {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password minimal 8 karakter"})
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat password"})
		}
		err = h.UserRepo.UpdatePassword(userID, string(hash))
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}

		ip := c.RealIP()
		ua := c.Request().UserAgent()
		details := "User changed their password via profile"
		h.AuditRepo.CreateLog(models.AuditLog{
			Action: "update", Resource: "security", UserID: &userID, Details: &details, IPAddress: &ip, UserAgent: &ua,
		})
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
	}

	// Case 2: Info Update
	req.Name = strings.TrimSpace(req.Name)
	req.FullName = strings.TrimSpace(req.FullName)
	req.Username = strings.TrimSpace(req.Username)
	req.Phone = strings.TrimSpace(req.Phone)

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama wajib diisi"})
	}

	existingUser, err := h.UserRepo.GetUserByID(userID)
	if err != nil || existingUser == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	username := existingUser.Username
	if req.Username != "" && (existingUser.Username == nil || req.Username != *existingUser.Username) {
		takenUser, err := h.UserRepo.GetUserByEmail(req.Username)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}
		if takenUser != nil && takenUser.ID != userID {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Username sudah digunakan oleh pengguna lain"})
		}
		username = &req.Username
	}

	fullName := req.FullName
	if fullName == "" {
		fullName = req.Name
	}

	user := models.User{
		Name:     &req.Name,
		FullName: &fullName,
		Username: username,
		Phone:    &req.Phone,
		Image:    req.Image,
	}
	err = h.UserRepo.UpdateUser(userID, user)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := "User updated their profile information"
	h.AuditRepo.CreateLog(models.AuditLog{
		Action: "update", Resource: "profile", UserID: &userID, Details: &details, IPAddress: &ip, UserAgent: &ua,
	})

	updatedUser, err := h.UserRepo.GetUserByID(userID)
	if err != nil || updatedUser == nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "user": updatedUser})
}

func (h *UserHandler) GetProfileLogs(c echo.Context) error {
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	pageStr := c.QueryParam("page")
	limitStr := c.QueryParam("limit")
	if limitStr == "" {
		limitStr = c.QueryParam("perPage")
	}

	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	limit := 10
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	logs, total, err := h.AuditRepo.GetLogsByUserID(userID, page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	totalPages := (total + limit - 1) / limit
	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      logs,
		"totalItems": total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	})
}
