package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type StudentHandler struct {
	Repo *repository.StudentRepository
	DB   *sql.DB
}

func NewStudentHandler(repo *repository.StudentRepository, db ...*sql.DB) *StudentHandler {
	h := &StudentHandler{Repo: repo}
	if len(db) > 0 {
		h.DB = db[0]
	}
	return h
}

// forcedWaliClass mengembalikan nama kelas wali user jika role == "guru".
// Role lain (admin/staff/bendahara) tidak di-scope (data sekolah penuh).
// Guru tanpa wali kelas -> ("", true) -> handler mengembalikan kosong.
func (h *StudentHandler) forcedWaliClass(c echo.Context) (string, bool) {
	userRole, _ := c.Get("user_role").(string)
	if userRole != "guru" {
		return "", false
	}
	userID, _ := c.Get("user_id").(string)
	var className string
	err := h.DB.QueryRow(
		`SELECT name FROM student_classes WHERE wali_user_id = ? AND is_active = 1`, userID,
	).Scan(&className)
	if err != nil || className == "" {
		return "", true
	}
	return className, true
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

	// Guru hanya melihat siswa kelas yang dipegang; guru tanpa wali -> kosong.
	scopeClass, scoped := h.forcedWaliClass(c)
	if scoped {
		if scopeClass == "" {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"success": true,
				"data":    emptyStudentResponse(page, limit),
			})
		}
		classID = scopeClass
	}

	res, err := h.Repo.GetStudentsScoped(page, limit, query, status, classID, scopeClass)
	if err != nil {
		log.Printf("GetStudents ERROR: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    res,
	})
}

// emptyStudentResponse membangun respons daftar siswa kosong (tanpa scope kelas).
func emptyStudentResponse(page, limit int) *models.StudentResponse {
	return &models.StudentResponse{
		Data:       []models.Student{},
		Pagination: models.StudentPagination{Page: page, Limit: limit, Total: 0, TotalPages: 1},
		Summary: models.StudentSummary{
			Total: 0, Active: 0, Male: 0, Female: 0,
			ByClass: []models.StudentByClass{},
		},
	}
}

func (h *StudentHandler) GetStudentHealth(c echo.Context) error {
	stats, err := h.Repo.GetStudentHealth()
	if err != nil {
		log.Printf("GetStudentHealth ERROR: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

func (h *StudentHandler) GetStudentByID(c echo.Context) error {
	id := c.Param("id")
	userRole, _ := c.Get("user_role").(string)
	userID, _ := c.Get("user_id").(string)

	s, err := h.Repo.GetStudentByID(id)
	if err != nil || s == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Siswa tidak ditemukan"})
	}

	// Guru hanya boleh membuka siswa kelas yang dipegang.
	if scopeClass, scoped := h.forcedWaliClass(c); scoped {
		if scopeClass == "" || s.ClassName == nil || *s.ClassName != scopeClass {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Siswa tidak ditemukan"})
		}
	}

	// Sertakan data Buku Induk (jika ada) agar halaman cetak siswa aktif
	// menampilkan matriks nilai & perkembangan jasmani yang sama seperti mode alumni.
	transcripts := []models.AlumniTranscript{}
	healthRecords := []models.AlumniHealthRecord{}
	attendanceSummaries := []models.AlumniAttendanceSummary{}
	classHistory := []models.ClassHistoryEntry{}
	bukuIndukID := ""
	if h.DB != nil {
		ar := repository.NewAlumniRepository(h.DB)
		if bid, bidErr := ar.GetAlumniIDByStudentID(id); bidErr == nil {
			bukuIndukID = bid
		}
		if tr, terr := ar.GetTranscriptsByStudentID(id); terr == nil {
			transcripts = tr
		}
		if hr, herr := ar.GetHealthRecordsByStudentID(id); herr == nil {
			healthRecords = hr
		}
		if at, aerr := ar.GetAttendanceByStudentID(id); aerr == nil {
			attendanceSummaries = at
		}
		if ch, cerr := ar.GetClassHistoryByStudentID(id); cerr == nil {
			classHistory = ch
		}
	}

	log.Printf("[ACCESS] student_handler.GetStudentByID: user=%s role=%s accessed student=%s", userID, userRole, id)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":             true,
		"data":                s,
		"bukuIndukId":         bukuIndukID,
		"transcripts":         transcripts,
		"healthRecords":       healthRecords,
		"attendanceSummaries": attendanceSummaries,
		"classHistory":        classHistory,
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

	// NIS otomatis: bila admin tidak mengisi manual, terbitkan NIS berikutnya
	// sesuai kelas yang dipilih (tahun ajaran + tingkat + nomor urut).
	if (s.NIS == nil || strings.TrimSpace(*s.NIS) == "") && s.ClassID != nil && strings.TrimSpace(*s.ClassID) != "" {
		if nis, nisErr := h.Repo.NextNISForStudent(*s.ClassID); nisErr == nil && nis != "" {
			s.NIS = &nis
		}
	}

	id, err := h.Repo.CreateStudent(s)
	if err != nil {
		if strings.Contains(err.Error(), "sudah digunakan oleh siswa atas nama") {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
		}
		if strings.Contains(err.Error(), "UNIQUE constraint failed: students.nisn") {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "NISN sudah terdaftar pada siswa lain"})
		}
		if strings.Contains(err.Error(), "UNIQUE constraint failed: students.nis") {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "NIS sudah terdaftar pada siswa lain"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *StudentHandler) BulkCreateStudents(c echo.Context) error {
	var req struct {
		Students []map[string]interface{} `json:"students"`
		// UpdateStatus: bila false (default), baris yang meng-update siswa
		// existing TIDAK mengubah status kecuali kolom status benar-benar ada.
		UpdateStatus *bool `json:"updateStatus"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if len(req.Students) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tidak ada data siswa untuk diimport"})
	}
	updateStatus := req.UpdateStatus != nil && *req.UpdateStatus

	rows := make([]models.Student, 0, len(req.Students))
	rowErrors := []string{}

	// Validasi + bangun model per baris. Baris invalid dilewati (partial mode).
	for index, row := range req.Students {
		lineNo := index + 1

		fullName := importString(row, "fullName", "FullName", "NamaLengkap", "nama", "Nama")
		if fullName == "" {
			rowErrors = append(rowErrors, "Baris "+strconv.Itoa(lineNo)+": nama lengkap wajib diisi")
			continue
		}

		// Status: KOSONG bila tidak diberikan di Excel. Default "active" hanya
		// diterapkan untuk siswa baru (di repo). Untuk update, status kosong =
		// pertahankan status lama (lihat mergeStudentDefaults).
		statusRaw := strings.TrimSpace(importString(row, "status", "Status"))
		status := ""
		if statusRaw != "" {
			status = strings.ToLower(statusRaw)
		}

		genderRaw := strings.ToUpper(importString(row, "gender", "Gender", "jk", "JK", "JenisKelamin"))
		var gender string
		// PRIA dicek sebelum prefix "P" (PRIA = laki-laki)
		if genderRaw == "PRIA" || strings.HasPrefix(genderRaw, "L") {
			gender = "L"
		} else if strings.HasPrefix(genderRaw, "P") || genderRaw == "WANITA" {
			gender = "P"
		} else if genderRaw != "" {
			rowErrors = append(rowErrors, "Baris "+strconv.Itoa(lineNo)+": gender tidak dikenali (\""+genderRaw+"\"), gunakan L/Laki-laki atau P/Perempuan")
			continue
		}

		birthDate := strings.TrimSpace(importString(row, "birthDate", "BirthDate", "tanggal_lahir", "TanggalLahir"))
		if birthDate != "" && !isValidISODate(birthDate) {
			rowErrors = append(rowErrors, "Baris "+strconv.Itoa(lineNo)+": tanggal lahir \""+birthDate+"\" tidak valid, gunakan format YYYY-MM-DD")
			continue
		}

		student := models.Student{
			FullName:     fullName,
			NIS:          optionalImportStringPtr(importString(row, "nis", "NIS")),
			NISN:         optionalImportStringPtr(importString(row, "nisn", "NISN")),
			NIK:          optionalImportStringPtr(importString(row, "nik", "NIK")),
			KIP:          optionalImportStringPtr(importString(row, "kip", "KIP")),
			Gender:       optionalImportStringPtr(gender),
			BirthPlace:   optionalImportStringPtr(importString(row, "birthPlace", "BirthPlace", "tempat_lahir", "TempatLahir")),
			BirthDate:    optionalImportStringPtr(birthDate),
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
			IsActive:     status == "active" || status == "aktif",
		}
		rows = append(rows, student)
	}

	res := h.Repo.BulkUpsertStudents(rows)

	// Baris gagal dari repo (indeks terhadap slice rows yang valid). Petakan ke
	// nomor baris Excel asli sedekat mungkin: karena baris invalid sudah
	// dikeluarkan, kita sertakan keduanya sebagai daftar error.
	for _, be := range res.Errors {
		rowErrors = append(rowErrors, "Baris "+strconv.Itoa(be.Index+1)+": "+be.Error)
	}

	_ = updateStatus // (disimpan untuk kompatibilitas; logika status ada di mergeStudentDefaults)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"count":    res.Inserted + res.Updated,
		"inserted": res.Inserted,
		"updated":  res.Updated,
		"errors":   rowErrors,
	})
}

// isValidISODate memverifikasi string berformat YYYY-MM-DD dan tanggalnya nyata.
func isValidISODate(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

func (h *StudentHandler) UpdateStudent(c echo.Context) error {
	id := c.Param("id")
	var s models.Student
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	err := h.Repo.UpdateStudent(id, s)
	if err != nil {
		if strings.Contains(err.Error(), "sudah digunakan oleh siswa atas nama") {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
		}
		if strings.Contains(err.Error(), "UNIQUE constraint failed: students.nisn") {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "NISN sudah terdaftar pada siswa lain"})
		}
		if strings.Contains(err.Error(), "UNIQUE constraint failed: students.nis") {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "NIS sudah terdaftar pada siswa lain"})
		}
		log.Printf("UpdateStudent ERROR: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *StudentHandler) DeleteStudent(c echo.Context) error {
	id := c.Param("id")

	// Guru hanya boleh menghapus siswa kelas yang dipegang.
	if scopeClass, scoped := h.forcedWaliClass(c); scoped {
		s, serr := h.Repo.GetStudentByID(id)
		if serr != nil || s == nil || scopeClass == "" || s.ClassName == nil || *s.ClassName != scopeClass {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Siswa tidak ditemukan"})
		}
	}

	err := h.Repo.DeleteStudent(id)
	if err != nil {
		log.Printf("DeleteStudent ERROR: %v", err)
		// Teruskan alasan penolakan (tanggungan belum selesai) ke petugas
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
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
		log.Printf("GetStudentsForPrint ERROR: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	// Guru hanya boleh mencetak siswa kelas yang dipegang.
	if scopeClass, scoped := h.forcedWaliClass(c); scoped {
		filtered := make([]models.Student, 0, len(students))
		if scopeClass != "" {
			for _, s := range students {
				if s.ClassName != nil && *s.ClassName == scopeClass {
					filtered = append(filtered, s)
				}
			}
		}
		students = filtered
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    students,
	})
}

func (h *StudentHandler) GetClasses(c echo.Context) error {
	// Guru hanya melihat kelas yang ia wali-kan; siswa/admin/superadmin
	// melihat semua kelas. Dipakai dropdown Presensi & lain-lain.
	role, _ := c.Get("user_role").(string)
	if role == "guru" {
		userID, _ := c.Get("user_id").(string)
		var className string
		err := h.DB.QueryRow(
			`SELECT name FROM student_classes WHERE wali_user_id = ? AND is_active = 1`, userID,
		).Scan(&className)
		if err != nil || className == "" {
			// Guru tanpa penunjukan wali kelas: tidak ada kelas yang boleh dilihat
			return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": []map[string]string{}})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    []map[string]string{{"id": className, "name": className}},
		})
	}

	classes, err := h.Repo.GetClasses()
	if err != nil {
		log.Printf("GetClasses ERROR: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    classes,
	})
}

func (h *StudentHandler) SimpleSearch(c echo.Context) error {
	q := c.QueryParam("q")
	className := c.QueryParam("className")

	// Guru hanya mencari siswa kelas yang dipegang; tanpa wali -> kosong.
	if scopeClass, scoped := h.forcedWaliClass(c); scoped {
		if scopeClass == "" {
			return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": []models.Student{}})
		}
		className = scopeClass
	}

	students, err := h.Repo.SimpleSearch(q, className)
	if err != nil {
		log.Printf("SimpleSearch ERROR: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": students})
}

// GetNextNIS mengembalikan NIS berikutnya untuk kelas yang dipilih (preview,
// tanpa menyimpan). Dipakai form Tambah Siswa untuk mengisi otomatis.
func (h *StudentHandler) GetNextNIS(c echo.Context) error {
	classID := strings.TrimSpace(c.QueryParam("classId"))
	if classID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "classId diperlukan"})
	}
	nis, err := h.Repo.NextNISForStudent(classID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    map[string]string{"nis": nis},
	})
}

// IssueNIS menerbitkan NIS untuk seluruh siswa di satu kelas yang belum
// memiliki NIS, diurutkan menurut nama (A -> nomor terkecil).
func (h *StudentHandler) IssueNIS(c echo.Context) error {
	var req struct {
		ClassID string `json:"classId"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.ClassID) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "classId diperlukan"})
	}
	assignments, err := h.Repo.IssueNISForClass(req.ClassID)
	if err != nil {
		log.Printf("IssueNIS ERROR: %v", err)
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"assigned": assignments,
			"count":    len(assignments),
		},
	})
}

// SyncBukuInduk synchronizes all students to the Buku Induk table
func (h *StudentHandler) SyncBukuInduk(c echo.Context) error {
	count, err := h.Repo.SyncAllToBukuInduk()
	if err != nil {
		log.Printf("SyncBukuInduk ERROR: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Berhasil mensinkronkan %d siswa ke Buku Induk", count),
		"count":   count,
	})
}
