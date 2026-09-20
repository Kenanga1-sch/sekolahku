package handlers

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

// buildArsipMultipart membangun multipart form dengan satu file "file".
func buildArsipMultipart(t *testing.T, fileBytes []byte, filename string) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	fw.Write(fileBytes)
	w.Close()
	return &buf, w.FormDataContentType()
}

// pdfHeader adalah magic byte file PDF valid.
var pdfHeader = []byte("%PDF-1.4\n%\xe2\xe3\xcf\xd3")

// TestSaveArsipPDFRejectsSpoofedHTML memastikan file HTML yang dinamai .pdf
// ditolak. Sebelumnya saveArsipPDF hanya memeriksa ekstensi, sehingga file
// HTML bisa tersimpan di direktori publik /uploads/arsip/... dan menjadi
// stored XSS.
func TestSaveArsipPDFRejectsSpoofedHTML(t *testing.T) {
	spoofHTML := []byte("<html><body><script>alert('xss')</script></body></html>")

	buf, contentType := buildArsipMultipart(t, spoofHTML, "surat-malsu.pdf")
	req := httptest.NewRequest("POST", "/", buf)
	req.Header.Set("Content-Type", contentType)
	c := echo.New().NewContext(req, httptest.NewRecorder())

	path, err := saveArsipPDF(c, "surat-masuk", true)
	if err == nil {
		t.Fatalf("expected error for HTML file named .pdf, got path %q", path)
	}
	if !strings.Contains(strings.ToLower(err.Error()), "tidak diizinkan") {
		t.Fatalf("expected rejection message, got %q", err.Error())
	}
}

// TestSaveArsipPDFAcceptsRealPDF memastikan PDF asli diterima dan disimpan
// di path yang benar.
func TestSaveArsipPDFAcceptsRealPDF(t *testing.T) {
	pdf := append(append([]byte{}, pdfHeader...), make([]byte, 100)...)

	buf, contentType := buildArsipMultipart(t, pdf, "surat.pdf")
	req := httptest.NewRequest("POST", "/", buf)
	req.Header.Set("Content-Type", contentType)
	c := echo.New().NewContext(req, httptest.NewRecorder())

	path, err := saveArsipPDF(c, "surat-masuk", true)
	if err != nil {
		t.Fatalf("saveArsipPDF returned error: %v", err)
	}
	if !strings.HasPrefix(path, "/uploads/arsip/surat-masuk/") {
		t.Fatalf("unexpected upload path: %q", path)
	}
}

// TestSaveArsipPDFRejectsOversizedFile memastikan batas 10MB ditegakkan.
func TestSaveArsipPDFRejectsOversizedFile(t *testing.T) {
	big := append(append([]byte{}, pdfHeader...), make([]byte, 11*1024*1024)...)

	buf, contentType := buildArsipMultipart(t, big, "besar.pdf")
	req := httptest.NewRequest("POST", "/", buf)
	req.Header.Set("Content-Type", contentType)
	c := echo.New().NewContext(req, httptest.NewRecorder())

	if _, err := saveArsipPDF(c, "surat-masuk", true); err == nil {
		t.Fatalf("expected error for oversized file, got none")
	}
}

// TestSaveArsipPDFOptionalNoFile memastikan required=false mengizinkan
// ketiadaan file.
func TestSaveArsipPDFOptionalNoFile(t *testing.T) {
	req := httptest.NewRequest("POST", "/", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	c := echo.New().NewContext(req, httptest.NewRecorder())

	path, err := saveArsipPDF(c, "surat-masuk", false)
	if err != nil {
		t.Fatalf("saveArsipPDF (optional, no file) returned error: %v", err)
	}
	if path != "" {
		t.Fatalf("expected empty path when no file, got %q", path)
	}
}
