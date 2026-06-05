package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type StudentHandler struct {
	Repo *repository.StudentRepository
}

func NewStudentHandler(repo *repository.StudentRepository) *StudentHandler {
	return &StudentHandler{Repo: repo}
}

func (h *StudentHandler) GetStudents(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 10
	}
	query := c.QueryParam("q")
	if query == "" {
		query = c.QueryParam("search")
	}
	status := c.QueryParam("status")
	if status == "" {
		switch c.QueryParam("isActive") {
		case "true":
			status = "active"
		case "false":
			status = "inactive"
		}
	}
	classID := c.QueryParam("classId")
	if classID == "" {
		classID = c.QueryParam("className")
	}

	res, err := h.Repo.GetStudents(page, limit, query, status, classID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    res,
	})
}

func (h *StudentHandler) GetStudentHealth(c echo.Context) error {
	stats, err := h.Repo.GetStudentHealth()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

func (h *StudentHandler) GetStudentByID(c echo.Context) error {
	id := c.Param("id")
	s, err := h.Repo.GetStudentByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Siswa tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    s,
	})
}

func (h *StudentHandler) CreateStudent(c echo.Context) error {
	var s models.Student
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	if s.FullName == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nama lengkap harus diisi"})
	}

	id, err := h.Repo.CreateStudent(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *StudentHandler) BulkCreateStudents(c echo.Context) error {
	var req struct {
		Students []map[string]interface{} `json:"students"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if len(req.Students) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tidak ada data siswa untuk diimport"})
	}

	count := 0
	errors := []string{}
	for index, row := range req.Students {
		fullName := importString(row, "fullName", "FullName", "NamaLengkap", "nama", "Nama")
		if fullName == "" {
			errors = append(errors, "Baris "+strconv.Itoa(index+1)+": nama lengkap wajib diisi")
			continue
		}

		status := strings.ToLower(importString(row, "status", "Status"))
		if status == "" {
			status = "active"
		}
		gender := strings.ToUpper(importString(row, "gender", "Gender", "jk", "JK"))
		if gender != "L" && gender != "P" {
			gender = ""
		}

		student := models.Student{
			FullName:     fullName,
			NIS:          optionalImportStringPtr(importString(row, "nis", "NIS")),
			NISN:         optionalImportStringPtr(importString(row, "nisn", "NISN")),
			NIK:          optionalImportStringPtr(importString(row, "nik", "NIK")),
			KIP:          optionalImportStringPtr(importString(row, "kip", "KIP")),
			Gender:       optionalImportStringPtr(gender),
			BirthPlace:   optionalImportStringPtr(importString(row, "birthPlace", "BirthPlace", "tempat_lahir", "TempatLahir")),
			BirthDate:    optionalImportStringPtr(importString(row, "birthDate", "BirthDate", "tanggal_lahir", "TanggalLahir")),
			Religion:     optionalImportStringPtr(importString(row, "religion", "Religion", "agama", "Agama")),
			Address:      optionalImportStringPtr(importString(row, "address", "Address", "alamat", "Alamat")),
			ParentName:   optionalImportStringPtr(importString(row, "parentName", "ParentName", "nama_orang_tua", "NamaOrangTua")),
			FatherName:   optionalImportStringPtr(importString(row, "fatherName", "FatherName", "nama_ayah", "NamaAyah")),
			FatherNIK:    optionalImportStringPtr(importString(row, "fatherNik", "FatherNik", "fatherNIK", "nik_ayah", "NikAyah")),
			MotherName:   optionalImportStringPtr(importString(row, "motherName", "MotherName", "nama_ibu", "NamaIbu")),
			MotherNIK:    optionalImportStringPtr(importString(row, "motherNik", "MotherNik", "motherNIK", "nik_ibu", "NikIbu")),
			GuardianName: optionalImportStringPtr(importString(row, "guardianName", "GuardianName", "nama_wali", "NamaWali")),
			GuardianNIK:  optionalImportStringPtr(importString(row, "guardianNik", "GuardianNik", "guardianNIK", "nik_wali", "NikWali")),
			GuardianJob:  optionalImportStringPtr(importString(row, "guardianJob", "GuardianJob", "pekerjaan_wali", "PekerjaanWali")),
			ParentPhone:  optionalImportStringPtr(importString(row, "parentPhone", "ParentPhone", "no_hp", "NoHP")),
			ClassName:    optionalImportStringPtr(importString(row, "className", "ClassName", "kelas", "Kelas")),
			Status:       status,
			IsActive:     status == "active",
		}

		if _, err := h.Repo.CreateStudent(student); err != nil {
			errors = append(errors, "Baris "+strconv.Itoa(index+1)+": "+err.Error())
			continue
		}
		count++
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"count":   count,
		"errors":  errors,
	})
}

func (h *StudentHandler) UpdateStudent(c echo.Context) error {
	id := c.Param("id")
	var s models.Student
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	err := h.Repo.UpdateStudent(id, s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *StudentHandler) DeleteStudent(c echo.Context) error {
	id := c.Param("id")
	err := h.Repo.DeleteStudent(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *StudentHandler) GetStudentsForPrint(c echo.Context) error {
	var req struct {
		StudentIds []string `json:"studentIds"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	studentIDs := make([]string, 0, len(req.StudentIds))
	for _, id := range req.StudentIds {
		id = strings.TrimSpace(id)
		if id != "" {
			studentIDs = append(studentIDs, id)
		}
	}
	if len(studentIDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tidak ada siswa yang dipilih"})
	}

	students, err := h.Repo.GetStudentsByIDs(studentIDs)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    students,
	})
}

func (h *StudentHandler) GetClasses(c echo.Context) error {
	classes, err := h.Repo.GetClasses()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    classes,
	})
}

func (h *StudentHandler) SimpleSearch(c echo.Context) error {
	q := c.QueryParam("q")
	className := c.QueryParam("className")
	students, err := h.Repo.SimpleSearch(q, className)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": students})
}
