package handlers

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
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
	db   *sql.DB
}

func NewTelegramBackupHandler(repo *repository.TelegramBackupRepository, db *sql.DB) *TelegramBackupHandler {
	return &TelegramBackupHandler{repo: repo, db: db}
}

// NewTelegramBackupHandlerNoDB dipakai saat handler dibuat tanpa akses DB
// (mis. uji). Backup tetap jalan, hanya tanpa snapshot VACUUM INTO.
func NewTelegramBackupHandlerNoDB(repo *repository.TelegramBackupRepository) *TelegramBackupHandler {
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

	err = SendBackupToTelegram(settings.BotToken, settings.ChatID, h.db)
	if err != nil {
		// Detail error (response API Telegram, path server) hanya di log.
		c.Logger().Errorf("backup telegram gagal: %v", err)
		// Beri tahu lewat chat agar kegagalan uji backup tidak senyap.
		NotifyBackupFailure(settings.BotToken, settings.ChatID, err.Error())
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal mengirim backup ke Telegram"})
	}

	// Update last backup time
	_ = h.repo.UpdateLastBackupTime()

	return c.JSON(http.StatusOK, map[string]string{"message": "Backup berhasil dikirim ke Telegram"})
}

// backupTempDir adalah direktori file sementara untuk alur backup/restore.
//
// JANGAN pakai /tmp container: deploy.sh me-mount-nya sebagai tmpfs 64MB,
// sementara backup butuh ~2-3x ukurannya serentak (zip + snapshot + .enc).
// data/ adalah volume disk host (lega), jadi temp pindah ke data/tmp.
// Bisa di-override via env BACKUP_TMP_DIR bila diperlukan.
func backupTempDir() string {
	if dir := os.Getenv("BACKUP_TMP_DIR"); dir != "" {
		_ = os.MkdirAll(dir, 0o700)
		return dir
	}
	dir := filepath.Join("data", "tmp")
	_ = os.MkdirAll(dir, 0o700)
	return dir
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

	// Save to temp file (di data/tmp, bukan /tmp container yang cuma 64MB).
	tempFile, err := os.CreateTemp(backupTempDir(), "restore_*.zip")
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

	// Snapshot pengaman SEBELUM menimpa apapun. Bila ekstrak gagal di tengah,
	// admin masih bisa memulihkan data lama dari salinan ini.
	snapshotDir, snapshotErr := createPreRestoreSnapshot()
	if snapshotErr != nil {
		c.Logger().Errorf("gagal membuat snapshot pengaman: %v", snapshotErr)
		// Lanjut saja — restore adalah satu-satunya cara memulihkan, dan
		// kegagalan snapshot tidak boleh menghentikan proses.
	} else {
		defer os.RemoveAll(snapshotDir)
		c.Logger().Infof("snapshot pengaman: %s", snapshotDir)
	}

	// KRITIS: buang DB lama beserta WAL/SHM sebelum ekstraksi.
	//
	// Bila file .db lama ditimpa sementara WAL/SHM lamanya masih ada, SQLite
	// akan menerapkan WAL lama ke atas DB baru → "malformed database schema".
	// Jadi kita pindahkan (rename) ketiganya keluar dari jalur, bukan sekadar
	// menimpanya. File DB hasil restore ditulis bersih dari zip.
	if err := quarantineDatabaseFiles(); err != nil {
		c.Logger().Errorf("gagal memindahkan DB lama: %v", err)
		return shared.InternalError(c)
	}

	// Ekstrak dengan pengamanan zip-slip: semua entri dipaksa mendarat di
	// dalam direktori aplikasi.
	if err := extractZipSecurely(tempPath, restoreBaseDir()); err != nil {
		c.Logger().Errorf("gagal memulihkan backup: %v", err)
		return shared.InternalError(c)
	}

	// Pastikan tidak ada WAL/SHM sisa yang menyertai DB hasil restore.
	removeDatabaseSidecars()

	// Verifikasi integritas DB hasil restore sebelum restart. Jangan restart
	// server di atas DB yang rusak — lebih baik laporkan kesalahan.
	if err := verifyRestoredDatabase(); err != nil {
		c.Logger().Errorf("DB hasil restore tidak sehat: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Backup diekstrak tetapi database hasil restore tidak sehat: " + err.Error(),
		})
	}

	// Schedule restart
	go func() {
		time.Sleep(2 * time.Second)
		os.Exit(0)
	}()

	return c.JSON(http.StatusOK, map[string]string{"message": "Backup berhasil dipulihkan. Server akan restart dalam beberapa detik."})
}

// quarantineDatabaseFiles memindahkan DB lama beserta WAL/SHM ke nama sementara
// (.old) agar ekstraksi restore menulis DB bersih. Ini mencegah WAL lama
// diterapkan ke DB baru oleh SQLite ("malformed database schema").
func quarantineDatabaseFiles() error {
	for _, name := range []string{"sekolahku.db", "sekolahku.db-wal", "sekolahku.db-shm"} {
		path := filepath.Join("data", name)
		if _, err := os.Stat(path); err != nil {
			continue
		}
		old := path + ".restore-old"
		_ = os.Remove(old)
		if err := os.Rename(path, old); err != nil {
			return err
		}
	}
	return nil
}

// removeDatabaseSidecars menghapus WAL/SHM yang mungkin tersisa. Zip backup
// tidak menyertakan keduanya (hanya snapshot via VACUUM INTO), jadi seharusnya
// bersih — ini hanya jaring pengaman.
func removeDatabaseSidecars() {
	for _, name := range []string{"sekolahku.db-wal", "sekolahku.db-shm"} {
		_ = os.Remove(filepath.Join("data", name))
	}
}

// createPreRestoreSnapshot menyalin data DB, uploads, dan public/uploads ke
// direktori sementara sebelum restore menimpanya. Memberi jaring pengaman
// bila ekstraksi rusak.
func createPreRestoreSnapshot() (string, error) {
	snapDir, err := os.MkdirTemp(backupTempDir(), "sekolahku_prerestore_*")
	if err != nil {
		return "", err
	}

	for _, src := range []string{
		filepath.Join("data", "sekolahku.db"),
		filepath.Join("data", "sekolahku.db-wal"),
		filepath.Join("data", "sekolahku.db-shm"),
		"uploads",
		filepath.Join("public", "uploads"),
	} {
		dst := filepath.Join(snapDir, src)
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			continue
		}
		info, err := os.Stat(src)
		if err != nil {
			continue // path mungkin tidak ada di deployment tertentu
		}
		if info.IsDir() {
			_ = copyDirTree(src, dst)
		} else {
			_ = copySingleFile(src, dst)
		}
	}

	return snapDir, nil
}

func copySingleFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func copyDirTree(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // lewati error baca, lanjutkan file lain
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return nil
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		return copySingleFile(path, target)
	})
}

// verifyRestoredDatabase memeriksa DB hasil restore lulus integrity_check.
func verifyRestoredDatabase() error {
	dbPath := filepath.Join("data", "sekolahku.db")
	if _, err := os.Stat(dbPath); err != nil {
		return fmt.Errorf("database tidak ditemukan setelah restore")
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("gagal membuka DB hasil restore: %w", err)
	}
	defer db.Close()
	var res string
	if err := db.QueryRow("PRAGMA integrity_check").Scan(&res); err != nil {
		return fmt.Errorf("gagal menjalankan integrity_check: %w", err)
	}
	if res != "ok" {
		return fmt.Errorf("integrity_check mengembalikan: %s", res)
	}
	return nil
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

// SendBackupToTelegram is a helper function to send the backup to Telegram.
// db dipakai untuk snapshot DB yang konsisten (VACUUM INTO). Bila nil, backup
// tetap dibuat memakai salinan file mentah (fallback, tanpa jaminan WAL).
func SendBackupToTelegram(botToken, chatID string, db *sql.DB) error {
	// Create zip backup
	zipPath, err := createBackupZip(db)
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

// NotifyBackupFailure mengirim pesan peringatan ke chat Telegram yang sama
// saat backup gagal, supaya kegagalan tidak senyap (hanya tercatat di log).
// Best-effort: error di sini tidak mengembalikan error agar tidak menutupi
// kegagalan aslinya.
func NotifyBackupFailure(botToken, chatID, reason string) {
	if botToken == "" || chatID == "" {
		return
	}
	text := fmt.Sprintf("⚠️ *BACKUP SEKOLAHKU GAGAL*\n📅 Waktu: %s\n❗ Alasan: %s\n\nMohon periksa server.",
		time.Now().Format("2006-01-02 15:04:05"), reason)

	form := url.Values{}
	form.Set("chat_id", chatID)
	form.Set("text", text)
	form.Set("parse_mode", "Markdown")

	telegramAPI := os.Getenv("TELEGRAM_API_URL")
	if telegramAPI == "" {
		telegramAPI = "https://api.telegram.org"
	}
	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", telegramAPI, botToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.PostForm(endpoint, form)
	if err != nil {
		fmt.Printf("⚠ gagal mengirim notifikasi kegagalan backup: %v\n", err)
		return
	}
	resp.Body.Close()
}

// createBackupZip membuat arsip zip berisi snapshot DB + folder uploads.
//
// DB di-snapshot dengan VACUUM INTO (bila db tersedia) supaya konsisten,
// termasuk transaksi terbaru yang masih berada di WAL — menyalin file .db
// mentah saja bisa kehilangan perubahan terbaru saat WAL belum checkpoint.
// Snapshot ditulis dengan nama path "data/sekolahku.db" di dalam zip agar
// tetap kompatibel dengan alur restore (extractZipSecurely → /app/data/...).
func createBackupZip(db *sql.DB) (string, error) {
	// Temp di data/tmp (disk volume), bukan /tmp container (tmpfs 64MB).
	tempFile, err := os.CreateTemp(backupTempDir(), "sekolahku_backup_*.zip")
	if err != nil {
		return "", err
	}

	zipPath := tempFile.Name()
	zipWriter := zip.NewWriter(tempFile)

	// Dir bersih untuk DB snapshot sementara (dibuang setelah selesai).
	snapDir, err := os.MkdirTemp(backupTempDir(), "sekolahku_snap_*")
	if err != nil {
		zipWriter.Close()
		tempFile.Close()
		os.Remove(zipPath)
		return "", err
	}
	defer os.RemoveAll(snapDir)

	dbName := filepath.Join("data", "sekolahku.db")

	// 1) Snapshot DB yang konsisten.
	dbSnapshotPath := ""
	if db != nil {
		snap := filepath.Join(snapDir, "sekolahku.db")
		if err := snapshotDatabase(db, snap); err != nil {
			zipWriter.Close()
			tempFile.Close()
			os.Remove(zipPath)
			return "", fmt.Errorf("snapshot database gagal: %w", err)
		}
		dbSnapshotPath = snap
	}

	addFileToZip := func(zipName, diskPath string) error {
		info, err := os.Stat(diskPath)
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
		header.Name = filepath.ToSlash(zipName)
		header.Method = zip.Deflate
		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return err
		}
		file, err := os.Open(diskPath)
		if err != nil {
			return err
		}
		defer file.Close()
		_, err = io.Copy(writer, file)
		return err
	}

	addPathToZip := func(basePath string) error {
		return filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				if os.IsNotExist(err) {
					return nil
				}
				return err
			}

			// Lewati file WAL/SHM DB mentah — isi konsisten sudah lewat snapshot.
			if !info.IsDir() && (strings.HasSuffix(path, ".db-wal") || strings.HasSuffix(path, ".db-shm")) {
				return nil
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

	// 2) Masukkan DB snapshot dengan path "data/sekolahku.db".
	if dbSnapshotPath != "" {
		if err := addFileToZip(dbName, dbSnapshotPath); err != nil {
			zipWriter.Close()
			tempFile.Close()
			os.Remove(zipPath)
			return "", err
		}
	} else {
		// Fallback tanpa db: salin file mentah apa adanya.
		if err := addPathToZip(dbName); err != nil {
			zipWriter.Close()
			tempFile.Close()
			os.Remove(zipPath)
			return "", err
		}
	}

	// 3) Folder uploads + isi data/ lain (mis. cloud-thumbs). File DB mentah
	// di dalam data/ sudah diwakili snapshot, jadi tidak dobel (kecuali fallback).
	for _, p := range []string{filepath.Join("public", "uploads"), "uploads"} {
		if err := addPathToZip(p); err != nil {
			zipWriter.Close()
			tempFile.Close()
			os.Remove(zipPath)
			return "", err
		}
	}

	// Isi direktori data/ selain .db (mis. cloud-thumbs), bila ada.
	// PENTING: skip data/tmp agar backup TIDAK men-zip dirinya sendiri
	// (self-referential zip growth). Bandingkan abs path juga sebagai pengaman.
	zipAbs, _ := filepath.Abs(zipPath)
	if entries, derr := os.ReadDir("data"); derr == nil {
		for _, e := range entries {
			if e.IsDir() {
				p := filepath.Join("data", e.Name())
				pAbs, _ := filepath.Abs(p)
				// Skip temp dir dan diri sendiri.
				if strings.Contains(pAbs, "/tmp") || (strings.HasPrefix(zipAbs, pAbs+"/") || zipAbs == pAbs) {
					continue
				}
				if err := addPathToZip(p); err != nil {
					zipWriter.Close()
					tempFile.Close()
					os.Remove(zipPath)
					return "", err
				}
			}
		}
	}

	if err := zipWriter.Close(); err != nil {
		tempFile.Close()
		os.Remove(zipPath)
		return "", err
	}
	tempFile.Close()

	return zipPath, nil
}

// snapshotDatabase membuat salinan konsisten DB ke dstPath lewat VACUUM INTO
// lalu memverifikasi integritasnya. VACUUM INTO menghasilkan DB baru yang
// sudah tercampur dengan isi WAL, sehingga tidak ada transaksi tertinggal.
func snapshotDatabase(db *sql.DB, dstPath string) error {
	// VACUUM INTO menolak bila file tujuan sudah ada.
	_ = os.Remove(dstPath)

	// Path aman: escape kutip tunggal untuk literal SQL.
	escaped := strings.ReplaceAll(dstPath, "'", "''")
	if _, err := db.Exec(fmt.Sprintf("VACUUM INTO '%s'", escaped)); err != nil {
		// Fallback: checkpoint WAL ke DB utama lalu salin file mentah.
		if _, cerr := db.Exec("PRAGMA wal_checkpoint(TRUNCATE)"); cerr == nil {
			if err := copyFileMentah(dstPath); err == nil {
				return nil
			}
		}
		return err
	}

	// Verifikasi integritas snapshot.
	snapDB, err := sql.Open("sqlite", dstPath)
	if err != nil {
		return fmt.Errorf("buka snapshot: %w", err)
	}
	defer snapDB.Close()
	var res string
	if err := snapDB.QueryRow("PRAGMA integrity_check").Scan(&res); err != nil {
		return fmt.Errorf("integrity_check snapshot: %w", err)
	}
	if res != "ok" {
		return fmt.Errorf("snapshot database tidak sehat: %s", res)
	}
	return nil
}

// copyFileMentah menyalin data/sekolahku.db mentah sebagai fallback.
func copyFileMentah(dstPath string) error {
	src, err := os.Open(filepath.Join("data", "sekolahku.db"))
	if err != nil {
		return err
	}
	defer src.Close()
	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()
	_, err = io.Copy(dst, src)
	return err
}
