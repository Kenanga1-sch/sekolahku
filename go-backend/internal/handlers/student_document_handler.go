package handlers

import (
	"database/sql"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/nrednav/cuid2"

	"github.com/sekolahku/go-backend/internal/repository"
)

// StudentDocumentHandler melayani dokumen pribadi siswa (KK, akta, KIP,
// ijazah, pas foto). File disimpan di public/uploads/students/<studentID>/
// yang TIDAK termasuk folder publik, sehingga hanya bisa dibaca lewat
// /api/files/... (butuh JWT + role).
type StudentDocumentHandler struct {
	Repo *repository.StudentDocumentRepository
}

func NewStudentDocumentHandler(repo *repository.StudentDocumentRepository) *StudentDocumentHandler {
	return &StudentDocumentHandler{Repo: repo}
}

const studentDocFolder = "students"

var studentDocAllowedTypes = map[string]bool{
	"kk":        true,
	"akta":      true,
	"kip":       true,
	"ijazah_tk": true,
	"foto":      true,
	"lainnya":   true,
}

// studentDocResponse adalah bentuk data yang dipakai tab Dokumen di UI.
type studentDocResponse struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Type       string `json:"type"`
	UploadedAt int64  `json:"uploadedAt"`
	FileURL    string `json:"fileUrl"`
}

func toStudentDocResponse(d repository.StudentDocument) studentDocResponse {
	return studentDocResponse{
		ID:         d.ID,
		Title:      d.Title,
		Type:       d.Type,
		UploadedAt: d.UploadedAt,
		// Folder privat → wajib lewat endpoint terautentikasi.
		FileURL: "/api/files" + d.FilePath,
	}
}

func (h *StudentDocumentHandler) studentID(c echo.Context) (string, bool) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" || strings.Contains(id, "..") || strings.ContainsAny(id, "\\/:*?\"<>|") {
		return "", false
	}
	return id, true
}

// List menangani GET /api/master/students/:id/documents
func (h *StudentDocumentHandler) List(c echo.Context) error {
	studentID, ok := h.studentID(c)
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID siswa tidak valid"})
	}

	docs, err := h.Repo.ListByStudent(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	out := make([]studentDocResponse, 0, len(docs))
	for _, d := range docs {
		out = append(out, toStudentDocResponse(d))
	}
	return c.JSON(http.StatusOK, out)
}

// Upload menangani POST /api/master/students/:id/documents (multipart).
func (h *StudentDocumentHandler) Upload(c echo.Context) error {
	studentID, ok := h.studentID(c)
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID siswa tidak valid"})
	}

	exists, err := h.Repo.StudentExists(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Siswa tidak ditemukan"})
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File wajib diunggah"})
	}

	ext, err := validateUploadedFile(fh, uploadValidationOpts{
		AllowedExtensions: []string{".pdf", ".jpg", ".jpeg", ".png"},
		MaxBytes:          5 << 20,
	})
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	docType := strings.TrimSpace(c.FormValue("type"))
	if docType == "" {
		docType = "lainnya"
	}
	if !studentDocAllowedTypes[docType] {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Jenis dokumen tidak valid"})
	}

	title := strings.TrimSpace(c.FormValue("title"))
	if title == "" {
		title = filepath.Base(fh.Filename)
	}
	if len(title) > 200 {
		title = title[:200]
	}

	relDir := filepath.Join("public", "uploads", studentDocFolder, studentID)
	if err := os.MkdirAll(relDir, 0o755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyiapkan folder penyimpanan"})
	}

	filename := cuid2.Generate() + strings.ToLower(ext)
	diskPath := filepath.Join(relDir, filename)

	src, err := fh.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membaca file"})
	}
	defer src.Close()

	dst, err := os.OpenFile(diskPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan file"})
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		_ = os.Remove(diskPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan file"})
	}
	dst.Close()

	storedPath := "/uploads/" + studentDocFolder + "/" + studentID + "/" + filename
	uploadedBy := currentUserID(c)
	doc := repository.StudentDocument{
		ID:         cuid2.Generate(),
		StudentID:  studentID,
		Title:      title,
		Type:       docType,
		FilePath:   storedPath,
		UploadedAt: time.Now().UnixMilli(),
	}
	if uploadedBy != "" {
		doc.UploadedBy = &uploadedBy
	}

	if err := h.Repo.Create(doc); err != nil {
		_ = os.Remove(diskPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan data dokumen"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    toStudentDocResponse(doc),
	})
}

// Delete menangani DELETE /api/master/students/:id/documents?docId=...
func (h *StudentDocumentHandler) Delete(c echo.Context) error {
	studentID, ok := h.studentID(c)
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID siswa tidak valid"})
	}
	docID := strings.TrimSpace(c.QueryParam("docId"))
	if docID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "docId wajib diisi"})
	}

	doc, err := h.Repo.GetByID(studentID, docID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Dokumen tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	deleted, err := h.Repo.Delete(studentID, docID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus dokumen"})
	}
	if !deleted {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Dokumen tidak ditemukan"})
	}

	// Hapus file hanya bila path tersimpan aman (di dalam public/uploads).
	if diskPath, ok := resolveStoredFilePath(doc.FilePath); ok {
		_ = os.Remove(diskPath)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
