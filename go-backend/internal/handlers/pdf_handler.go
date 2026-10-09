package handlers

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
)

// PDFHandler mengonversi workbook xlsx (hasil fill template) menjadi PDF
// lewat LibreOffice headless — satu-satunya mesin PDF sejak keputusan
// 2026-10-08 (LibreOffice paling presisi, menyerupai print Excel asli).
// Chromium & dialog cetak browser sudah dihapus.
//
// Konversi HANYA berjalan bila binary terpasang di image container; bila
// tidak, endpoint membalas 503 sehingga frontend mengarahkan user ke export
// Excel. Konversi diserialisasi lewat semaphore (LibreOffice berat).
type PDFHandler struct {
	sofficeSem chan struct{}
}

func NewPDFHandler() *PDFHandler {
	return &PDFHandler{
		sofficeSem: make(chan struct{}, 1),
	}
}

const (
	maxXLSXFileBytes    = 10 << 20 // 10MB per workbook
	maxLibreOfficeFiles = 20       // jumlah workbook per request (per kelas)
	semaphoreWait       = 30 * time.Second
	libreOfficeTimeout  = 90 * time.Second
)

// binPath mengambil path binary dari env (untuk test) atau default.
func binPath(envKey, def string) string {
	if v := strings.TrimSpace(os.Getenv(envKey)); v != "" {
		return v
	}
	return def
}

// sanitizePDFFilename memaksa nama file aman untuk Content-Disposition.
func sanitizePDFFilename(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "dokumen.pdf"
	}
	re := regexp.MustCompile(`[^a-zA-Z0-9._-]+`)
	name = re.ReplaceAllString(name, "_")
	name = strings.Trim(name, "._-")
	if name == "" {
		return "dokumen.pdf"
	}
	if !strings.HasSuffix(strings.ToLower(name), ".pdf") {
		name += ".pdf"
	}
	if len(name) > 120 {
		name = name[:120]
	}
	return name
}

// acquireSem menunggu giliran konversi; bila penuh dalam 30s → 504.
func acquireSem(c echo.Context, sem chan struct{}, engine string) error {
	select {
	case sem <- struct{}{}:
		return nil
	case <-c.Request().Context().Done():
		return c.Request().Context().Err()
	case <-time.After(semaphoreWait):
		_ = c.JSON(http.StatusServiceUnavailable, map[string]interface{}{
			"success": false,
			"error":   "Mesin PDF (" + engine + ") sedang sibuk, coba lagi sebentar",
		})
		return fmt.Errorf("semaphore penuh: %s", engine)
	}
}

// ensureBinary memastikan binary tersedia; tidak ada → 503.
func ensureBinary(c echo.Context, bin, engine string) error {
	if _, err := exec.LookPath(bin); err != nil {
		_ = c.JSON(http.StatusServiceUnavailable, map[string]interface{}{
			"success": false,
			"error":   "Mesin PDF (" + engine + ") belum terpasang di server — silakan gunakan export Excel sebagai gantinya",
		})
		return fmt.Errorf("%s tidak tersedia: %w", engine, err)
	}
	return nil
}

// execWithTimeout menjalankan command dengan timeout; error → pesan jelas.
//
// Ketahanan terhadap insiden nyata (bug 2026-10-08): wrapper soffice mem-fork
// anak (soffice.bin) yang TIDAK ikut mati saat hanya induk dibunuh → anak itu
// tetap memegang pipe stdout/stderr sehingga CombinedOutput tidak pernah
// kembali, handler menggantung 1 jam dan semaphore bocor selamanya (semua
// request berikut 503 "sedang sibuk"). Karena itu:
//   - Setpgid + Cancel mematikan SELURUH process group saat timeout;
//   - WaitDelay memaksa Wait kembali walau ada keturunan yang lolos dari
//     grup dan masih memegang pipe (max 5 detik setelah proses utama keluar).
func execWithTimeout(ctx context.Context, bin string, args []string, env []string, timeout time.Duration) ([]byte, error) {
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(runCtx, bin, args...)
	cmd.Env = env
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		if err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL); err != nil && err != syscall.ESRCH {
			return err
		}
		return nil
	}
	cmd.WaitDelay = 5 * time.Second
	out, err := cmd.CombinedOutput()
	if runCtx.Err() == context.DeadlineExceeded {
		return nil, fmt.Errorf("waktu habis setelah %s", timeout)
	}
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if len(msg) > 400 {
			msg = msg[:400]
		}
		return nil, fmt.Errorf("%v: %s", err, msg)
	}
	return out, nil
}

// unsafeHTML dihapus bersama jalur Chromium (2026-10-08): LibreOffice
// mengonversi xlsx, bukan HTML yang dieksekusi.

// tempWorkspace membuat direktori kerja di /tmp (tmpfs container) + cleanup.
func tempWorkspace(prefix string) (string, func(), error) {
	dir, err := os.MkdirTemp("", prefix)
	if err != nil {
		return "", nil, err
	}
	return dir, func() { _ = os.RemoveAll(dir) }, nil
}

// ------------------------------------------------------------- LibreOffice ---

// ConvertXlsxLibreOffice mengonversi satu atau banyak workbook (.xlsx) hasil
// fill template presensi menjadi satu PDF gabungan (qpdf bila >1 file).
func (h *PDFHandler) ConvertXlsxLibreOffice(c echo.Context) error {
	bin := binPath("SOFFICE_BIN", "soffice")
	if err := ensureBinary(c, bin, "libreoffice"); err != nil {
		return err
	}

	req := c.Request()
	req.Body = http.MaxBytesReader(c.Response(), req.Body, maxXLSXFileBytes*int64(maxLibreOfficeFiles))
	if err := req.ParseMultipartForm(maxXLSXFileBytes); err != nil {
		return c.JSON(http.StatusRequestEntityTooLarge, map[string]interface{}{"success": false, "error": "Payload terlalu besar"})
	}
	files := req.MultipartForm.File["files"]
	if len(files) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "files wajib diisi"})
	}
	if len(files) > maxLibreOfficeFiles {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Terlalu banyak file (maks 20)"})
	}
	filename := "dokumen.pdf"
	if vals := req.MultipartForm.Value["filename"]; len(vals) > 0 {
		filename = sanitizePDFFilename(vals[0])
	}

	if err := acquireSem(c, h.sofficeSem, "libreoffice"); err != nil {
		return err
	}
	defer func() { <-h.sofficeSem }()

	dir, cleanup, err := tempWorkspace("pdf-lo-")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyiapkan ruang kerja"})
	}
	defer cleanup()

	outDir := filepath.Join(dir, "out")
	if err := os.MkdirAll(outDir, 0o700); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyiapkan ruang kerja"})
	}

	var xlsxPaths []string
	for i, fh := range files {
		p, err := saveMultipartFile(fh, filepath.Join(dir, fmt.Sprintf("in-%d.xlsx", i)))
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Gagal menyimpan file: " + err.Error()})
		}
		xlsxPaths = append(xlsxPaths, p)
	}

	env := append(os.Environ(),
		"HOME="+dir,
		"XDG_CONFIG_HOME="+filepath.Join(dir, ".config"),
		"XDG_CACHE_HOME="+filepath.Join(dir, ".cache"),
	)
	// Profil LibreOffice per-request (hindari kunci profil ganda saat paralel).
	args := []string{
		"--headless",
		"--norestore",
		"--convert-to", "pdf",
		"--outdir", outDir,
		"-env:UserInstallation=file://" + filepath.Join(dir, "lo-profile"),
	}
	args = append(args, xlsxPaths...)
	if _, err := execWithTimeout(c.Request().Context(), bin, args, env, libreOfficeTimeout); err != nil {
		c.Logger().Errorf("libreoffice konversi gagal (%d file): %v", len(xlsxPaths), err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Konversi LibreOffice gagal: " + err.Error()})
	}

	// Kumpulkan hasil sesuai urutan input.
	var pdfPaths []string
	for _, x := range xlsxPaths {
		p := filepath.Join(outDir, strings.TrimSuffix(filepath.Base(x), ".xlsx")+".pdf")
		if st, err := os.Stat(p); err == nil && st.Size() > 0 {
			pdfPaths = append(pdfPaths, p)
		}
	}
	if len(pdfPaths) == 0 {
		c.Logger().Errorf("libreoffice tidak menghasilkan PDF untuk %d file (outdir kosong)", len(xlsxPaths))
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "LibreOffice tidak menghasilkan PDF"})
	}

	final := pdfPaths[0]
	if len(pdfPaths) > 1 {
		if qbin := binPath("QPDF_BIN", "qpdf"); func() bool { _, e := exec.LookPath(qbin); return e == nil }() {
			merged := filepath.Join(dir, "merged.pdf")
			qargs := []string{"--empty", "--pages"}
			qargs = append(qargs, pdfPaths...)
			qargs = append(qargs, "--", merged)
			if _, err := execWithTimeout(c.Request().Context(), qbin, qargs, env, 30*time.Second); err == nil {
				if st, err := os.Stat(merged); err == nil && st.Size() > 0 {
					final = merged
				}
			}
		}
		// Tanpa qpdf: kirim PDF pertama (fallback tetap berguna).
	}

	pdf, err := os.ReadFile(final)
	if err != nil || len(pdf) == 0 {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membaca hasil PDF"})
	}
	c.Response().Header().Set(echo.HeaderContentDisposition, `attachment; filename="`+filename+`"`)
	return c.Blob(http.StatusOK, "application/pdf", pdf)
}

// saveMultipartFile menyimpan uploaded file ke path tujuan (dengan batas ukuran).
func saveMultipartFile(fh *multipart.FileHeader, dst string) (string, error) {
	src, err := fh.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()
	f, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return "", err
	}
	defer f.Close()
	n, err := io.Copy(f, io.LimitReader(src, maxXLSXFileBytes+1))
	if err != nil {
		return "", err
	}
	if n > maxXLSXFileBytes {
		_ = os.Remove(dst)
		return "", fmt.Errorf("file %q terlalu besar (maks 10MB)", fh.Filename)
	}
	return dst, nil
}
