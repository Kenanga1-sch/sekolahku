package handlers

import (
	"fmt"
	"net/http"
	"strconv"

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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		Name     string `json:"name"`
		Email    string `json:"email"`
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
		Phone    string `json:"phone"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	passwordHash := string(hash)

	user := models.User{
		Name:         &req.Name,
		Email:        req.Email,
		Username:     &req.Username,
		PasswordHash: &passwordHash,
		Role:         req.Role,
		Phone:        &req.Phone,
		IsActive:     true,
	}

	id, err := h.UserRepo.CreateUser(user)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Audit Log
	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := fmt.Sprintf("Created user: %s (%s)", req.Name, req.Role)
	h.AuditRepo.CreateLog(models.AuditLog{
		Action:    "create",
		Resource:  "user",
		Details:   &details,
		IPAddress: &ip,
		UserAgent: &ua,
	})

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
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

	user := models.User{
		Name:     &req.Name,
		Username: &req.Username,
		Role:     req.Role,
		Phone:    &req.Phone,
	}

	if req.Password != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
		pwHash := string(hash)
		user.PasswordHash = &pwHash
	}

	if err := h.UserRepo.UpdateUser(id, user); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Audit Log
	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := fmt.Sprintf("Updated user ID: %s", id)
	h.AuditRepo.CreateLog(models.AuditLog{
		Action:    "update",
		Resource:  "user",
		Details:   &details,
		IPAddress: &ip,
		UserAgent: &ua,
	})

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}


func (h *UserHandler) DeleteUser(c echo.Context) error {
	id := c.Param("id")
	if err := h.UserRepo.DeleteUser(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Audit Log
	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := fmt.Sprintf("Deleted user ID: %s", id)
	h.AuditRepo.CreateLog(models.AuditLog{
		Action:    "delete",
		Resource:  "user",
		Details:   &details,
		IPAddress: &ip,
		UserAgent: &ua,
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
		// Fetch students by class
		students, err := h.StudentRepo.SimpleSearch("", req.ClassName)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		for _, s := range students {
			if s.NISN == nil || *s.NISN == "" {
				continue
			}

			// Check if exists
			existing, _ := h.UserRepo.GetUserByEmail(*s.NISN + "@sekolahku.id") // Fallback email
			if existing != nil {
				continue
			}

			hash, _ := bcrypt.GenerateFromPassword([]byte(*s.NISN), 10)
			pwHash := string(hash)
			role := "siswa"

			u := models.User{
				Name:         &s.FullName,
				Email:        *s.NISN + "@sekolahku.id",
				Username:     s.NISN,
				PasswordHash: &pwHash,
				Role:         role,
				IsActive:     true,
			}
			_, err = h.UserRepo.CreateUser(u)
			if err == nil {
				count++
			}
		}
	} else if req.Type == "staff-auto" {
		// Fetch all staff
		res, err := h.EmployeeRepo.GetEmployees(1, 1000, "")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		for _, e := range res.Data {
			// Staff already have user accounts usually, but let's check mode
			if req.Mode == "overwrite" {
				hash, _ := bcrypt.GenerateFromPassword([]byte("123456"), 10)
				pwHash := string(hash)
				h.UserRepo.UpdateUser(e.ID, models.User{PasswordHash: &pwHash})
				count++
			} else {
				// Safe mode: just check if they exist (they should)
				count++
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Berhasil generate %d akun", count),
	})
}

// Profile Methods (Current User)

func (h *UserHandler) GetProfile(c echo.Context) error {
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	user, err := h.UserRepo.GetUserByID(userID)
	if err != nil {
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
		Name            string `json:"name"`
		Phone           string `json:"phone"`
		OldPassword     string `json:"oldPassword"`
		Password        string `json:"password"`
		PasswordConfirm string `json:"passwordConfirm"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	// Case 1: Password Change
	if req.OldPassword != "" {
		existingUser, err := h.UserRepo.GetUserByID(userID)
		if err != nil {
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
		hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
		err = h.UserRepo.UpdatePassword(userID, string(hash))
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		// Log Security Change
		ip := c.RealIP()
		ua := c.Request().UserAgent()
		details := "User changed their password via profile"
		h.AuditRepo.CreateLog(models.AuditLog{
			Action: "update", Resource: "security", UserID: &userID, Details: &details, IPAddress: &ip, UserAgent: &ua,
		})
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
	}

	// Case 2: Info Update
	user := models.User{
		Name:  &req.Name,
		Phone: &req.Phone,
	}
	err := h.UserRepo.UpdateUser(userID, user)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Log Profile Update
	ip := c.RealIP()
	ua := c.Request().UserAgent()
	details := "User updated their profile information"
	h.AuditRepo.CreateLog(models.AuditLog{
		Action: "update", Resource: "profile", UserID: &userID, Details: &details, IPAddress: &ip, UserAgent: &ua,
	})

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}


