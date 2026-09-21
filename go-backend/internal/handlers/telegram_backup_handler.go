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
	"github.com/sekolahku/go-backend/internal/shared"
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
	// Sertakan status enkripsi (tanpa membocorkan password-nya) supaya admin
	// tahu backup yang dikirim sudah terenkripsi atau masih plain.
	return c.JSON(http.StatusOK, map[string]interface{}{
		"botToken":          settings.BotToken,
		"chatId":            settings.ChatID,
		"isEnabled":         settings.IsEnabled,
		"lastBackupAt":      settings.LastBackupAt,
		"encryptionEnabled": BackupEncryptionEnabled(),
	})
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
		// Detail error (response API Telegram, path server) hanya di log.
		c.Logger().Errorf("backup telegram gagal: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal mengirim backup ke Telegram"})
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

	// Backup terenkripsi (envelope "SKBP") didekripsi dulu ke zip plain.
	// Plain zip lawas tetap dikenali dan langsung diekstrak.
	if encrypted, err := decryptFileIfNeeded(tempPath, tempPath+".dec.zip"); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	} else if encrypted {
		os.Remove(tempPath)
		tempPath = tempPath + ".dec.zip"
		defer os.Remove(tempPath)
	}

	// Open zip
	r, err := zip.OpenReader(tempPath)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File bukan merupakan zip yang valid"})
	}
	defer r.Close()

	// Ekstrak dengan pengamanan zip-slip: semua entri dipaksa mendarat di
	// dalam direktori aplikasi.
	if err := extractZipSecurely(tempPath, restoreBaseDir()); err != nil {
		c.Logger().Errorf("gagal memulihkan backup: %v", err)
		return shared.InternalError(c)
	}

	// Schedule restart
	go func() {
		time.Sleep(2 * time.Second)
		os.Exit(0)
	}()

	return c.JSON(http.StatusOK, map[string]string{"message": "Backup berhasil dipulihkan. Server akan restart dalam beberapa detik."})
}

// restoreBaseDir adalah direktori akar aplikasi — satu-satunya tempat entri
// backup boleh ditulis. Backup dibuat oleh createBackupZip() dengan path
// relatif terhadap working directory (filepath.ToSlash(path)), sehingga
// pemulihan harus mengembalikannya ke akar yang sama.
func restoreBaseDir() string {
	if wd, err := os.Getwd(); err == nil {
		return filepath.Clean(wd)
	}
	return "."
}

// extractZipSecurely mengekstrak zip ke dalam destDir dengan pengamanan
// zip-slip. Semua entri yang mencoba keluar dari destDir (path absolut,
// awalan "../", symlink) dilewati. File dibuat dengan mode aman (bukan mode
// dari dalam zip) agar tidak ada file world-writable.
func extractZipSecurely(zipPath, destDir string) error {
	base := filepath.Clean(destDir)

	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		// Tolak entri symlink: symlink bisa diarahkan keluar dari destDir lalu
		// dipakai untuk menimpa file di luar (variasi zip-slip).
		if f.FileInfo().Mode()&os.ModeSymlink != 0 {
			continue
		}

		// Paksa nama entri jadi relatif, lalu gabungkan ke base. Tanpa
		// filepath.Join ke base, path absolut seperti "/etc/passwd" (yang tidak
		// berawalan "..") akan lolos dan ditulis di luar destDir.
		cleaned := filepath.Clean(filepath.Join("/", filepath.FromSlash(f.Name)))
		destPath := filepath.Join(base, cleaned)

		// Verifikasi hasil akhir masih berada di dalam base.
		// Menambahkan separator mencegah lolosnya sibling seperti
		// "/app-backup" ketika base adalah "/app".
		if destPath != base && !strings.HasPrefix(destPath, base+string(os.PathSeparator)) {
			continue
		}

		if f.FileInfo().IsDir() {
			// Mode direktori aman (tidak memakai os.ModePerm).
			_ = os.MkdirAll(destPath, 0o755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
			continue
		}

		// Mode file aman: 0644 untuk file biasa, 0755 bila executable.
		// Tidak memakai f.Mode() mentah yang bisa 0777.
		mode := os.FileMode(0o644)
		if f.Mode().Perm()&0o111 != 0 {
			mode = 0o755
		}

		outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
		if err != nil {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			continue
		}

		_, _ = io.Copy(outFile, rc)

		outFile.Close()
		rc.Close()
	}

	return nil
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

	// Enkripsi backup bila password diset (env BACKUP_ZIP_PASSWORD).
	// Tanpa ini, seluruh PII siswa terkirim plain ke server Telegram.
	sendPath := zipPath
	if password := backupPassword(); password != "" {
		encPath := zipPath + ".enc"
		if err := encryptFile(encPath, zipPath, password); err != nil {
			return fmt.Errorf("gagal mengenkripsi backup: %v", err)
		}
		defer os.Remove(encPath)
		sendPath = encPath
	} else {
		fmt.Println("⚠ BACKUP_ZIP_PASSWORD kosong — backup dikirim TANPA enkripsi. Set di .env server.")
	}

	file, err := os.Open(sendPath)
	if err != nil {
		return fmt.Errorf("gagal membuka file backup: %v", err)
	}
	defer file.Close()

	// Create multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add chat_id field
	_ = writer.WriteField("chat_id", chatID)

	// Add caption
	encNote := "🔓 TANPA enkripsi — set BACKUP_ZIP_PASSWORD!"
	if BackupEncryptionEnabled() {
		encNote = "🔒 AES-256-GCM (enkripsi server-side)"
	}
	caption := fmt.Sprintf("📦 *Backup Lengkap Sekolahku*\n📅 Waktu: %s\n📁 Isi: Database & Folder Uploads\n%s", time.Now().Format("2006-01-02 15:04:05"), encNote)
	_ = writer.WriteField("caption", caption)
	_ = writer.WriteField("parse_mode", "Markdown")

	// Add file field
	ext := ".zip"
	if BackupEncryptionEnabled() {
		ext = ".zip.enc"
	}
	filename := fmt.Sprintf("sekolahku_full_backup_%s%s", time.Now().Format("20060102_150405"), ext)
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
