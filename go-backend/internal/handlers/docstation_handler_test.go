package handlers

import (
	"bytes"
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
)

// docStationPNGHeader adalah magic bytes PNG valid — cukup agar
// http.DetectContentType mengenalinya sebagai "image/png".
var docStationPNGHeader = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}

// docStationJPEGHeader adalah magic bytes JPEG valid (SOI + marker).
var docStationJPEGHeader = []byte{0xFF, 0xD8, 0xFF, 0xE0}

// newDocStationSaveRequest membangun request SaveDocument: handler membaca body
// mentah + nama berkas dari header X-Docstation-Filename (bukan multipart),
// jadi helper menyetel header itu agar kontrak handler teruji apa adanya.
func newDocStationSaveRequest(t *testing.T, filename string, body []byte) (*http.Request, string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/docstation/save", bytes.NewReader(body))
	req.Header.Set("X-Docstation-Filename", filename)
	req.Header.Set("Content-Type", "application/octet-stream")
	return req, filename
}

// buildDocStationMultipart membangun multipart form dengan satu file "file" —
// pola sama seperti buildArsipMultipart, disediakan untuk kelengkapan helper
// multipart yang dipakai tes lain di repo.
func buildDocStationMultipart(t *testing.T, fileBytes []byte, filename string) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := fw.Write(fileBytes); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}
	return &buf, w.FormDataContentType()
}

// decodeDocStationJSON mengurai body JSON respons ke map.
func decodeDocStationJSON(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var out map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("respons bukan JSON valid: %v (body=%q)", err, rec.Body.String())
	}
	return out
}

// TestDocStationSaveDocumentRejectsBadExtension memastikan ekstensi yang tidak
// diizinkan (mis. .exe) ditolak dengan 4xx sebelum body dibaca.
func TestDocStationSaveDocumentRejectsBadExtension(t *testing.T) {
	h := &DocStationHandler{}
	e := echo.New()

	req, _ := newDocStationSaveRequest(t, "virus.exe", []byte("MZ fake executable"))
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.SaveDocument(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 untuk ekstensi .exe, got %d", rec.Code)
	}
	if rec.Code < 400 || rec.Code >= 500 {
		t.Fatalf("want status 4xx, got %d", rec.Code)
	}
	body := decodeDocStationJSON(t, rec)
	if ok, _ := body["success"].(bool); ok {
		t.Errorf("success harus false, got true")
	}
}

// TestDocStationSaveDocumentRejectsNonImageMIME memastikan berkas berisi teks
// biasa (terdeteksi text/plain) ditolak meski ekstensinya .png.
func TestDocStationSaveDocumentRejectsNonImageMIME(t *testing.T) {
	h := &DocStationHandler{}
	e := echo.New()

	req, _ := newDocStationSaveRequest(t, "catatan.png", []byte("ini hanya teks biasa, bukan gambar"))
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.SaveDocument(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 untuk MIME text/plain, got %d", rec.Code)
	}
	body := decodeDocStationJSON(t, rec)
	if msg, _ := body["error"].(string); !strings.Contains(msg, "text/plain") {
		t.Errorf("pesan error harus menyebut tipe terdeteksi, got %q", msg)
	}
}

// TestDocStationSaveDocumentRejectsOversized memastikan berkas > 15MB ditolak
// dengan 4xx (dicek setelah ekstensi lolos).
func TestDocStationSaveDocumentRejectsOversized(t *testing.T) {
	t.Setenv("DOCSTATION_UPLOAD_DIR", t.TempDir())
	h := &DocStationHandler{}
	e := echo.New()

	// PNG valid sebagai awalan + padding sampai melewati batas 15MB.
	big := make([]byte, docStationMaxBodyBytes+1)
	copy(big, docStationPNGHeader)
	req, _ := newDocStationSaveRequest(t, "besar.png", big)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.SaveDocument(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 untuk berkas >15MB, got %d", rec.Code)
	}
	body := decodeDocStationJSON(t, rec)
	if msg, _ := body["error"].(string); !strings.Contains(msg, "melebihi batas") {
		t.Errorf("pesan error harus menyebut batas ukuran, got %q", msg)
	}
}

// TestDocStationSaveDocumentAcceptsImage memastikan gambar PNG/JPEG sah
// diterima, tersimpan di folder arsip, dan memakai nama berkas unik.
func TestDocStationSaveDocumentAcceptsImage(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("DOCSTATION_UPLOAD_DIR", dir)
	h := &DocStationHandler{}
	e := echo.New()

	cases := []struct {
		name string
		body []byte
	}{
		{"scan.png", append(append([]byte{}, docStationPNGHeader...), make([]byte, 64)...)},
		{"scan.jpg", append(append([]byte{}, docStationJPEGHeader...), make([]byte, 64)...)},
	}

	seen := map[string]bool{}
	for _, tc := range cases {
		req, _ := newDocStationSaveRequest(t, tc.name, tc.body)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		if err := h.SaveDocument(c); err != nil {
			t.Fatalf("%s: handler error: %v", tc.name, err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: want 200, got %d (body=%s)", tc.name, rec.Code, rec.Body.String())
		}
		resp := decodeDocStationJSON(t, rec)
		filename, _ := resp["filename"].(string)
		if filename == "" {
			t.Fatalf("%s: respons harus memuat filename", tc.name)
		}
		// Nama unik: berawalan timestamp nano ("<nano>-<nama>").
		prefix, _, found := strings.Cut(filename, "-")
		if !found || prefix == "" {
			t.Errorf("%s: nama tersimpan harus berawalan timestamp, got %q", tc.name, filename)
		}
		if _, err := strconv.ParseInt(prefix, 10, 64); err != nil {
			t.Errorf("%s: prefix nama bukan timestamp numerik: %q", tc.name, prefix)
		}
		if !strings.Contains(filename, tc.name) {
			t.Errorf("%s: nama tersimpan harus memuat nama asli bersih, got %q", tc.name, filename)
		}
		if seen[filename] {
			t.Errorf("%s: nama berkas tidak unik: %q", tc.name, filename)
		}
		seen[filename] = true

		// Berkas benar-benar tertulis di folder arsip.
		if _, err := os.Stat(filepath.Join(dir, filename)); err != nil {
			t.Errorf("%s: berkas %q tidak tersimpan: %v", tc.name, filename, err)
		}
	}

	// Dua berkas berbeda harus menghasilkan dua berkas di disk (nama unik).
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read dir: %v", err)
	}
	if len(entries) != len(cases) {
		t.Errorf("want %d berkas tersimpan, got %d", len(cases), len(entries))
	}
}

// TestDocStationPrintJobRejectsUnknownPrinter memastikan PrintJob menolak
// printer di luar daftar terdaftar dengan 400 tanpa mencoba koneksi jaringan.
func TestDocStationPrintJobRejectsUnknownPrinter(t *testing.T) {
	t.Setenv("DOCSTATION_PRINTERS", "10.1.1.1:Printer A")
	t.Setenv("DOCSTATION_DEFAULT_PRINTER", "10.1.1.1")
	h := NewDocStationHandler()
	e := echo.New()

	req := httptest.NewRequest(http.MethodPost, "/api/docstation/print", bytes.NewReader(docStationJPEGHeader))
	req.Header.Set("X-Printer-Ip", "10.0.0.99")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.PrintJob(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 untuk printer tak dikenal, got %d", rec.Code)
	}
	body := decodeDocStationJSON(t, rec)
	if msg, _ := body["error"].(string); !strings.Contains(msg, "tidak terdaftar") {
		t.Errorf("pesan error harus menyebut printer tidak terdaftar, got %q", msg)
	}
}

func TestBuildIPPPrintJobHeader(t *testing.T) {
	payload := []byte("%PDF-1.4 fake")
	body := buildIPPPrintJob("ipp://192.168.10.131/ipp/print", "DocStation_Job", "application/pdf", payload)

	// Verifikasi header IPP 1.1 + operation Print-Job (0x0002) + request-id 1.
	if len(body) < 8 {
		t.Fatalf("payload terlalu pendek: %d", len(body))
	}
	if body[0] != 0x01 || body[1] != 0x01 {
		t.Errorf("versi IPP salah: %x %x", body[0], body[1])
	}
	if body[2] != 0x00 || body[3] != 0x02 {
		t.Errorf("operation bukan Print-Job: %x %x", body[2], body[3])
	}
	if !bytes.HasPrefix(body[8:], []byte{0x01}) {
		t.Errorf("tag operation-attributes (0x01) tidak ada")
	}
	// Harus mengandung atribut wajib & payload di akhir.
	for _, attr := range []string{"attributes-charset", "printer-uri", "job-name", "document-format"} {
		if !bytes.Contains(body, []byte(attr)) {
			t.Errorf("atribut %q tidak ditemukan", attr)
		}
	}
	if !bytes.HasSuffix(body, payload) {
		t.Errorf("payload dokumen tidak berada di akhir body")
	}
	// end-of-attributes-tag (0x03) tepat sebelum payload.
	end := len(body) - len(payload) - 1
	if body[end] != 0x03 {
		t.Errorf("end-of-attributes-tag salah: got %x", body[end])
	}
}

func TestExtractJobURLs(t *testing.T) {
	xmlData := []byte(`<?xml version="1.0"?>
	<scan:ScanJobs xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03">
	  <scan:ScanJob>
	    <scan:JobUri>/eSCL/ScanJobs/abc-123</scan:JobUri>
	    <pwg:JobUrl xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">/eSCL/ScanJobs/def-456</pwg:JobUrl>
	  </scan:ScanJob>
	</scan:ScanJobs>`)
	urls := extractJobURLs(xmlData)
	if len(urls) != 2 {
		t.Fatalf("want 2 job urls, got %d: %v", len(urls), urls)
	}
	if urls[0] != "/eSCL/ScanJobs/abc-123" {
		t.Errorf("job url 0 = %q", urls[0])
	}
}

func TestExtractJobURLsEmpty(t *testing.T) {
	if urls := extractJobURLs([]byte("<root></root>")); len(urls) != 0 {
		t.Errorf("want 0, got %v", urls)
	}
}

func TestResolvePrinter(t *testing.T) {
	h := &DocStationHandler{
		printers: []DocStationPrinter{
			{IP: "192.168.10.131", Name: "Canon", Secure: false},
			{IP: "192.168.10.140", Name: "Epson", Secure: true},
		},
		defaultPrinter: "192.168.10.131",
	}

	// Header valid → pakai printer itu.
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header.Set("X-Printer-Ip", "192.168.10.140")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	ip, secure, err := h.resolvePrinter(c)
	if err != nil {
		t.Fatalf("resolve err: %v", err)
	}
	if ip != "192.168.10.140" || !secure {
		t.Errorf("resolve = %s secure=%v, want Epson/true", ip, secure)
	}

	// Header tidak dikenal → ERROR eksplisit (bukan fallback diam-diam agar
	// tak salah cetak ke printer lain).
	req2 := httptest.NewRequest(http.MethodPost, "/", nil)
	req2.Header.Set("X-Printer-Ip", "10.0.0.99")
	c2 := e.NewContext(req2, httptest.NewRecorder())
	if _, _, err := h.resolvePrinter(c2); err == nil {
		t.Errorf("want error untuk printer tak dikenal, got nil")
	}

	// Tanpa header → default.
	req3 := httptest.NewRequest(http.MethodPost, "/", nil)
	c3 := e.NewContext(req3, httptest.NewRecorder())
	ip3, _, err := h.resolvePrinter(c3)
	if err != nil {
		t.Fatalf("default err: %v", err)
	}
	if ip3 != "192.168.10.131" {
		t.Errorf("default = %s, want 192.168.10.131", ip3)
	}
}

func TestNewDocStationHandlerDefaults(t *testing.T) {
	t.Setenv("DOCSTATION_PRINTERS", "")
	t.Setenv("DOCSTATION_DEFAULT_PRINTER", "")
	h := NewDocStationHandler()
	if len(h.printers) < 2 {
		t.Fatalf("want >=2 default printers, got %d", len(h.printers))
	}
	if h.defaultPrinter != "192.168.10.131" {
		t.Errorf("default printer = %s, want Canon 192.168.10.131", h.defaultPrinter)
	}
}

func TestNewDocStationHandlerFromEnv(t *testing.T) {
	t.Setenv("DOCSTATION_PRINTERS", "10.1.1.1:Printer A,10.1.1.2:Printer B")
	t.Setenv("DOCSTATION_DEFAULT_PRINTER", "10.1.1.2")
	t.Setenv("DOCSTATION_SECURE_PRINTERS", "")
	h := NewDocStationHandler()
	if len(h.printers) != 2 {
		t.Fatalf("want 2 printers, got %d", len(h.printers))
	}
	if h.printers[0].IP != "10.1.1.1" || h.printers[0].Name != "Printer A" {
		t.Errorf("printer[0] = %+v", h.printers[0])
	}
	if h.defaultPrinter != "10.1.1.2" {
		t.Errorf("default = %s", h.defaultPrinter)
	}
}

func TestNewDocStationHandlerSecureEnv(t *testing.T) {
	// Flag secure via sufiks ":s" dan via DOCSTATION_SECURE_PRINTERS.
	t.Setenv("DOCSTATION_PRINTERS", "10.1.1.1:Printer A:s,10.1.1.2:Printer B")
	t.Setenv("DOCSTATION_DEFAULT_PRINTER", "")
	t.Setenv("DOCSTATION_SECURE_PRINTERS", "10.1.1.2")
	h := NewDocStationHandler()
	if !h.printers[0].Secure {
		t.Errorf("printer 10.1.1.1 harus secure via sufiks :s")
	}
	if !h.printers[1].Secure {
		t.Errorf("printer 10.1.1.2 harus secure via DOCSTATION_SECURE_PRINTERS")
	}
}

func TestNewDocStationHandlerColonInName(t *testing.T) {
	// Nama boleh mengandung titik-dua — hanya ':' pertama sebagai pemisah.
	t.Setenv("DOCSTATION_PRINTERS", "10.1.1.1:Printer A: Lantai 2")
	t.Setenv("DOCSTATION_DEFAULT_PRINTER", "")
	t.Setenv("DOCSTATION_SECURE_PRINTERS", "")
	h := NewDocStationHandler()
	if h.printers[0].IP != "10.1.1.1" {
		t.Errorf("ip = %q", h.printers[0].IP)
	}
	if h.printers[0].Name != "Printer A: Lantai 2" {
		t.Errorf("name = %q", h.printers[0].Name)
	}
}

func TestNewDocStationHandlerUnknownDefaultFallsBack(t *testing.T) {
	// Default menunjuk IP asing → konsisten ke printer pertama.
	t.Setenv("DOCSTATION_PRINTERS", "10.1.1.1:Printer A")
	t.Setenv("DOCSTATION_DEFAULT_PRINTER", "99.99.99.99")
	t.Setenv("DOCSTATION_SECURE_PRINTERS", "")
	h := NewDocStationHandler()
	if h.defaultPrinter != "10.1.1.1" {
		t.Errorf("default = %s, want 10.1.1.1", h.defaultPrinter)
	}
}

func TestCopyESCLHeadersAllowlist(t *testing.T) {
	src := http.Header{}
	src.Set("Content-Type", "text/xml")
	src.Set("Accept", "text/xml")
	src.Set("Authorization", "Bearer rahasia")
	src.Set("Cookie", "session=rahasia")
	src.Set("X-CSRF-Token", "rahasia")
	src.Set("X-Printer-Ip", "10.1.1.1")
	src.Set("X-Custom-Evil", "1")

	dst := http.Header{}
	copyESCLHeaders(dst, src)

	if dst.Get("Content-Type") != "text/xml" {
		t.Errorf("Content-Type harus diteruskan")
	}
	for _, k := range []string{"Authorization", "Cookie", "X-CSRF-Token", "X-Printer-Ip", "X-Custom-Evil"} {
		if dst.Get(k) != "" {
			t.Errorf("header %s bocor ke printer: %q", k, dst.Get(k))
		}
	}
}

func TestExtractJobURLsNested(t *testing.T) {
	// EndElement bersarang tak boleh menghapus status inJob elemen luar.
	xmlData := []byte(`<a><scan:JobUri xmlns:scan="x">/eSCL/ScanJobs/1<b>y</b></scan:JobUri></a>`)
	urls := extractJobURLs(xmlData)
	if len(urls) != 1 || urls[0] != "/eSCL/ScanJobs/1" {
		t.Errorf("nested urls = %v", urls)
	}
}
