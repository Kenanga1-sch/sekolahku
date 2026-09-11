package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	"github.com/sekolahku/go-backend/internal/shared"
)

type AlumniHandler struct {
	Repo *repository.AlumniRepository
}

func NewAlumniHandler(repo *repository.AlumniRepository) *AlumniHandler {
	return &AlumniHandler{Repo: repo}
}

// alumniPayload embeds the full Alumni model so every form field
// (buku induk extensions, physical register index, etc.) is bound
// instead of silently dropped. GraduationDate is shadowed as string
// because the frontend sends "YYYY-MM-DD" (HTML date input), which
// cannot unmarshal into *time.Time.
type alumniPayload struct {
	models.Alumni
	GraduationDate string `json:"graduationDate"`
}

func (p alumniPayload) ToModel() (models.Alumni, error) {
	a := p.Alumni
	graduationDate, err := shared.ParseOptionalDate(p.GraduationDate)
	if err != nil {
		return models.Alumni{}, err
	}
	a.GraduationDate = graduationDate
	a.FullName = strings.TrimSpace(a.FullName)
	a.GraduationYear = strings.TrimSpace(a.GraduationYear)
	a.Status = strings.TrimSpace(a.Status)
	if a.Status == "" {
		a.Status = "graduated"
	}
	if a.StudentID != nil && *a.StudentID == "" {
		a.StudentID = nil
	}
	return a, nil
}

// uploadsRootDir adalah akar direktori upload. Semua operasi file (baca &
// hapus) harus berada di dalamnya.
func uploadsRootDir() string {
	return filepath.Join("public", "uploads")
}

// resolveStoredFilePath converts a stored path (like "/uploads/...") to a filesystem path.
//
// Hasilnya divalidasi agar tidak pernah keluar dari public/uploads. Nilai
// tersimpan bisa berasal dari data lama atau impor, dan sebelumnya diteruskan
// langsung ke os.Remove sehingga file sembarang (termasuk database) dapat
// dihapus. Mengembalikan ok=false bila path berbahaya.
func resolveStoredFilePath(storedPath string) (string, bool) {
	if storedPath == "" {
		return "", false
	}
	// Tolak path absolut — tidak boleh menembus batas direktori upload.
	if filepath.IsAbs(storedPath) {
		// Kecuali diawali /uploads/, yang memang format penyimpanan normal.
		cleaned := filepath.Clean(storedPath)
		if !strings.HasPrefix(cleaned, "/uploads/") && cleaned != "/uploads" {
			return "", false
		}
	}

	path := strings.TrimPrefix(storedPath, "/")
	// Hapus prefix "public/" bila ada, lalu paksa relatif terhadap public/.
	path = strings.TrimPrefix(path, "public/")

	// Canonicalisasi dan pastikan hasilnya masih di bawah public/uploads.
	joined := filepath.Join("public", path)
	cleaned := filepath.Clean(joined)

	root := filepath.Clean(uploadsRootDir())
	if cleaned != root && !strings.HasPrefix(cleaned, root+string(os.PathSeparator)) {
		return "", false
	}

	return cleaned, true
}

// isSafeStoredUploadPath melaporkan apakah path tersimpan (format
// "/uploads/..." atau "uploads/...") aman — yaitu tidak mengandung traversal
// dan tidak absolut. Dipakai untuk memvalidasi input klien sebelum disimpan.
func isSafeStoredUploadPath(storedPath string) bool {
	if storedPath == "" {
		return false
	}
	// Tolak path absolut yang bukan format /uploads/.
	if filepath.IsAbs(storedPath) {
		cleaned := filepath.Clean(storedPath)
		if !strings.HasPrefix(cleaned, "/uploads/") {
			return false
		}
	}
	// Tolak traversal.
	normalized := filepath.ToSlash(filepath.Clean(storedPath))
	if strings.Contains(normalized, "..") {
		return false
	}
	// Harus tetap mengarah ke uploads.
	_, ok := resolveStoredFilePath(storedPath)
	return ok
}

// safeRemoveUploadFile menghapus file hanya bila berada di dalam uploadRoot.
// Digunakan sebelum os.Remove pada semua jalur hapus file upload.
func safeRemoveUploadFile(path, uploadRoot string) error {
	cleaned := filepath.Clean(path)
	root := filepath.Clean(uploadRoot)

	absPath, err := filepath.Abs(cleaned)
	if err != nil {
		return err
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return err
	}

	if absPath != absRoot && !strings.HasPrefix(absPath, absRoot+string(os.PathSeparator)) {
		return fmt.Errorf("path berada di luar direktori upload: %s", path)
	}

	// Jangan hapus direktori.
	if info, err := os.Stat(absPath); err == nil && info.IsDir() {
		return fmt.Errorf("menolak menghapus direktori: %s", path)
	}

	return os.Remove(absPath)
}

func (h *AlumniHandler) GetAlumniStats(c echo.Context) error {
	stats, err := h.Repo.GetAlumniStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

func (h *AlumniHandler) GetAlumniGraduationYears(c echo.Context) error {
	years, err := h.Repo.GetAlumniGraduationYears()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": years})
}

func (h *AlumniHandler) GetAlumni(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 20
	}
	items, total, err := h.Repo.GetAlumni(page, limit, c.QueryParam("search"), c.QueryParam("graduationYear"), c.QueryParam("status"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return shared.SuccessListResponse(c, items, total, page, limit)
}

func (h *AlumniHandler) CreateAlumni(c echo.Context) error {
	var payload alumniPayload
	if err := c.Bind(&payload); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	a, err := payload.ToModel()
	if err != nil {
		return shared.BadRequest(c, err.Error())
	}
	if a.FullName == "" {
		return shared.BadRequest(c, "Nama wajib diisi")
	}
	if a.Status == "graduated" && a.GraduationYear == "" {
		return shared.BadRequest(c, "Tahun lulus wajib diisi untuk alumni yang lulus")
	}
	id, err := h.Repo.CreateAlumni(a)
	if err != nil {
		return shared.InternalError(c)
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AlumniHandler) GetAlumniByID(c echo.Context) error {
	alumni, err := h.Repo.GetAlumniByID(c.Param("id"))
	if err != nil {
		return shared.InternalError(c)
	}
	if alumni == nil {
		return shared.NotFound(c, "Alumni tidak ditemukan")
	}
	return shared.SuccessResponse(c, alumni)
}

func (h *AlumniHandler) UpdateAlumni(c echo.Context) error {
	var payload alumniPayload
	if err := c.Bind(&payload); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	a, err := payload.ToModel()
	if err != nil {
		return shared.BadRequest(c, err.Error())
	}
	if a.FullName == "" {
		return shared.BadRequest(c, "Nama wajib diisi")
	}
	if a.Status == "graduated" && a.GraduationYear == "" {
		return shared.BadRequest(c, "Tahun lulus wajib diisi untuk alumni yang lulus")
	}
	if err := h.Repo.UpdateAlumni(c.Param("id"), a); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) DeleteAlumni(c echo.Context) error {
	if err := h.Repo.DeleteAlumni(c.Param("id")); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}
