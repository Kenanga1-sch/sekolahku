package handlers

import (
	"bytes"
	"crypto/tls"
	"encoding/xml"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// DocStationHandler adalah proxy jaringan tipis untuk scan (eSCL) dan cetak
// (IPP / RAW 9100) ke printer LAN. Sesuai RULES proyek DocStation: TIDAK ada
// pemrosesan gambar/PDF di server — semua pemrosesan di browser client.
//
// Di-port dari server.py (FastAPI) ke Go agar satu bahasa dengan backend
// Sekolahku dan menghapus kebutuhan runtime Python.
type DocStationHandler struct {
	printers       []DocStationPrinter
	defaultPrinter string
	httpClient     *http.Client
}

// DocStationPrinter mewakili satu printer yang terdaftar.
type DocStationPrinter struct {
	IP   string `json:"ip"`
	Name string `json:"name"`
	// Secure true bila printer memakai HTTPS untuk eSCL/IPP.
	Secure bool `json:"secure"`
}

// NewDocStationHandler membangun handler dari konfigurasi env:
//
//	DOCSTATION_PRINTERS        = "192.168.10.131:Canon G7000 Series,192.168.10.140:Epson L6270"
//	DOCSTATION_DEFAULT_PRINTER = "192.168.10.131"
//
// Bila kosong, dipakai daftar default berikut agar modul tetap berfungsi.
func NewDocStationHandler() *DocStationHandler {
	defaults := []DocStationPrinter{
		{IP: "192.168.10.131", Name: "Canon G7000 Series (LAN)", Secure: false},
		{IP: "192.168.10.140", Name: "Epson L6270 Series (Wi-Fi)", Secure: true},
	}

	printers := defaults
	if raw := strings.TrimSpace(os.Getenv("DOCSTATION_PRINTERS")); raw != "" {
		var parsed []DocStationPrinter
		for _, entry := range strings.Split(raw, ",") {
			entry = strings.TrimSpace(entry)
			if entry == "" {
				continue
			}
			ip := entry
			name := entry
			if idx := strings.Index(entry, ":"); idx >= 0 {
				ip = strings.TrimSpace(entry[:idx])
				name = strings.TrimSpace(entry[idx+1:])
			}
			if ip == "" {
				continue
			}
			parsed = append(parsed, DocStationPrinter{
				IP:     ip,
				Name:   name,
				Secure: ip == "192.168.10.140",
			})
		}
		if len(parsed) > 0 {
			printers = parsed
		}
	}

	def := strings.TrimSpace(os.Getenv("DOCSTATION_DEFAULT_PRINTER"))
	if def == "" {
		def = printers[0].IP
	}

	return &DocStationHandler{
		printers:       printers,
		defaultPrinter: def,
		httpClient: &http.Client{
			Timeout: 90 * time.Second,
			Transport: &http.Transport{
				// Printer LAN sering memakai sertifikat self-signed.
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
		},
	}
}

// resolvePrinter memilih IP printer dari header X-Printer-Ip, memvalidasi
// terhadap daftar terdaftar. Fallback ke default.
func (h *DocStationHandler) resolvePrinter(c echo.Context) (string, bool) {
	ip := strings.TrimSpace(c.Request().Header.Get("X-Printer-Ip"))
	if ip == "" {
		return h.defaultPrinter, h.isSecure(h.defaultPrinter)
	}
	for _, p := range h.printers {
		if p.IP == ip {
			return p.IP, p.Secure
		}
	}
	return h.defaultPrinter, h.isSecure(h.defaultPrinter)
}

func (h *DocStationHandler) isSecure(ip string) bool {
	for _, p := range h.printers {
		if p.IP == ip {
			return p.Secure
		}
	}
	return false
}

// Session melaporkan status sesi ke klien DocStation.
//
// Berbeda dengan server.py yang memakai password tunggal + sessions.json,
// di sini autentikasi memakai JWT Sekolahku: request yang mencapai handler
// ini sudah lolos JWTMiddleware + RoleMiddleware, jadi selalu terautentikasi.
// Endpoint dipertahankan agar api.js DocStation tetap kompatibel.
func (h *DocStationHandler) Session(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":               true,
		"authenticated":         true,
		"authentication_required": true,
	})
}

// ListPrinters mengembalikan daftar printer + default.
func (h *DocStationHandler) ListPrinters(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":        true,
		"printers":       h.printers,
		"defaultPrinter": h.defaultPrinter,
	})
}

// SaveDocument menyimpan berkas hasil scan/edit ke folder arsip DocStation di
// server. Folder ditentukan env DOCSTATION_UPLOAD_DIR (default ./docstation-uploads).
func (h *DocStationHandler) SaveDocument(c echo.Context) error {
	name := c.Request().Header.Get("X-Docstation-Filename")
	if name == "" {
		name = c.QueryParam("filename")
	}
	if decoded, err := url.QueryUnescape(name); err == nil && decoded != "" {
		name = decoded
	}
	// Cegah path traversal: ambil basename saja.
	name = filepath.Base(filepath.Clean(name))
	if name == "." || name == "/" || name == "" {
		name = fmt.Sprintf("docstation-%d.bin", time.Now().UnixNano())
	}

	body, err := io.ReadAll(c.Request().Body)
	if err != nil || len(body) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data kosong"})
	}

	dir := strings.TrimSpace(os.Getenv("DOCSTATION_UPLOAD_DIR"))
	if dir == "" {
		dir = "./docstation-uploads"
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membuat folder arsip"})
	}

	dest := filepath.Join(dir, name)
	if err := os.WriteFile(dest, body, 0o644); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan berkas"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"message":  "Berkas berhasil disimpan di server",
		"filename": name,
	})
}

// PrinterStatus mengecek konektivitas TCP ke printer (port 631/9100/80).
func (h *DocStationHandler) PrinterStatus(c echo.Context) error {
	type result struct {
		IP     string `json:"ip"`
		Name   string `json:"name"`
		Online bool   `json:"online"`
	}
	results := make([]result, 0, len(h.printers))
	for _, p := range h.printers {
		online := false
		for _, port := range []string{"631", "9100", "80"} {
			conn, err := net.DialTimeout("tcp", net.JoinHostPort(p.IP, port), 1200*time.Millisecond)
			if err == nil {
				_ = conn.Close()
				online = true
				break
			}
		}
		results = append(results, result{IP: p.IP, Name: p.Name, Online: online})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":      true,
		"status":       "ok",
		"printerIp":    h.defaultPrinter,
		"printers":     results,
	})
}

// ProxyESCL mem-forward request eSCL ke printer.
func (h *DocStationHandler) ProxyESCL(c echo.Context) error {
	printerIP, secure := h.resolvePrinter(c)
	esclPath := c.Param("*")

	// Protokol: printer secure (Epson) coba https dulu, lalu http; sebaliknya.
	schemes := []string{"http", "https"}
	if secure {
		schemes = []string{"https", "http"}
	}

	// Bersihkan job eSCL yang macet sebelum membuat ScanJob baru (khusus printer
	// secure/Epson — meniru clear_stuck_escl_jobs di server.py).
	if esclPath == "ScanJobs" && c.Request().Method == http.MethodPost && secure {
		h.clearStuckESCLJobs(printerIP)
		time.Sleep(300 * time.Millisecond)
	}

	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Gagal membaca body"})
	}

	var resp *http.Response
	var lastErr error
	for _, scheme := range schemes {
		url := fmt.Sprintf("%s://%s/eSCL/%s", scheme, printerIP, esclPath)
		req, err := http.NewRequest(c.Request().Method, url, bytes.NewReader(body))
		if err != nil {
			lastErr = err
			continue
		}
		// Salin header penting dari klien.
		for k, vals := range c.Request().Header {
			lk := strings.ToLower(k)
			if lk == "host" || lk == "cookie" || lk == "x-printer-ip" || lk == "content-length" {
				continue
			}
			for _, v := range vals {
				req.Header.Add(k, v)
			}
		}
		req.URL.RawQuery = c.Request().URL.RawQuery

		res, err := h.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		// Bila ScanJobs POST balas 503, bersihkan job macet lalu coba sekali lagi.
		if res.StatusCode == http.StatusServiceUnavailable && esclPath == "ScanJobs" && c.Request().Method == http.MethodPost {
			_ = res.Body.Close()
			h.clearStuckESCLJobs(printerIP)
			time.Sleep(600 * time.Millisecond)

			req2, _ := http.NewRequest(c.Request().Method, url, bytes.NewReader(body))
			for k, vals := range c.Request().Header {
				lk := strings.ToLower(k)
				if lk == "host" || lk == "cookie" || lk == "x-printer-ip" || lk == "content-length" {
					continue
				}
				for _, v := range vals {
					req2.Header.Add(k, v)
				}
			}
			req2.URL.RawQuery = c.Request().URL.RawQuery
			res, err = h.httpClient.Do(req2)
			if err != nil {
				lastErr = err
				continue
			}
		}

		// 404 pada protokol pertama → coba protokol berikutnya.
		if res.StatusCode == http.StatusNotFound && scheme != schemes[len(schemes)-1] {
			_ = res.Body.Close()
			continue
		}
		resp = res
		break
	}

	if resp == nil {
		return c.JSON(http.StatusBadGateway, map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Printer (%s) tidak merespon eSCL: %v", printerIP, lastErr),
		})
	}
	defer resp.Body.Close()

	// Salin header respons (kecuali hop-by-hop / encoding).
	for k, vals := range resp.Header {
		lk := strings.ToLower(k)
		if lk == "content-encoding" || lk == "content-length" || lk == "transfer-encoding" || lk == "connection" {
			continue
		}
		for _, v := range vals {
			c.Response().Header().Add(k, v)
		}
	}

	// Rewrite Location → endpoint proxy internal agar klien melanjutkan di kita.
	if loc := resp.Header.Get("Location"); loc != "" {
		rewritten := loc
		if strings.Contains(loc, "ScanJobs") {
			part := loc[strings.LastIndex(loc, "/")+1:]
			rewritten = "/api/docstation/escl/ScanJobs/" + part
		}
		c.Response().Header().Set("Location", rewritten)
		c.Response().Header().Set("X-Docstation-Job", rewritten)
	}

	return c.Stream(resp.StatusCode, resp.Header.Get("Content-Type"), resp.Body)
}

// clearStuckESCLJobs menghapus sisa ScanJob agar printer kembali Idle.
func (h *DocStationHandler) clearStuckESCLJobs(printerIP string) {
	schemes := []string{"http", "https"}
	if h.isSecure(printerIP) {
		schemes = []string{"https", "http"}
	}
	for _, scheme := range schemes {
		url := fmt.Sprintf("%s://%s/eSCL/ScanJobs", scheme, printerIP)
		req, err := http.NewRequest(http.MethodGet, url, nil)
		if err != nil {
			continue
		}
		res, err := h.httpClient.Do(req)
		if err != nil {
			continue
		}
		data, _ := io.ReadAll(res.Body)
		_ = res.Body.Close()
		if res.StatusCode != http.StatusOK || !bytes.Contains(data, []byte("ScanJob")) {
			continue
		}
		// Parse XML ringan untuk mencari JobUri/JobUrl.
		for _, jobURL := range extractJobURLs(data) {
			if !strings.HasPrefix(jobURL, "http") {
				jobURL = fmt.Sprintf("%s://%s%s", scheme, printerIP, jobURL)
			}
			delReq, _ := http.NewRequest(http.MethodDelete, jobURL, nil)
			if delReq != nil {
				if delRes, derr := h.httpClient.Do(delReq); derr == nil {
					_ = delRes.Body.Close()
				}
			}
		}
		return
	}
}

// extractJobURLs mengambil isi elemen yang berakhiran JobUri/JobUrl dari XML.
func extractJobURLs(data []byte) []string {
	var urls []string
	dec := xml.NewDecoder(bytes.NewReader(data))
	var inJob bool
	for {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			local := t.Name.Local
			inJob = strings.HasSuffix(local, "JobUri") || strings.HasSuffix(local, "JobUrl")
		case xml.CharData:
			if inJob {
				if s := strings.TrimSpace(string(t)); s != "" {
					urls = append(urls, s)
				}
			}
		case xml.EndElement:
			inJob = false
		}
	}
	return urls
}

// PrintJob menerima binary (PDF/JPEG/PNG) lalu mengirim ke printer (IPP, fallback raw 9100).
func (h *DocStationHandler) PrintJob(c echo.Context) error {
	printerIP, secure := h.resolvePrinter(c)
	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Gagal membaca data cetak"})
	}
	if len(body) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data print kosong"})
	}

	var sendErr error
	switch {
	case bytes.HasPrefix(body, []byte{0xFF, 0xD8}): // JPEG
		sendErr = h.sendIPP(printerIP, secure, body, "image/jpeg")
	case bytes.HasPrefix(body, []byte{0x89, 0x50, 0x4E, 0x47}): // PNG
		sendErr = h.sendIPP(printerIP, secure, body, "image/png")
	case bytes.HasPrefix(body, []byte("%PDF")): // PDF
		sendErr = h.sendIPP(printerIP, secure, body, "application/pdf")
		if sendErr != nil {
			sendErr = h.sendRaw9100(printerIP, body)
		}
	default:
		sendErr = h.sendRaw9100(printerIP, body)
	}

	if sendErr != nil {
		return c.JSON(http.StatusBadGateway, map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Gagal mengirim cetakan ke printer (%s): %v", printerIP, sendErr),
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Pekerjaan cetak berhasil dikirim ke printer (%s)", printerIP),
	})
}

// PrintIPP sama dengan PrintJob (eksplisit IPP) untuk kompatibilitas klien lama.
func (h *DocStationHandler) PrintIPP(c echo.Context) error {
	return h.PrintJob(c)
}

// sendIPP membangun payload IPP dan mengirimnya via HTTP ke port 631.
func (h *DocStationHandler) sendIPP(printerIP string, secure bool, payload []byte, docFormat string) error {
	scheme := "http"
	if secure {
		scheme = "https"
	}
	ippURI := fmt.Sprintf("ipp://%s/ipp/print", printerIP)
	url := fmt.Sprintf("%s://%s:631/ipp/print", scheme, printerIP)

	ippBody := buildIPPPrintJob(ippURI, "DocStation_Job", docFormat, payload)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(ippBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/ipp")
	req.ContentLength = int64(len(ippBody))

	res, err := h.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)

	if res.StatusCode == http.StatusOK && len(respBody) >= 4 {
		statusCode := int(respBody[2])<<8 | int(respBody[3])
		if statusCode == 0x0000 || statusCode == 0x0001 || statusCode == 0x0002 {
			return nil
		}
	}
	return fmt.Errorf("IPP status HTTP %d", res.StatusCode)
}

// sendRaw9100 mengirim payload mentah ke raw socket printer (port 9100).
func (h *DocStationHandler) sendRaw9100(printerIP string, payload []byte) error {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(printerIP, "9100"), 5*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()
	_ = conn.SetWriteDeadline(time.Now().Add(45 * time.Second))
	if _, err := conn.Write(payload); err != nil {
		return err
	}
	return nil
}

// buildIPPPrintJob menyusun payload IPP 1.1 "Print-Job" (mirip make_ipp_print_job di server.py).
func buildIPPPrintJob(printerURI, jobName, docFormat string, payload []byte) []byte {
	req := make([]byte, 0, 256+len(payload))
	req = append(req,
		0x01, 0x01, // version 1.1
		0x00, 0x02, // operation: Print-Job
		0x00, 0x00, 0x00, 0x01, // request-id = 1
		0x01, // operation-attributes-tag
	)

	addAttr := func(tag byte, name, value string) {
		nb := []byte(name)
		vb := []byte(value)
		req = append(req, tag)
		req = append(req, byte(len(nb)>>8), byte(len(nb)&0xff))
		req = append(req, nb...)
		req = append(req, byte(len(vb)>>8), byte(len(vb)&0xff))
		req = append(req, vb...)
	}

	addAttr(0x47, "attributes-charset", "utf-8")
	addAttr(0x48, "attributes-natural-language", "en-us")
	addAttr(0x45, "printer-uri", printerURI)
	addAttr(0x42, "job-name", jobName)
	addAttr(0x49, "document-format", docFormat)
	req = append(req, 0x03) // end-of-attributes-tag
	req = append(req, payload...)
	return req
}
