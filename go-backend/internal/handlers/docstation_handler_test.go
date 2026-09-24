package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

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
	ip, secure := h.resolvePrinter(c)
	if ip != "192.168.10.140" || !secure {
		t.Errorf("resolve = %s secure=%v, want Epson/true", ip, secure)
	}

	// Header tidak dikenal → fallback default.
	req2 := httptest.NewRequest(http.MethodPost, "/", nil)
	req2.Header.Set("X-Printer-Ip", "10.0.0.99")
	c2 := e.NewContext(req2, httptest.NewRecorder())
	ip2, secure2 := h.resolvePrinter(c2)
	if ip2 != "192.168.10.131" || secure2 {
		t.Errorf("fallback = %s secure=%v, want Canon/false", ip2, secure2)
	}

	// Tanpa header → default.
	req3 := httptest.NewRequest(http.MethodPost, "/", nil)
	c3 := e.NewContext(req3, httptest.NewRecorder())
	ip3, _ := h.resolvePrinter(c3)
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
