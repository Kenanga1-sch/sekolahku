package handlers

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type TelegramBackupHandler struct {
	repo *repository.TelegramBackupRepository
}

func NewTelegramBackupHandler(repo *repository.TelegramBackupRepository) *TelegramBackupHandler {
	return &TelegramBackupHandler{repo: repo}
}

func (h *TelegramBackupHandler) GetSettings(c echo.Context) error {
	settings, err := h.repo.GetSettings()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal mengambil pengaturan backup Telegram"})
	}
	return c.JSON(http.StatusOK, settings)
}

func (h *TelegramBackupHandler) UpdateSettings(c echo.Context) error {
	var settings models.TelegramBackupSettings
	if err := c.Bind(&settings); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data tidak valid"})
	}

	if err := h.repo.UpdateSettings(&settings); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan pengaturan"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Pengaturan backup berhasil disimpan"})
}

func (h *TelegramBackupHandler) TestBackup(c echo.Context) error {
	settings, err := h.repo.GetSettings()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal mengambil pengaturan"})
	}

	if settings.BotToken == "" || settings.ChatID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Bot Token dan Chat ID harus diisi terlebih dahulu"})
	}

	err = SendBackupToTelegram(settings.BotToken, settings.ChatID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Gagal mengirim backup: %v", err)})
	}

	// Update last backup time
	_ = h.repo.UpdateLastBackupTime()

	return c.JSON(http.StatusOK, map[string]string{"message": "Backup berhasil dikirim ke Telegram"})
}

func (h *TelegramBackupHandler) RestoreBackup(c echo.Context) error {
	// Parse multipart form
	file, err := c.FormFile("backup_file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File backup tidak ditemukan"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuka file upload"})
	}
	defer src.Close()

	// Save to temp file
	tempFile, err := os.CreateTemp("", "restore_*.zip")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat file temporary"})
	}
	tempPath := tempFile.Name()
	defer os.Remove(tempPath)
	defer tempFile.Close()

	if _, err = io.Copy(tempFile, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan file temporary"})
	}
	
	// Close tempFile so it can be read by zip reader
	tempFile.Close()

	// Open zip
	r, err := zip.OpenReader(tempPath)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File bukan merupakan zip yang valid"})
	}
	defer r.Close()

	// Extract
	for _, f := range r.File {
		// Prevent zip slip vulnerability
		cleanedPath := filepath.Clean(f.Name)
		if strings.HasPrefix(cleanedPath, "..") {
			continue
		}

		destPath := cleanedPath

		// Ensure directories exist
		if f.FileInfo().IsDir() {
			os.MkdirAll(destPath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), os.ModePerm); err != nil {
			continue
		}

		// Write file
		outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			continue
		}

		io.Copy(outFile, rc)
		
		outFile.Close()
		rc.Close()
	}

	// Schedule restart
	go func() {
		time.Sleep(2 * time.Second)
		os.Exit(0)
	}()

	return c.JSON(http.StatusOK, map[string]string{"message": "Backup berhasil dipulihkan. Server akan restart dalam beberapa detik."})
}

// SendBackupToTelegram is a helper function to send the backup to Telegram
func SendBackupToTelegram(botToken, chatID string) error {
	// Create zip backup
	zipPath, err := createBackupZip()
	if err != nil {
		return fmt.Errorf("gagal membuat file zip backup: %v", err)
	}
	// Clean up after sending
	defer os.Remove(zipPath)

	file, err := os.Open(zipPath)
	if err != nil {
		return fmt.Errorf("gagal membuka file zip: %v", err)
	}
	defer file.Close()

	// Create multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add chat_id field
	_ = writer.WriteField("chat_id", chatID)
	
	// Add caption
	caption := fmt.Sprintf("📦 *Backup Lengkap Sekolahku*\n📅 Waktu: %s\n📁 Isi: Database & Folder Uploads", time.Now().Format("2006-01-02 15:04:05"))
	_ = writer.WriteField("caption", caption)
	_ = writer.WriteField("parse_mode", "Markdown")

	// Add file field
	filename := fmt.Sprintf("sekolahku_full_backup_%s.zip", time.Now().Format("20060102_150405"))
	part, err := writer.CreateFormFile("document", filename)
	if err != nil {
		return err
	}
	
	_, err = io.Copy(part, file)
	if err != nil {
		return err
	}
	
	err = writer.Close()
	if err != nil {
		return err
	}

	// Make HTTP request
	telegramAPI := os.Getenv("TELEGRAM_API_URL")
	if telegramAPI == "" {
		telegramAPI = "https://api.telegram.org"
	}
	url := fmt.Sprintf("%s/bot%s/sendDocument", telegramAPI, botToken)
	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 300 * time.Second} // Longer timeout for large uploads
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

func createBackupZip() (string, error) {
	tempFile, err := os.CreateTemp("", "sekolahku_backup_*.zip")
	if err != nil {
		return "", err
	}
	
	zipPath := tempFile.Name()
	
	zipWriter := zip.NewWriter(tempFile)

	addPathToZip := func(basePath string) error {
		return filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				if os.IsNotExist(err) {
					return nil
				}
				return err
			}
            
			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return err
			}
			header.Name = filepath.ToSlash(path)

			if info.IsDir() {
				header.Name += "/"
			} else {
				header.Method = zip.Deflate
			}

			writer, err := zipWriter.CreateHeader(header)
			if err != nil {
				return err
			}

			if info.IsDir() {
				return nil
			}

			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()

			_, err = io.Copy(writer, file)
			return err
		})
	}

	pathsToBackup := []string{
		filepath.Join("data", "sekolahku.db"),
		filepath.Join("public", "uploads"),
		"uploads",
	}

	for _, p := range pathsToBackup {
		_ = addPathToZip(p)
	}
	
	zipWriter.Close()
	tempFile.Close()

	return zipPath, nil
}
