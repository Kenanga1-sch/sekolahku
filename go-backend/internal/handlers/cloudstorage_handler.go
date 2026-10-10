package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sekolahku/go-backend/internal/cloudstorage"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// CloudStorageHandler melayani API Cloud Storage (metadata + streaming) dengan
// backend penyimpanan Telegram Bot API lokal. Setiap user memiliki penyimpanan
// pribadi terpisah (isolasi via owner_id).
type CloudStorageHandler struct {
	Svc        *cloudstorage.Service
	ExpiryDays int64
}

// NewCloudStorageHandler membangun handler dari env:
//
//	CLOUDSTORAGE_BOT_TOKEN, CLOUDSTORAGE_CHAT_ID, CLOUDSTORAGE_MAX_UPLOAD_MB,
//	CLOUDSTORAGE_THUMB_DIR, CLOUDSTORAGE_ENCRYPTION_KEY, CLOUDSTORAGE_SHARE_EXPIRY_DAYS
//	CLOUDSTORAGE_LOCAL_FILE_ROOT (mount berkas server Bot API lokal di container)
//	CLOUDSTORAGE_CHUNK_DIR (direktori kerja upload bertahap; default ./data/cloud-uploads)
func NewCloudStorageHandler(repo *repository.CloudStorageRepository) *CloudStorageHandler {
	maxMB := int64(2048)
	if v := strings.TrimSpace(os.Getenv("CLOUDSTORAGE_MAX_UPLOAD_MB")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			maxMB = n
		}
	}

	apiURL := strings.TrimSpace(os.Getenv("TELEGRAM_API_URL"))
	if apiURL == "" {
		apiURL = "https://api.telegram.org"
	}
	token := strings.TrimSpace(os.Getenv("CLOUDSTORAGE_BOT_TOKEN"))
	localRoot := strings.TrimSpace(os.Getenv("CLOUDSTORAGE_LOCAL_FILE_ROOT"))
	remotePrefix := strings.TrimSpace(os.Getenv("CLOUDSTORAGE_REMOTE_PREFIX"))

	cfg := cloudstorage.Config{
		BotToken:       token,
		ChatID:         strings.TrimSpace(os.Getenv("CLOUDSTORAGE_CHAT_ID")),
		MaxUploadBytes: maxMB * 1024 * 1024,
		ThumbDir:       strings.TrimSpace(os.Getenv("CLOUDSTORAGE_THUMB_DIR")),
		EncryptionKey:  strings.TrimSpace(os.Getenv("CLOUDSTORAGE_ENCRYPTION_KEY")),
		LocalFileRoot:  localRoot,
		ChunkDir:       chunkDirFromEnv(),
	}

	expiry := int64(0)
	if v := strings.TrimSpace(os.Getenv("CLOUDSTORAGE_SHARE_EXPIRY_DAYS")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n >= 0 {
			expiry = n
		}
	}

	svc := cloudstorage.NewService(repo, cloudstorage.NewTelegramClient(token, apiURL, localRoot, remotePrefix), cfg)
	return &CloudStorageHandler{Svc: svc, ExpiryDays: expiry}
}

// chunkDirFromEnv mengembalikan direktori kerja upload bertahap dari env
// CLOUDSTORAGE_CHUNK_DIR. Default "./data/cloud-uploads" (di dalam volume
// ./data) agar TIDAK memakai /tmp container yang biasanya tmpfs kecil.
func chunkDirFromEnv() string {
	if v := strings.TrimSpace(os.Getenv("CLOUDSTORAGE_CHUNK_DIR")); v != "" {
		return v
	}
	return filepath.Join("data", "cloud-uploads")
}

// StartThumbCleaner menjalankan pembersih thumbnail berkala (tiap 24 jam).
func (h *CloudStorageHandler) StartThumbCleaner() {
	go func() {
		_ = h.Svc.CleanThumbCache()
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			_ = h.Svc.CleanThumbCache()
		}
	}()
}

// ownerID mengambil user_id dari konteks JWT. Kosong = tidak terautentikasi.
func ownerID(c echo.Context) string {
	if v, ok := c.Get("user_id").(string); ok {
		return v
	}
	return ""
}

func cloudErr(c echo.Context, err error) error {
	if errors.Is(err, repository.ErrCloudNotFound) {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Berkas tidak ditemukan"})
	}
	return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
}

// ---------------------------------------------------------------------------
// Config & list
// ---------------------------------------------------------------------------

func (h *CloudStorageHandler) Config(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":         true,
		"enabled":         h.Svc.Enabled(),
		"max_upload_size": h.Svc.MaxUploadBytes(),
	})
}

func (h *CloudStorageHandler) Usage(c echo.Context) error {
	used, count, err := h.Svc.Usage(ownerID(c))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membaca pemakaian"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"used_bytes": used,
		"file_count": count,
	})
}

func (h *CloudStorageHandler) ListFiles(c echo.Context) error {
	var parentID *string
	if p := strings.TrimSpace(c.QueryParam("parent_id")); p != "" && p != "root" {
		parentID = &p
	}
	limit := 500
	if v := c.QueryParam("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}
	offset := 0
	if v := c.QueryParam("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	// View khusus: favorit / terbaru / ukuran besar (lintas folder).
	switch strings.ToLower(strings.TrimSpace(c.QueryParam("view"))) {
	case "starred":
		files, err := h.Svc.ListStarred(ownerID(c))
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat favorit"})
		}
		c.Response().Header().Set("X-Total-Count", strconv.Itoa(len(files)))
		return c.JSON(http.StatusOK, files)
	case "recent":
		files, err := h.Svc.ListRecent(ownerID(c))
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat terbaru"})
		}
		c.Response().Header().Set("X-Total-Count", strconv.Itoa(len(files)))
		return c.JSON(http.StatusOK, files)
	case "large":
		files, err := h.Svc.ListLarge(ownerID(c))
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat berkas besar"})
		}
		c.Response().Header().Set("X-Total-Count", strconv.Itoa(len(files)))
		return c.JSON(http.StatusOK, files)
	}

	opts := cloudstorage.ListOptions{
		Sort:    strings.TrimSpace(c.QueryParam("sort")),
		Type:    strings.TrimSpace(c.QueryParam("type")),
		Starred: c.QueryParam("starred") == "1",
		Limit:   limit,
		Offset:  offset,
	}
	files, total, err := h.Svc.ListFiltered(ownerID(c), parentID, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat berkas"})
	}
	c.Response().Header().Set("X-Total-Count", strconv.Itoa(total))
	c.Response().Header().Set("X-Has-More", strconv.FormatBool(offset+len(files) < total))
	return c.JSON(http.StatusOK, files)
}

// SetStar menyalakan/mematikan penanda favorit.
func (h *CloudStorageHandler) SetStar(c echo.Context) error {
	var req struct {
		Starred bool `json:"starred"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	f, err := h.Svc.SetStarred(ownerID(c), c.Param("id"), req.Starred)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, f)
}

// Reorder menetapkan urutan manual item dalam satu folder.
func (h *CloudStorageHandler) Reorder(c echo.Context) error {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	if err := h.Svc.Reorder(ownerID(c), req.IDs); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *CloudStorageHandler) GetFile(c echo.Context) error {
	f, err := h.Svc.Get(ownerID(c), c.Param("id"))
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, f)
}

func (h *CloudStorageHandler) CreateFolder(c echo.Context) error {
	var req struct {
		Name     string  `json:"name"`
		ParentID *string `json:"parent_id"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	f, err := h.Svc.CreateFolder(ownerID(c), req.Name, req.ParentID)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, f)
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

func (h *CloudStorageHandler) Upload(c echo.Context) error {
	if !h.Svc.Enabled() {
		return c.JSON(http.StatusServiceUnavailable, map[string]interface{}{
			"success": false,
			"error":   "Cloud Storage belum dikonfigurasi (bot token/chat_id kosong)",
		})
	}
	// Batasi body sesuai konfigurasi (route ini dikecualikan dari BodyLimit
	// global 60M di main.go).
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, h.Svc.MaxUploadBytes()+1<<20)

	fh, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Berkas wajib diunggah"})
	}
	if fh.Size > h.Svc.MaxUploadBytes() {
		return c.JSON(http.StatusRequestEntityTooLarge, map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Berkas melebihi batas %d MB", h.Svc.MaxUploadBytes()/(1024*1024)),
		})
	}
	src, err := fh.Open()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Gagal membuka berkas"})
	}
	defer src.Close()

	var parentID *string
	if p := strings.TrimSpace(c.FormValue("parent_id")); p != "" && p != "root" {
		parentID = &p
	}

	f, err := h.Svc.Upload(c.Request().Context(), ownerID(c), src, fh, parentID)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, f)
}

// ---------------------------------------------------------------------------
// Rename / Move / Copy / Trash
// ---------------------------------------------------------------------------

func (h *CloudStorageHandler) Rename(c echo.Context) error {
	var req struct {
		Name string `json:"name"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	f, err := h.Svc.Rename(ownerID(c), c.Param("id"), req.Name)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, f)
}

func (h *CloudStorageHandler) Move(c echo.Context) error {
	var req struct {
		IDs      []string `json:"ids"`
		TargetID *string  `json:"target_id"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	if err := h.Svc.Move(ownerID(c), req.IDs, req.TargetID); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *CloudStorageHandler) Copy(c echo.Context) error {
	var req struct {
		IDs      []string `json:"ids"`
		TargetID *string  `json:"target_id"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	if err := h.Svc.Copy(c.Request().Context(), ownerID(c), req.IDs, req.TargetID); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *CloudStorageHandler) Trash(c echo.Context) error {
	if err := h.Svc.Trash(ownerID(c), c.Param("id")); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *CloudStorageHandler) ListTrash(c echo.Context) error {
	files, err := h.Svc.ListTrash(ownerID(c))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat trash"})
	}
	return c.JSON(http.StatusOK, files)
}

func (h *CloudStorageHandler) Restore(c echo.Context) error {
	if err := h.Svc.Restore(ownerID(c), c.Param("id")); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *CloudStorageHandler) RestoreAll(c echo.Context) error {
	if err := h.Svc.RestoreAll(ownerID(c)); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *CloudStorageHandler) PermanentDelete(c echo.Context) error {
	if err := h.Svc.PermanentDelete(c.Request().Context(), ownerID(c), c.Param("id")); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *CloudStorageHandler) EmptyTrash(c echo.Context) error {
	if err := h.Svc.EmptyTrash(c.Request().Context(), ownerID(c)); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *CloudStorageHandler) Search(c echo.Context) error {
	files, err := h.Svc.Search(ownerID(c), c.QueryParam("q"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mencari"})
	}
	return c.JSON(http.StatusOK, files)
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

func (h *CloudStorageHandler) CreateShare(c echo.Context) error {
	token, err := h.Svc.CreateShare(ownerID(c), c.Param("id"), h.ExpiryDays)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "share_token": token})
}

func (h *CloudStorageHandler) RevokeShare(c echo.Context) error {
	if err := h.Svc.RevokeShare(ownerID(c), c.Param("id")); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ShareInfo (publik) mengembalikan metadata minimal untuk halaman share.
func (h *CloudStorageHandler) ShareInfo(c echo.Context) error {
	f, err := h.Svc.GetSharedFile(c.Param("token"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Link tidak valid atau kadaluarsa"})
	}
	resp := map[string]interface{}{
		"success":   true,
		"name":      f.Name,
		"size":      f.Size,
		"mime_type": f.MimeType,
		"is_folder": f.IsFolder,
	}
	if f.ShareExpiresAt != nil {
		resp["expires_at"] = *f.ShareExpiresAt
	}
	if f.IsFolder {
		entries, lerr := h.Svc.ListSharedFolder(c.Param("token"))
		if lerr != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat isi folder"})
		}
		resp["entries"] = entries
	}
	return c.JSON(http.StatusOK, resp)
}

// ShareDiskDownload (publik) menyajikan berkas di dalam folder yang dibagikan.
func (h *CloudStorageHandler) ShareDiskDownload(c echo.Context) error {
	f, err := h.Svc.SharedFileByID(c.Param("token"), c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Berkas tidak ditemukan"})
	}
	return h.streamFile(c, f)
}

// ShareZip (publik) mengunduh isi folder yang dibagikan sebagai ZIP.
func (h *CloudStorageHandler) ShareZip(c echo.Context) error {
	token := c.Param("token")
	root, err := h.Svc.GetSharedFile(token)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Link tidak valid atau kadaluarsa"})
	}
	return h.writeZip(c, root.Name, func(w io.Writer) (int64, error) {
		return h.Svc.StreamZipShared(c.Request().Context(), token, w)
	})
}

// ---------------------------------------------------------------------------
// Download / thumbnail
// ---------------------------------------------------------------------------

func (h *CloudStorageHandler) Download(c echo.Context) error {
	f, err := h.Svc.Get(ownerID(c), c.Param("id"))
	if err != nil {
		return cloudErr(c, err)
	}
	// Catat akses (best-effort) agar view "Terbaru" akurat.
	h.Svc.TouchAccessed(ownerID(c), f.ID)
	return h.streamFile(c, f)
}

func (h *CloudStorageHandler) DownloadShared(c echo.Context) error {
	f, err := h.Svc.GetSharedFile(c.Param("token"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Link tidak valid atau kadaluarsa"})
	}
	return h.streamFile(c, f)
}

// streamFile menyajikan isi berkas (mendukung HTTP Range untuk seek media).
func (h *CloudStorageHandler) streamFile(c echo.Context, f *models.CloudFile) error {
	disposition := "inline"
	if c.QueryParam("dl") == "1" {
		disposition = "attachment"
	}

	rangeHeader := c.Request().Header.Get("Range")
	res, err := h.Svc.OpenStream(c.Request().Context(), f, rangeHeader)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]interface{}{"success": false, "error": err.Error()})
	}
	defer res.Body.Close()

	contentType := res.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	hd := c.Response().Header()
	hd.Set(echo.HeaderContentType, contentType)
	hd.Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, sanitizeFilename(f.Name)))
	hd.Set("Accept-Ranges", "bytes")
	hd.Set("X-Content-Type-Options", "nosniff")
	if f.ShareToken != nil {
		hd.Set("Cache-Control", "public, max-age=3600")
	} else {
		hd.Set("Cache-Control", "private, max-age=3600")
	}

	status := http.StatusOK
	if res.Partial {
		status = http.StatusPartialContent
		if res.ContentRange != "" {
			hd.Set("Content-Range", res.ContentRange)
		} else if cr := c.Request().Header.Get("Range"); cr != "" {
			hd.Set("Content-Range", contentRangeOf(cr, res.Size))
		}
	}
	return c.Stream(status, contentType, res.Body)
}

func (h *CloudStorageHandler) Thumbnail(c echo.Context) error {
	owner := ownerID(c)
	f, err := h.Svc.Get(owner, c.Param("id"))
	if err != nil {
		return cloudErr(c, err)
	}
	data, ct, err := h.Svc.GetThumbnail(c.Request().Context(), f)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Thumbnail tidak tersedia"})
	}
	c.Response().Header().Set("Cache-Control", "private, max-age=86400")
	return c.Blob(http.StatusOK, ct, data)
}

// ---------------------------------------------------------------------------
// ZIP massal
// ---------------------------------------------------------------------------

// Zip mengunduh sekumpulan item (file/folder) sebagai satu arsip ZIP.
func (h *CloudStorageHandler) Zip(c echo.Context) error {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	if len(req.IDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tidak ada item dipilih"})
	}
	// Nama arsip: nama tunggal bila satu item, selain itu "cloud-storage.zip".
	archiveName := "cloud-storage"
	if len(req.IDs) == 1 {
		if f, err := h.Svc.Get(ownerID(c), req.IDs[0]); err == nil {
			archiveName = strings.TrimSuffix(f.Name, filepath.Ext(f.Name))
			if f.IsFolder {
				archiveName = f.Name
			}
		}
	}
	return h.writeZip(c, archiveName, func(w io.Writer) (int64, error) {
		return h.Svc.StreamZip(c.Request().Context(), ownerID(c), req.IDs, w)
	})
}

// writeZip menyiapkan header unduhan lalu menulis arsip via writeFn.
func (h *CloudStorageHandler) writeZip(c echo.Context, name string, writeFn func(io.Writer) (int64, error)) error {
	if name == "" {
		name = "cloud-storage"
	}
	hd := c.Response().Header()
	hd.Set(echo.HeaderContentType, "application/zip")
	hd.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.zip"`, sanitizeFilename(name)))
	hd.Set("X-Content-Type-Options", "nosniff")
	hd.Set("Cache-Control", "private, no-store")

	c.Response().WriteHeader(http.StatusOK)
	if _, err := writeFn(c.Response()); err != nil {
		// Header sudah terkirim; tidak bisa lagi mengubah status. Catat saja.
		return err
	}
	return nil
}

// ---------------------------------------------------------------------------
// Editor teks / catatan cepat
// ---------------------------------------------------------------------------

// CreateNote membuat catatan teks baru.
func (h *CloudStorageHandler) CreateNote(c echo.Context) error {
	var req struct {
		Name     string  `json:"name"`
		Content  string  `json:"content"`
		ParentID *string `json:"parent_id"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	f, err := h.Svc.CreateNote(c.Request().Context(), ownerID(c), req.Name, req.Content, req.ParentID)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, f)
}

// UpdateContent mengganti isi berkas teks.
func (h *CloudStorageHandler) UpdateContent(c echo.Context) error {
	var req struct {
		Content string `json:"content"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	f, err := h.Svc.UpdateTextContent(c.Request().Context(), ownerID(c), c.Param("id"), req.Content)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, f)
}

// Rotate memutar gambar 90/180/270 derajat.
func (h *CloudStorageHandler) Rotate(c echo.Context) error {
	var req struct {
		Deg int `json:"deg"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	f, err := h.Svc.RotateImage(c.Request().Context(), ownerID(c), c.Param("id"), req.Deg)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, f)
}

// sanitizeFilename membersihkan nama berkas agar aman dipakai di header.
func sanitizeFilename(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, `"`, "")
	name = strings.ReplaceAll(name, "\r", "")
	name = strings.ReplaceAll(name, "\n", "")
	if name == "" || name == "." || name == "/" {
		name = "file"
	}
	return name
}

// contentRangeOf menyusun header Content-Range dari header Range klien + total.
// Mendukung bentuk paling umum "bytes=start-end".
func contentRangeOf(rangeHeader string, total int64) string {
	if total < 0 {
		return ""
	}
	spec := strings.TrimPrefix(rangeHeader, "bytes=")
	parts := strings.SplitN(spec, "-", 2)
	if len(parts) != 2 {
		return ""
	}
	startStr := strings.TrimSpace(parts[0])
	endStr := strings.TrimSpace(parts[1])
	var start, end int64
	if startStr == "" {
		// suffix range: bytes=-N (N byte terakhir)
		n, err := strconv.ParseInt(endStr, 10, 64)
		if err != nil || n <= 0 {
			return ""
		}
		start = total - n
		if start < 0 {
			start = 0
		}
		end = total - 1
	} else {
		s, err := strconv.ParseInt(startStr, 10, 64)
		if err != nil {
			return ""
		}
		start = s
		if endStr == "" {
			end = total - 1
		} else {
			e, err := strconv.ParseInt(endStr, 10, 64)
			if err != nil {
				return ""
			}
			end = e
		}
	}
	if end >= total {
		end = total - 1
	}
	if start > end || start < 0 {
		return ""
	}
	return fmt.Sprintf("bytes %d-%d/%d", start, end, total)
}
