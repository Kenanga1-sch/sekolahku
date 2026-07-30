package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type UserHandler struct {
	UserRepo     *repository.UserRepository
	StudentRepo  *repository.StudentRepository
	EmployeeRepo *repository.EmployeeRepository
	AuditRepo    *repository.AuditLogRepository
}

func NewUserHandler(userRepo *repository.UserRepository, studentRepo *repository.StudentRepository, employeeRepo *repository.EmployeeRepository, auditRepo *repository.AuditLogRepository) *UserHandler {
	return &UserHandler{
		UserRepo:     userRepo,
		StudentRepo:  studentRepo,
		EmployeeRepo: employeeRepo,
		AuditRepo:    auditRepo,
	}
}

// ============ Role Helpers ============

var allowedUserRoles = map[string]bool{
	"superadmin":  true,
	"admin":       true,
	"staff":       true,
	"user":        true,
	"guru":        true,
	"siswa":       true,
	"calon_siswa": true,
}

func normalizeUserRole(role string) (string, bool) {
	normalized := strings.ToLower(strings.TrimSpace(role))
	if normalized == "" {
		normalized = "user"
	}
	return normalized, allowedUserRoles[normalized]
}

// ============ Admin CRUD ============

func (h *UserHandler) GetUsers(c echo.Context) error {
	pageStr := c.QueryParam("page")
	limitStr := c.QueryParam("limit")
	search := c.QueryParam("search")

	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	limit := 20
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	users, total, err := h.UserRepo.GetUsers(page, limit, search)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	totalPages := (total + limit - 1) / limit
	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      users,
		"totalItems": total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	})
}

func (h *UserHandler) CreateUser(c echo.Context) error {
	var req struct {
		Name            string `json:"name"`
		Email           string `json:"email"`
		Username        string `json:"username"`
		Password        string `json:"password"`
		PasswordConfirm string `json:"passwordConfirm"`
		Role            string `json:"role"`
		Phone           string `json:"phone"`
		EmployeeID      string `json:"employeeId"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Username = strings.TrimSpace(req.Username)
	req.Phone = strings.TrimSpace(req.Phone)
	role, ok := normalizeUserRole(req.Role)

	password := req.Password
	if password == "" {
		password = generateRandomPassword()
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama wajib diisi"})
	}
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Email tidak valid"})
	}
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Role tidak valid"})
	}
	if len(password) < 8 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password minimal 8 karakter"})
	}
	if req.PasswordConfirm != "" && password != req.PasswordConfirm {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Konfirmasi password tidak cocok"})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat password"})
	}
	passwordHash := string(hash)

	var username *string
	if req.Username != "" {
		username = &req.Username
	}

	user := models.User{
		Name:               &req.Name,
		Email:              req.Email,
		Username:           username,
		FullName:           &req.Name,
		PasswordHash:       &passwordHash,
		Role:               role,
		Phone:              &req.Phone,
		IsActive:           true,
		MustChangePassword: req.Password == "",
	}

	id, err := h.UserRepo.CreateUser(user)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return c.JSON(http.StatusConflict, map[string]string{"error": "Email atau username sudah digunakan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	if req.EmployeeID != "" {
		if err := h.UserRepo.LinkEmployeeToUser(req.EmployeeID, id); err != nil {
			c.Logger().Error("Failed to link employee:", err)
		}
	}

	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := fmt.Sprintf("Created user: %s (%s)", req.Name, role)
	currentUserID, _ := c.Get("user_id").(string)
	h.AuditRepo.CreateLog(models.AuditLog{
		Action: "create", Resource: "user",
		UserID: &currentUserID, Details: &details, IPAddress: &ip, UserAgent: &ua,
	})

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success":            true,
		"id":                 id,
		"password":           password,
		"message":            "Akun berhasil dibuat. Catat password ini — hanya ditampilkan sekali.",
		"mustChangePassword": user.MustChangePassword,
	})
}

func (h *UserHandler) UpdateUser(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Name     string `json:"name"`
		Username string `json:"username"`
		Role     string `json:"role"`
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Username = strings.TrimSpace(req.Username)
	req.Phone = strings.TrimSpace(req.Phone)
	role, ok := normalizeUserRole(req.Role)

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama wajib diisi"})
	}
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Role tidak valid"})
	}
	if req.Password != "" && len(req.Password) < 8 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password minimal 8 karakter"})
	}

	var username *string
	if req.Username != "" {
		username = &req.Username
	}

	user := models.User{
		Name: &req.Name, FullName: &req.Name,
		Username: username, Role: role, Phone: &req.Phone,
	}

	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat password"})
		}
		pwHash := string(hash)
		user.PasswordHash = &pwHash
	}

	if err := h.UserRepo.UpdateUser(id, user); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Pengguna tidak ditemukan"})
		}
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return c.JSON(http.StatusConflict, map[string]string{"error": "Username sudah digunakan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := fmt.Sprintf("Updated user ID: %s", id)
	currentUserID, _ := c.Get("user_id").(string)
	h.AuditRepo.CreateLog(models.AuditLog{
		Action: "update", Resource: "user",
		UserID: &currentUserID, Details: &details, IPAddress: &ip, UserAgent: &ua,
	})
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *UserHandler) DeleteUser(c echo.Context) error {
	id := c.Param("id")
	currentUserID, _ := c.Get("user_id").(string)
	if currentUserID != "" && currentUserID == id {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tidak bisa menghapus akun sendiri"})
	}

	if err := h.UserRepo.DeleteUser(id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Pengguna tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := fmt.Sprintf("Deleted user ID: %s", id)
	h.AuditRepo.CreateLog(models.AuditLog{
		Action: "delete", Resource: "user",
		UserID: &currentUserID, Details: &details, IPAddress: &ip, UserAgent: &ua,
	})
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *UserHandler) GenerateAccounts(c echo.Context) error {
	var req struct {
		Type      string `json:"type"`
		ClassName string `json:"className"`
		Mode      string `json:"mode"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	count := 0
	if req.Type == "student" {
		students, err := h.StudentRepo.SimpleSearch("", req.ClassName)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}
		for _, s := range students {
			if s.NISN == nil || *s.NISN == "" {
				continue
			}
			existing, _ := h.UserRepo.GetUserByEmail(*s.NISN + "@sekolahku.id")
			if existing != nil {
				continue
			}
			hash, _ := bcrypt.GenerateFromPassword([]byte(*s.NISN), 10)
			pwHash := string(hash)
			u := models.User{
				Name: &s.FullName, Email: *s.NISN + "@sekolahku.id",
				Username: s.NISN, PasswordHash: &pwHash,
				Role: "siswa", IsActive: true,
			}
			_, err = h.UserRepo.CreateUser(u)
			if err == nil {
				count++
			}
		}
	} else if req.Type == "staff-auto" {
		employees, err := h.EmployeeRepo.GetEmployeesWithoutAccount()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}
		for _, e := range employees {
			pw := generateRandomPassword()
			hash, _ := bcrypt.GenerateFromPassword([]byte(pw), 10)
			pwHash := string(hash)
			role := e.Role
			if role == "" {
				role = "guru"
			}
			u := models.User{
				Name: &e.Name, Email: e.Email, FullName: &e.Name,
				PasswordHash: &pwHash, Role: role,
				IsActive: true, MustChangePassword: true,
			}
			userId, err := h.UserRepo.CreateUser(u)
			if err == nil {
				h.UserRepo.LinkEmployeeToUser(e.ID, userId)
				count++
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Berhasil generate %d akun", count),
	})
}
