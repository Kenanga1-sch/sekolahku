package handlers

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func openTemplateTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	_, err = db.Exec(`
		CREATE TABLE report_templates (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			code TEXT UNIQUE, name TEXT, category TEXT, module TEXT,
			description TEXT, paper_size TEXT, orientation TEXT,
			layout_json TEXT, file_path TEXT NOT NULL DEFAULT '',
			kind TEXT NOT NULL DEFAULT '',
			is_default INTEGER DEFAULT 0,
			created_at INTEGER, updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}
	return db
}

// miniDOCX membuat arsip ZIP OOXML minimal berisi teks dokumen mentah.
func miniDOCX(t *testing.T, texts ...string) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	f, err := w.Create("word/document.xml")
	if err != nil {
		t.Fatalf("zip create: %v", err)
	}
	var sb strings.Builder
	sb.WriteString(`<document><body>`)
	for _, txt := range texts {
		sb.WriteString(`<p><r><t>` + txt + `</t></r></p>`)
	}
	sb.WriteString(`</body></document>`)
	if _, err := f.Write([]byte(sb.String())); err != nil {
		t.Fatalf("zip write: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}
	return buf.Bytes()
}

// miniXLSX membuat arsip ZIP OOXML minimal berisi teks sel mentah.
// Cukup untuk sniff + hasRowVariable (pemindaian XML), tanpa exceljs.
func miniXLSX(t *testing.T, cellTexts ...string) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	f, err := w.Create("xl/worksheets/sheet1.xml")
	if err != nil {
		t.Fatalf("zip create: %v", err)
	}
	var sb strings.Builder
	sb.WriteString(`<worksheet><sheetData><row>`)
	for i, txt := range cellTexts {
		sb.WriteString(`<c r="A` + itoa(int64(i+1)) + `" t="inlineStr"><is><t>` + txt + `</t></is></c>`)
	}
	sb.WriteString(`</row></sheetData></worksheet>`)
	if _, err := f.Write([]byte(sb.String())); err != nil {
		t.Fatalf("zip write: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}
	return buf.Bytes()
}

func callHandler(t *testing.T, h *ReportTemplateHandler, fn func(echo.Context) error, method, path string, setup func(echo.Context)) (int, map[string]interface{}) {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(method, path, nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	if setup != nil {
		setup(ctx)
	}
	_ = fn(ctx)
	var resp map[string]interface{}
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	return rec.Code, resp
}

// TestTemplateFilePathRoundtrip memastikan kolom file_path tersimpan dan
// terbaca lewat repo + handler GetByCode.
func TestTemplateFilePathRoundtrip(t *testing.T) {
	db := openTemplateTestDB(t)
	defer db.Close()
	repo := repository.NewReportTemplateRepository(db)
	h := NewReportTemplateHandler(repo)

	created, err := repo.Create(&models.CreateReportTemplateRequest{
		Code: "RPT_PRESENSI_BULANAN_XLSX", Name: "Daftar Hadir (Excel)",
		Category: "Presensi", Module: "presensi", FilePath: "templates/daftar-hadir-bulanan-v1.xlsx",
		IsDefault: true,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.FilePath != "templates/daftar-hadir-bulanan-v1.xlsx" {
		t.Fatalf("filePath tidak tersimpan: %q", created.FilePath)
	}

	code, resp := callHandler(t, h, h.GetByCode, http.MethodGet, "/api/reports/templates/code/RPT_PRESENSI_BULANAN_XLSX",
		func(ctx echo.Context) {
			ctx.SetParamNames("code")
			ctx.SetParamValues("RPT_PRESENSI_BULANAN_XLSX")
		})
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %v", code, resp)
	}
	data, _ := resp["data"].(map[string]interface{})
	if data["filePath"] != "templates/daftar-hadir-bulanan-v1.xlsx" {
		t.Fatalf("filePath tidak terbaca: %v", data)
	}
}

// TestTemplateDefaultModule memastikan endpoint default mengembalikan
// template ber-is_default=1 dan 404 bila modul belum punya default.
func TestTemplateDefaultModule(t *testing.T) {
	db := openTemplateTestDB(t)
	defer db.Close()
	repo := repository.NewReportTemplateRepository(db)
	h := NewReportTemplateHandler(repo)

	// Belum ada → 404
	code, _ := callHandler(t, h, h.GetDefaultModule, http.MethodGet, "/api/reports/templates/default/presensi",
		func(ctx echo.Context) {
			ctx.SetParamNames("module")
			ctx.SetParamValues("presensi")
		})
	if code != http.StatusNotFound {
		t.Fatalf("expected 404 tanpa default, got %d", code)
	}

	a, _ := repo.Create(&models.CreateReportTemplateRequest{Code: "A", Name: "A", Module: "presensi"})
	b, _ := repo.Create(&models.CreateReportTemplateRequest{Code: "B", Name: "B", Module: "presensi"})
	if _, err := repo.SetDefault(b.ID); err != nil {
		t.Fatalf("setDefault: %v", err)
	}
	// Default lama ikut nonaktif
	after, _ := repo.GetByID(a.ID)
	if after.IsDefault {
		t.Fatalf("default lama masih aktif")
	}

	code, resp := callHandler(t, h, h.GetDefaultModule, http.MethodGet, "/api/reports/templates/default/presensi",
		func(ctx echo.Context) {
			ctx.SetParamNames("module")
			ctx.SetParamValues("presensi")
		})
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %v", code, resp)
	}
	data, _ := resp["data"].(map[string]interface{})
	if data["code"] != "B" {
		t.Fatalf("expected code B, got %v", data)
	}
}

// TestTemplateUploadValidation menguji validasi berlapis UploadXLSX:
// bukan-xlsx ditolak, xlsx tanpa marker baris ditolak, xlsx bervariabel
// diterima dan file_path diperbarui.
func TestTemplateUploadValidation(t *testing.T) {
	db := openTemplateTestDB(t)
	defer db.Close()
	repo := repository.NewReportTemplateRepository(db)
	h := NewReportTemplateHandler(repo)

	tpl, err := repo.Create(&models.CreateReportTemplateRequest{Code: "RPT_X", Name: "X", Module: "presensi"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// Simpan cwd agar resolveTemplateFile menulis ke direktori temporer.
	dir := t.TempDir()
	old, _ := os.Getwd()
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	defer func() { _ = os.Chdir(old) }()

	upload := func(filename string, content []byte) int {
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		fw, _ := w.CreateFormFile("file", filename)
		_, _ = fw.Write(content)
		_ = w.Close()
		e := echo.New()
		req := httptest.NewRequest(http.MethodPost, "/api/reports/templates/1/file", &buf)
		req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.SetParamNames("id")
		ctx.SetParamValues(itoa(tpl.ID))
		_ = h.UploadXLSX(ctx)
		return rec.Code
	}

	if code := upload("template.txt", []byte("bukan excel")); code != http.StatusBadRequest {
		t.Fatalf("ekstensi txt harus 400, got %d", code)
	}
	if code := upload("template.xlsx", []byte("<html>bukan zip</html>")); code != http.StatusBadRequest {
		t.Fatalf("isi html harus 400, got %d", code)
	}
	plain := miniXLSX(t, "Judul", "No")
	if code := upload("polos.xlsx", plain); code != http.StatusBadRequest {
		t.Fatalf("xlsx tanpa marker harus 400, got %d", code)
	}

	valid := miniXLSX(t, "Kelas {{kelas}}", "{{no}}", "{{nama}}", "{{tgl_1}}")
	e := echo.New()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, _ := w.CreateFormFile("file", "hadir.xlsx")
	_, _ = fw.Write(valid)
	_ = w.Close()
	req := httptest.NewRequest(http.MethodPost, "/", &buf)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	ctx.SetParamNames("id")
	ctx.SetParamValues(itoa(tpl.ID))
	if err := h.UploadXLSX(ctx); err != nil {
		t.Fatalf("upload valid: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	after, _ := repo.GetByID(tpl.ID)
	if !strings.HasPrefix(after.FilePath, "templates/") || !strings.HasSuffix(after.FilePath, ".xlsx") {
		t.Fatalf("filePath tidak diperbarui: %q", after.FilePath)
	}
	if after.Kind != "xlsx" {
		t.Fatalf("kind harus xlsx, got %q", after.Kind)
	}
	if _, err := os.Stat(filepath.Join(dir, "public", after.FilePath)); err != nil {
		t.Fatalf("berkas tidak tersimpan: %v", err)
	}
}

// TestTemplateUploadDOCX menguji jalur Word: .docx tanpa variabel ditolak,
// .docx bervariabel diterima + kind menjadi docx.
func TestTemplateUploadDOCX(t *testing.T) {
	db := openTemplateTestDB(t)
	defer db.Close()
	repo := repository.NewReportTemplateRepository(db)
	h := NewReportTemplateHandler(repo)

	tpl, err := repo.Create(&models.CreateReportTemplateRequest{Code: "RPT_SK", Name: "SK", Module: "kepegawaian"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	dir := t.TempDir()
	old, _ := os.Getwd()
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	defer func() { _ = os.Chdir(old) }()

	upload := func(filename string, content []byte) (int, string) {
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		fw, _ := w.CreateFormFile("file", filename)
		_, _ = fw.Write(content)
		_ = w.Close()
		e := echo.New()
		req := httptest.NewRequest(http.MethodPost, "/", &buf)
		req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.SetParamNames("id")
		ctx.SetParamValues(itoa(tpl.ID))
		_ = h.UploadTemplateFile(ctx)
		return rec.Code, rec.Body.String()
	}

	if code, _ := upload("polos.docx", miniDOCX(t, "Surat Keterangan")); code != http.StatusBadRequest {
		t.Fatalf("docx tanpa variabel harus 400, got %d", code)
	}

	valid := miniDOCX(t, "Nama: {{nama}}", "Kelas: {{kelas}}")
	code, body := upload("sk.docx", valid)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", code, body)
	}
	after, _ := repo.GetByID(tpl.ID)
	if after.Kind != "docx" {
		t.Fatalf("kind harus docx, got %q", after.Kind)
	}
	if !strings.HasSuffix(after.FilePath, ".docx") {
		t.Fatalf("filePath harus .docx: %q", after.FilePath)
	}

	// Kind manual yang tak dikenal dinormalisasi ke "" (grid lama).
	updated, err := repo.Create(&models.CreateReportTemplateRequest{Code: "RPT_ODD", Name: "Odd", Kind: "pdf"})
	if err != nil {
		t.Fatalf("create odd: %v", err)
	}
	if updated.Kind != "" {
		t.Fatalf("kind tak dikenal harus dinormalisasi, got %q", updated.Kind)
	}
}

func itoa(id int64) string {
	return strconv.FormatInt(id, 10)
}
