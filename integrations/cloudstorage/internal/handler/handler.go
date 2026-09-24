package handler
import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"mime"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"cloudstorage/internal/model"
	"cloudstorage/internal/service"
)
"time"

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}
func (h *Handler) GetConfig(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"auth_required":   h.svc.AuthRequired(),
		"max_upload_size": h.svc.MaxUploadSize(),
	})
}

func (h *Handler) internalError(c *fiber.Ctx, err error) error {
	log.Printf("internal error: %v", err)
	// Standardized error response with error code
	errorMsg := "internal error"
	if fiberErr, ok := err.(*fiber.Error); ok {
		errorMsg = fiberErr.Message
	}
	return c.Status(fiberErr.Code).JSON(fiber.Map{
		"error":        errorMsg,
		"error_code":   fmt.Sprintf("ERR_INTERNAL_%d", fiberErr.Code),
		"error_timestamp": time.Now().Unix(),
	})
}

func (h *Handler) businessError(c *fiber.Ctx, err error, code string) error {
	log.Printf("business error: %v", err)
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
		"error":        err.Error(),
		"error_code":   code,
		"error_timestamp": time.Now().Unix(),
	})
}

func (h *Handler) byIDError(c *fiber.Ctx, err error, notFoundMsg string) error {
	if errors.Is(err, sql.ErrNoRows) {
		return c.Status(404).JSON(fiber.Map{
			"error":        notFoundMsg,
			"error_code":   "ERR_NOT_FOUND",
			"error_timestamp": time.Now().Unix(),
		})
	}
	return h.internalError(c, err)

func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	if h.svc.Repo.DB == nil {
		return c.Status(503).JSON(fiber.Map{
			"status": "unhealthy",
			"error": "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}
	// Check Telegram API configuration
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}
	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}
	return c.JSON(health)
}
func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	db := h.svc.Repo.DB
	if err := db.Ping(); err != nil {
		return c.Status(503).JSON(fiber.Map{
			"status":  "unhealthy",
			"error":   "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}

	// Check Telegram API configuration status
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}

	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}

	return c.JSON(health)
}
	}
	limit, _ := strconv.Atoi(c.Query("limit", "500"))
	if limit <= 0 || limit > 1000 {
		limit = 500
	}
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if offset < 0 {
		offset = 0
	}

	files, err := h.svc.ListFilesPage(pid, limit, offset)
	if err != nil {
		return h.internalError(c, err)

func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	if h.svc.Repo.DB == nil {
		return c.Status(503).JSON(fiber.Map{
			"status": "unhealthy",
			"error": "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}
	// Check Telegram API configuration
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}
	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}
	return c.JSON(health)
}
	}
	total, err := h.svc.CountFiles(pid)
	if err != nil {
		return h.internalError(c, err)

func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	if h.svc.Repo.DB == nil {
		return c.Status(503).JSON(fiber.Map{
			"status": "unhealthy",
			"error": "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}
	// Check Telegram API configuration
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}
	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}
	return c.JSON(health)
}
	}

	c.Set("X-Total-Count", strconv.Itoa(total))
	c.Set("X-Has-More", strconv.FormatBool(offset+len(files) < total))
	return c.JSON(files)
}

func (h *Handler) UploadFile(c *fiber.Ctx) error {
	parentID := c.FormValue("parent_id")
	var pid *string
	if parentID != "" {
		pid = &parentID
	}
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid multipart form"})
	}
	files := form.File["file"]
	if len(files) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "file is required"})
	}

	var uploadedFiles []model.File
	var uploadErrors []model.UploadError
	for _, file := range files {
		src, err := file.Open()
		if err != nil {
			uploadErrors = append(uploadErrors, model.UploadError{Name: file.Filename, Error: err.Error()})
			continue
		}

		f, err := h.svc.UploadFile(src, file, pid)
		src.Close()
		if err != nil {
			log.Printf("upload failed: name=%q size=%d err=%v", file.Filename, file.Size, err)
			uploadErrors = append(uploadErrors, model.UploadError{Name: file.Filename, Error: err.Error()})
			continue
		}
		log.Printf("uploaded: id=%s name=%q size=%d", f.ID, f.Name, f.Size)
		uploadedFiles = append(uploadedFiles, *f)
	}

	if len(uploadedFiles) == 0 {
		if len(uploadErrors) == 1 {
			return c.Status(500).JSON(fiber.Map{"error": uploadErrors[0].Error, "name": uploadErrors[0].Name})
		}
		return c.Status(500).JSON(fiber.Map{"error": "semua upload gagal", "errors": uploadErrors})
	}

	if len(uploadErrors) == 0 {
		if len(uploadedFiles) == 1 {
			return c.JSON(uploadedFiles[0])
		}
		return c.JSON(uploadedFiles)
	}

	return c.Status(207).JSON(model.UploadResponse{Files: uploadedFiles, Errors: uploadErrors})
}

func (h *Handler) ListAllFolders(c *fiber.Ctx) error {
	folders, err := h.svc.ListAllFolders()
	if err != nil {
		return h.internalError(c, err)

func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	if h.svc.Repo.DB == nil {
		return c.Status(503).JSON(fiber.Map{
			"status": "unhealthy",
			"error": "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}
	// Check Telegram API configuration
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}
	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}
	return c.JSON(health)
}
	}
	return c.JSON(folders)
}

func (h *Handler) CreateFolder(c *fiber.Ctx) error {
	var req model.CreateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	f, err := h.svc.CreateFolder(req.Name, req.ParentID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(f)
}

func (h *Handler) GetFile(c *fiber.Ctx) error {
	id := c.Params("id")
	f, err := h.svc.GetFile(id)
	if err != nil {
		return h.byIDError(c, err, "file not found")
	}
	return c.JSON(f)
}

func (h *Handler) RenameFile(c *fiber.Ctx) error {
	id := c.Params("id")
	var req model.RenameRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	f, err := h.svc.RenameFile(id, req.Name)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(f)
}

func (h *Handler) DeleteFile(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.svc.DeleteFile(id); err != nil {
		return h.byIDError(c, err, "file not found")
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *Handler) CreateShareLink(c *fiber.Ctx) error {
	id := c.Params("id")
	token, err := h.svc.CreateShareLink(id)
	if err != nil {
		return h.byIDError(c, err, "file not found")
	}
	return c.JSON(fiber.Map{"share_token": token})
}

func (h *Handler) SharedPage(c *fiber.Ctx) error {
	token := c.Params("token")
	f, err := h.svc.GetSharedFile(token)
	if err != nil {
		return c.Status(404).SendString("File tidak ditemukan atau link sudah kadaluarsa.")
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s - Cloud Storage</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8f9fa; margin: 0; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%%; max-width: 400px; text-align: center; }
    h2 { margin: 16px 0 8px; color: #202124; font-size: 20px; word-break: break-all; }
    p { color: #5f6368; font-size: 14px; margin-bottom: 24px; }
    .btn { background: #1a73e8; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-block; width: 100%%; box-sizing: border-box; }
    .btn:hover { background: #1557b0; }
  </style>
</head>
<body>
  <div class="card">
    <svg width="64" height="64" viewBox="0 0 24 24" fill="#1a73e8"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
    <h2>%s</h2>
    <p>Ukuran: %d bytes</p>
    <a href="/s/%s/download" class="btn">⬇ Download File</a>
  </div>
</body>
</html>`, f.Name, f.Name, f.Size, token)

	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.SendString(html)
}

func (h *Handler) streamTelegramFile(c *fiber.Ctx, file *model.File, disposition, cacheControl string) error {
	resp, err := h.svc.DownloadTelegramFileWithRange(*file.FileID, c.Get("Range"))
	if err != nil {
		return h.internalError(c, err)

func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	if h.svc.Repo.DB == nil {
		return c.Status(503).JSON(fiber.Map{
			"status": "unhealthy",
			"error": "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}
	// Check Telegram API configuration
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}
	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}
	return c.JSON(health)
}
	}
	if cr := resp.Header.Get("Content-Range"); cr != "" {
		c.Set("Content-Range", cr)
	}
	if ar := resp.Header.Get("Accept-Ranges"); ar != "" {
		c.Set("Accept-Ranges", ar)
	}
	c.Set("Content-Disposition", disposition)
	if file.MimeType != "" {
		c.Set("Content-Type", file.MimeType)
	}
	if cacheControl != "" {
		c.Set("Cache-Control", cacheControl)
	}
	c.Status(resp.StatusCode)
	size := -1
	if resp.ContentLength >= 0 {
		size = int(resp.ContentLength)
	}
	return c.SendStream(resp.Body, size)
}

func (h *Handler) DownloadSharedFile(c *fiber.Ctx) error {
	token := c.Params("token")
	file, err := h.svc.GetSharedFile(token)
	if err != nil {
		return c.Status(404).SendString("File not found")
	}
	if file.FileID == nil {
		return c.Status(404).SendString("File not found on telegram")
	}
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": file.Name})
	return h.streamTelegramFile(c, file, disposition, "")
}

func (h *Handler) CopyFiles(c *fiber.Ctx) error {
	var req model.CopyMoveRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if len(req.IDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "ids required"})
	}
	if err := h.svc.CopyFiles(req.IDs, req.TargetID); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *Handler) Search(c *fiber.Ctx) error {
	query := c.Query("q")
	if query == "" {
		return c.JSON([]model.File{})
	}
	results, err := h.svc.Search(query)
	if err != nil {
		return h.internalError(c, err)

func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	if h.svc.Repo.DB == nil {
		return c.Status(503).JSON(fiber.Map{
			"status": "unhealthy",
			"error": "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}
	// Check Telegram API configuration
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}
	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}
	return c.JSON(health)
}
	}
	return c.JSON(results)
}

func (h *Handler) DownloadFile(c *fiber.Ctx) error {
	id := c.Params("id")
	file, err := h.svc.DownloadFile(id)
	if err != nil {
		return h.byIDError(c, err, "file not found")
	}
	if file.FileID == nil {
		return c.Status(404).JSON(fiber.Map{"error": "file not found on telegram"})
	}
	disposition := mime.FormatMediaType("inline", map[string]string{"filename": file.Name})
	return h.streamTelegramFile(c, file, disposition, "public, max-age=86400")
}

func (h *Handler) Thumbnail(c *fiber.Ctx) error {
	id := c.Params("id")
	data, contentType, err := h.svc.GetThumbnail(id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "thumbnail not available"})
	}
	c.Set("Content-Type", contentType)
	c.Set("Cache-Control", "public, max-age=86400")
	return c.Send(data)
}

func (h *Handler) MoveFiles(c *fiber.Ctx) error {
	var req model.CopyMoveRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if len(req.IDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "ids required"})
	}
	if err := h.svc.MoveFiles(req.IDs, req.TargetID); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *Handler) ListTrash(c *fiber.Ctx) error {
	files, err := h.svc.ListTrash()
	if err != nil {
		return h.internalError(c, err)

func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	if h.svc.Repo.DB == nil {
		return c.Status(503).JSON(fiber.Map{
			"status": "unhealthy",
			"error": "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}
	// Check Telegram API configuration
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}
	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}
	return c.JSON(health)
}
	}
	return c.JSON(files)
}

func (h *Handler) RestoreFile(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.svc.RestoreFile(id); err != nil {
		return h.byIDError(c, err, "file not found")
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *Handler) RestoreAll(c *fiber.Ctx) error {
	if err := h.svc.RestoreAll(); err != nil {
		return h.internalError(c, err)

func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	if h.svc.Repo.DB == nil {
		return c.Status(503).JSON(fiber.Map{
			"status": "unhealthy",
			"error": "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}
	// Check Telegram API configuration
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}
	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}
	return c.JSON(health)
}
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *Handler) EmptyTrash(c *fiber.Ctx) error {
	if err := h.svc.EmptyTrash(); err != nil {
		return h.internalError(c, err)

func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	// Check database connectivity
	if h.svc.Repo.DB == nil {
		return c.Status(503).JSON(fiber.Map{
			"status": "unhealthy",
			"error": "database connection failed",
			"error_code": "ERR_DB_CONNECT",
		})
	}
	// Check Telegram API configuration
	cfg := h.svc.Cfg
	health := fiber.Map{
		"status": "healthy",
		"database": "connected",
	}
	if cfg.TelegramAPI != "" {
		health["telegram_api"] = cfg.TelegramAPI
	} else {
		health["telegram_api"] = "not_configured"
	}
	return c.JSON(health)
}
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *Handler) PermanentDelete(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.svc.PermanentDelete(id); err != nil {
		return h.byIDError(c, err, "file not found")
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *Handler) RevokeShare(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.svc.RevokeShareLink(id); err != nil {
		return h.byIDError(c, err, "file not found")
	}
	return c.JSON(fiber.Map{"status": "ok"})
}
