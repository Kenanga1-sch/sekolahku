package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

// writeStub membuat skrip shell executable sebagai pengganti binary PDF
// (CI tidak memasang chromium/soffice — stub meniru perilaku CLI-nya).
func writeStub(t *testing.T, script string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "stub.sh")
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

// chromiumStub: tulis PDF dummy ke argumen --print-to-pdf=PATH.
const chromiumStub = `#!/bin/sh
out=""
for arg in "$@"; do
  case "$arg" in
    --print-to-pdf=*) out="${arg#--print-to-pdf=}" ;;
  esac
done
[ -n "$out" ] || exit 1
printf '%%PDF-1.4 stub-chromium' > "$out"
`

// sofficeStub: untuk tiap input .xlsx tulis .pdf di --outdir.
const sofficeStub = `#!/bin/sh
outdir=""
expect_out=0
for arg in "$@"; do
  if [ "$expect_out" = "1" ]; then outdir="$arg"; expect_out=0; continue; fi
  case "$arg" in
    --outdir) expect_out=1 ;;
    *.xlsx)
      base=$(basename "$arg" .xlsx)
      printf '%%PDF-1.4 stub-lo' > "$outdir/$base.pdf" ;;
  esac
done
[ -n "$outdir" ] || exit 1
`

func TestSanitizePDFFilename(t *testing.T) {
	cases := map[string]string{
		"":                            "dokumen.pdf",
		"laporan bulan ini.pdf":       "laporan_bulan_ini.pdf",
		"../../etc/passwd":            "etc_passwd.pdf",
		"Daftar Hadir Kelas 6 2026":   "Daftar_Hadir_Kelas_6_2026.pdf",
		"sudah-aman_1.pdf":            "sudah-aman_1.pdf",
	}
	for in, want := range cases {
		if got := sanitizePDFFilename(in); got != want {
			t.Errorf("sanitizePDFFilename(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPrintHTMLChromiumMissingBinary(t *testing.T) {
	t.Setenv("CHROMIUM_BIN", filepath.Join(t.TempDir(), "tidak-ada"))
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/presensi/pdf/chromium",
		strings.NewReader(`{"html":"<html><body>halo</body></html>"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	if err := NewPDFHandler().PrintHTMLChromium(e.NewContext(req, rec)); err == nil {
		t.Fatal("expected error saat binary tidak ada")
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("code = %d, want 503", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "dialog cetak") {
		t.Fatalf("pesan harus mengarahkan fallback, got: %s", rec.Body.String())
	}
}

func TestPrintHTMLChromiumValidation(t *testing.T) {
	t.Setenv("CHROMIUM_BIN", writeStub(t, chromiumStub)) // binary ada → validasi payload dulu
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"html":""}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	// echo.Context.JSON mengembalikan error=nil pada respons sukses — cek kode.
	_ = NewPDFHandler().PrintHTMLChromium(e.NewContext(req, rec))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, want 400 (body %s)", rec.Code, rec.Body.String())
	}
}

func TestPrintHTMLChromiumRejectsScript(t *testing.T) {
	t.Setenv("CHROMIUM_BIN", writeStub(t, chromiumStub))
	for _, bad := range []string{
		`<html><script>alert(1)</script></html>`,
		`<html><img src=x onerror=alert(1)></html>`,
		`<html><body onload="x()">y</body></html>`,
	} {
		e := echo.New()
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"html":`+quoteJSON(bad)+`}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		_ = NewPDFHandler().PrintHTMLChromium(e.NewContext(req, rec))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("html %q: code = %d, want 400", bad, rec.Code)
		}
	}
}

// quoteJSON meng-escape string menjadi literal JSON yang valid.
func quoteJSON(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

func TestPrintHTMLChromiumSuccess(t *testing.T) {
	t.Setenv("CHROMIUM_BIN", writeStub(t, chromiumStub))
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/",
		strings.NewReader(`{"html":"<html><head><style>@page{size:297mm 210mm}</style></head><body>x</body></html>","filename":"Daftar Hadir Kelas 6 Oktober 2026.pdf"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	if err := NewPDFHandler().PrintHTMLChromium(e.NewContext(req, rec)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d body=%s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get(echo.HeaderContentType); got != "application/pdf" {
		t.Fatalf("content-type = %q", got)
	}
	cd := rec.Header().Get(echo.HeaderContentDisposition)
	if !strings.Contains(cd, "Daftar_Hadir_Kelas_6_Oktober_2026.pdf") {
		t.Fatalf("content-disposition = %q", cd)
	}
	if !strings.HasPrefix(rec.Body.String(), "%PDF-1.4") {
		t.Fatalf("body bukan PDF: %q", rec.Body.String()[:20])
	}
}

func multipartBody(t *testing.T, files []string, filename string) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for i, f := range files {
		fw, err := w.CreateFormFile("files", f)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.WriteString(fw, "PK-"+f); err != nil {
			t.Fatal(err)
		}
		_ = i
	}
	if filename != "" {
		if err := w.WriteField("filename", filename); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return &buf, w.FormDataContentType()
}

func TestConvertXlsxLibreOfficeValidation(t *testing.T) {
	e := echo.New()

	// Tanpa file → 400 (echo JSON → error nil; cek kode respons).
	t.Setenv("SOFFICE_BIN", writeStub(t, sofficeStub))
	body, ctype := multipartBody(t, nil, "")
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set(echo.HeaderContentType, ctype)
	rec := httptest.NewRecorder()
	_ = NewPDFHandler().ConvertXlsxLibreOffice(e.NewContext(req, rec))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, want 400 (body %s)", rec.Code, rec.Body.String())
	}

	// Binary hilang → 503.
	t.Setenv("SOFFICE_BIN", filepath.Join(t.TempDir(), "tidak-ada"))
	body, ctype = multipartBody(t, []string{"a.xlsx"}, "")
	req = httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set(echo.HeaderContentType, ctype)
	rec = httptest.NewRecorder()
	if err := NewPDFHandler().ConvertXlsxLibreOffice(e.NewContext(req, rec)); err == nil {
		t.Fatal("expected error saat binary tidak ada")
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("code = %d, want 503", rec.Code)
	}
}

func TestConvertXlsxLibreOfficeSuccess(t *testing.T) {
	t.Setenv("SOFFICE_BIN", writeStub(t, sofficeStub))
	e := echo.New()
	body, ctype := multipartBody(t, []string{"kelas-6.xlsx"}, "Daftar Hadir Oktober 2026.pdf")
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set(echo.HeaderContentType, ctype)
	rec := httptest.NewRecorder()
	if err := NewPDFHandler().ConvertXlsxLibreOffice(e.NewContext(req, rec)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.HasPrefix(rec.Body.String(), "%PDF-1.4") {
		t.Fatalf("body bukan PDF")
	}
	cd := rec.Header().Get(echo.HeaderContentDisposition)
	if !strings.Contains(cd, "Daftar_Hadir_Oktober_2026.pdf") {
		t.Fatalf("content-disposition = %q", cd)
	}
}
