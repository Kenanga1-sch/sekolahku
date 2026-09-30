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
	"sync"
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
	// Klien pendek untuk operasi bantu (clearStuck, dial status) agar tak
	// memakan timeout 90 dtk milik jalur utama.
	shortClient *http.Client
}

// Batas ukuran payload cetak/simpan (byte). PDF A4 300dpi hasil DocStation
// umumnya 1-8MB; 15MB memberi ruang untuk multi-halaman resolusi tinggi.
const docStationMaxBodyBytes = 15 << 20

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
//	DOCSTATION_SECURE_PRINTERS = "192.168.10.140"   (daftar IP https, koma-dipisah)
//	DOCSTATION_UPLOAD_DIR      = "uploads/docstation" (default, di dalam volume)
//
// Format tiap entri PRINTERS: "ip:nama" — dipisah pada ':' PERTAMA agar nama
// boleh mengandung titik-dua. Sufiks ":s" opsional menandai secure, mis.
// "192.168.10.140:Epson L6270:s". DOCSTATION_SECURE_PRINTERS menimpa/menambah
// daftar secure dari env terpisah.
//
// Bila kosong, dipakai daftar default berikut agar modul tetap berfungsi.
func NewDocStationHandler() *DocStationHandler {
	defaults := []DocStationPrinter{
		{IP: "192.168.10.131", Name: "Canon G7000 Series (LAN)", Secure: false},
		{IP: "192.168.10.140", Name: "Epson L6270 Series (Wi-Fi)", Secure: true},
	}

	secureSet := map[string]bool{}
	for _, ip := range strings.Split(os.Getenv("DOCSTATION_SECURE_PRINTERS"), ",") {
		if ip = strings.TrimSpace(ip); ip != "" {
			secureSet[ip] = true
		}
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
			secure := false
			if idx := strings.Index(entry, ":"); idx >= 0 {
				ip = strings.TrimSpace(entry[:idx])
				name = strings.TrimSpace(entry[idx+1:])
				// Sufiks ":s" → secure (https-first + clearStuck gate).
				if strings.HasSuffix(strings.ToLower(name), ":s") {
					secure = true
					name = strings.TrimSpace(name[:len(name)-2])
				}
			}
			if ip == "" {
				continue
			}
			if name == "" {
				name = ip
			}
			if secureSet[ip] {
				secure = true
			}
			parsed = append(parsed, DocStationPrinter{
				IP:     ip,
				Name:   name,
				Secure: secure,
			})
		}
		if len(parsed) > 0 {
			printers = parsed
		}
	} else if len(secureSet) > 0 {
		// Tanpa PRINTERS kustom, tandai default yang masuk daftar secure.
		for i := range printers {
			if secureSet[printers[i].IP] {
				printers[i].Secure = true
			}
		}
	}

	def := strings.TrimSpace(os.Getenv("DOCSTATION_DEFAULT_PRINTER"))
	if def == "" {
		def = printers[0].IP
	}
	// Default harus salah satu printer terdaftar; bila env menunjuk IP asing,
	// kembalikan ke printer pertama agar konsisten (bukan diam-diam ke asing).
	knownDefault := false
	for _, p := range printers {
		if p.IP == def {
			knownDefault = true
			break
		}
	}
	if !knownDefault {
		def = printers[0].IP
	}

	transport := &http.Transport{
		// Printer LAN sering memakai sertifikat self-signed.
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	return &DocStationHandler{
		printers:       printers,
		defaultPrinter: def,
		httpClient: &http.Client{
			Timeout:   90 * time.Second,
			Transport: transport,
		},
		shortClient: &http.Client{
			Timeout:   5 * time.Second,
			Transport: transport,
		},
	}
}

// resolvePrinter memilih IP printer dari header X-Printer-Ip, memvalidasi
// terhadap daftar terdaftar. Header kosong → default. Header tak dikenal →
// ERROR (bukan fallback diam-diam) agar tak salah cetak/scan ke printer lain.
func (h *DocStationHandler) resolvePrinter(c echo.Context) (string, bool, error) {
	ip := strings.TrimSpace(c.Request().Header.Get("X-Printer-Ip"))
	if ip == "" {
		return h.defaultPrinter, h.isSecure(h.defaultPrinter), nil
	}
	for _, p := range h.printers {
		if p.IP == ip {
			return p.IP, p.Secure, nil
		}
	}
	return "", false, fmt.Errorf("printer %q tidak terdaftar", ip)
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
		"success":                 true,
		"authenticated":           true,
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
// server (default uploads/docstation — di dalam volume, lolos container
// read-only). Validasi disamakan dengan arsip persuratan: ekstensi allowlist,
// magic bytes, batas ukuran, nama unik (tanpa overwrite).
func (h *DocStationHandler) SaveDocument(c echo.Context) error {
	name := c.Request().Header.Get("X-Docstation-Filename")
	if name == "" {
		name = c.QueryParam("filename")
	}
	if decoded, err := url.QueryUnescape(name); err == nil && decoded != "" {
		name = decoded
	}
	name = cleanUploadName(name)
	ext := strings.ToLower(filepath.Ext(name))
	if !isAllowedUploadExtension(ext, []string{".pdf", ".jpg", ".jpeg", ".png"}) {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": fmt.Sprintf("ekstensi file tidak diizinkan: %s", ext)})
	}

	body, err := io.ReadAll(io.LimitReader(c.Request().Body, docStationMaxBodyBytes+1))
	if err != nil || len(body) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data kosong"})
	}
	if int64(len(body)) > docStationMaxBodyBytes {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": fmt.Sprintf("ukuran file melebihi batas %d MB", docStationMaxBodyBytes/(1<<20))})
	}
	// Verifikasi isi, bukan klaim klien: tolak HTML/SVG/JS yang dilabeli gambar.
	detected := http.DetectContentType(body[:min(512, len(body))])
	if _, ok := allowedUploadMime[detected]; !ok {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": fmt.Sprintf("tipe file tidak diizinkan (terdeteksi: %s)", detected)})
	}

	dir := strings.TrimSpace(os.Getenv("DOCSTATION_UPLOAD_DIR"))
	if dir == "" {
		dir = filepath.Join("uploads", "docstation")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membuat folder arsip"})
	}

	// Nama unik: nano-timestamp + nama bersih — tak pernah menimpa berkas lama.
	name = fmt.Sprintf("%d-%s", time.Now().UnixNano(), name)
	dest := filepath.Join(dir, name)
	if err := os.WriteFile(dest, body, 0o644); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan berkas"})
	}
	c.Logger().Infof("docstation save user=%s file=%s bytes=%d", currentUserID(c), name, len(body))
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"message":  "Berkas berhasil disimpan di server",
		"filename": name,
	})
}

// PrinterStatus mengecek konektivitas TCP ke printer (port 631/9100/80).
// Dial paralel per printer + timeout global 3 dtk: 8 printer tetap <3 dtk
// (sebelumnya serial 1,2 dtk × 3 port ≈ 7 dtk untuk 2 printer).
func (h *DocStationHandler) PrinterStatus(c echo.Context) error {
	type result struct {
		IP     string `json:"ip"`
		Name   string `json:"name"`
		Online bool   `json:"online"`
	}
	results := make([]result, len(h.printers))
	var wg sync.WaitGroup
	for i, p := range h.printers {
		wg.Add(1)
		go func(i int, p DocStationPrinter) {
			defer wg.Done()
			online := false
			portCh := make(chan bool, 3)
			for _, port := range []string{"631", "9100", "80"} {
				go func(port string) {
					conn, err := net.DialTimeout("tcp", net.JoinHostPort(p.IP, port), 800*time.Millisecond)
					if err == nil {
						_ = conn.Close()
						portCh <- true
						return
					}
					portCh <- false
				}(port)
			}
			for range []string{"631", "9100", "80"} {
				if <-portCh {
					online = true
				}
			}
			results[i] = result{IP: p.IP, Name: p.Name, Online: online}
		}(i, p)
	}
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":   true,
		"status":    "ok",
		"printerIp": h.defaultPrinter,
		"printers":  results,
	})
}

// Header yang boleh diteruskan ke printer LAN. Daftar-putih eksplisit:
// TIDAK PERNAH teruskan Authorization / Cookie / X-CSRF-Token — JWT sekolah
// tak boleh bocor ke perangkat LAN pihak ketiga.
var docStationForwardHeaders = map[string]bool{
	"content-type": true,
	"accept":       true,
}

// copyESCLHeaders menyalin hanya header allowlist ke request printer.
func copyESCLHeaders(dst, src http.Header) {
	for k, vals := range src {
		if !docStationForwardHeaders[strings.ToLower(k)] {
			continue
		}
		for _, v := range vals {
			dst.Add(k, v)
		}
	}
}

// Header respons printer yang BOLEH diteruskan ke klien (allowlist ketat).
// Hanya header konten/penyamaran yang aman; sisanya diabaikan secara implisit.
var docStationResponseHeaders = map[string]bool{
	"content-type":        true,
	"content-length":      true,
	"content-disposition": true,
	"cache-control":       true,
}

// docStationDeniedResponseHeaders adalah header yang DITOLAK secara eksplisit
// meski (secara teori) sempat lolos. Printer LAN pihak ketiga tak boleh bisa
// menanam cookie/sesi di domain kita, memicu redirect (Location), memaksa
// dialog autentikasi (WWW-Authenticate), atau membocorkan versi Server-nya.
var docStationDeniedResponseHeaders = map[string]bool{
	"set-cookie":       true,
	"set-cookie2":      true,
	"location":         true,
	"www-authenticate": true,
	"server":           true,
}

// docStationHopByHopHeaders adalah header hop-by-hop (RFC 7230 §6.1) yang
// TIDAK PERNAH boleh diteruskan antar-hop, termasuk ke klien.
var docStationHopByHopHeaders = map[string]bool{
	"connection":          true,
	"keep-alive":          true,
	"proxy-authenticate":  true,
	"proxy-authorization": true,
	"te":                  true,
	"trailer":             true,
	"transfer-encoding":   true,
	"upgrade":             true,
}

// docStationSafeCustomHeader memfilter header kustom printer ("X-*") yang aman
// untuk diteruskan. Selain header allowlist di atas, hanya header berawalan
// "x-" yang lolos — dan tetap tunduk pada daftar tolak + hop-by-hop.
func docStationSafeCustomHeader(lowerKey string) bool {
	if !strings.HasPrefix(lowerKey, "x-") {
		return false
	}
	// Hormati Connection: <header> — jangan teruskan header yang diisyaratkan
	// hop-by-hop oleh peer.
	return !docStationDeniedResponseHeaders[lowerKey] && !docStationHopByHopHeaders[lowerKey]
}

// copyPrinterResponseHeaders menyalin header respons printer ke klien memakai
// ALLOWLIST ketat: hanya header konten yang aman (Content-Type, Content-Length,
// Content-Disposition, Cache-Control) plus header kustom "X-*" yang aman.
// Header sensitif (Set-Cookie/Set-Cookie2/Location/WWW-Authenticate/Server) dan
// header hop-by-hop selalu ditolak, apa pun isinya.
func copyPrinterResponseHeaders(dst, src http.Header) {
	// Header apa pun yang disebut di Connection juga bersifat hop-by-hop.
	connScoped := map[string]bool{}
	for _, v := range src.Values("Connection") {
		for _, f := range strings.Split(v, ",") {
			if f = strings.TrimSpace(strings.ToLower(f)); f != "" {
				connScoped[f] = true
			}
		}
	}

	for k, vals := range src {
		lk := strings.ToLower(k)
		if docStationDeniedResponseHeaders[lk] || docStationHopByHopHeaders[lk] || connScoped[lk] {
			continue
		}
		if !docStationResponseHeaders[lk] && !docStationSafeCustomHeader(lk) {
			continue
		}
		for _, v := range vals {
			dst.Add(k, v)
		}
	}
}

// ProxyESCL mem-forward request eSCL ke printer.
func (h *DocStationHandler) ProxyESCL(c echo.Context) error {
	printerIP, secure, err := h.resolvePrinter(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
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
	}

	body, err := io.ReadAll(io.LimitReader(c.Request().Body, docStationMaxBodyBytes+1))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Gagal membaca body"})
	}
	if int64(len(body)) > docStationMaxBodyBytes {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Body terlalu besar"})
	}

	var resp *http.Response
	var lastErr error
	usedScheme := "http"
	retriedConflict := false
	for _, scheme := range schemes {
		url := fmt.Sprintf("%s://%s/eSCL/%s", scheme, printerIP, esclPath)
		req, err := http.NewRequest(c.Request().Method, url, bytes.NewReader(body))
		if err != nil {
			lastErr = err
			continue
		}
		// Hanya header allowlist yang diteruskan ke printer (lihat di atas).
		copyESCLHeaders(req.Header, c.Request().Header)
		req.URL.RawQuery = c.Request().URL.RawQuery

		res, err := h.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		// 409 Conflict pada ScanJobs = masih ada job lama yang menggantung.
		// Firmware Canon/Epson menolak GET daftar job (405), jadi andalkan job
		// terakhir yang pernah kita buat: hapus dulu, lalu ulangi POST sekali.
		if res.StatusCode == http.StatusConflict && esclPath == "ScanJobs" &&
			c.Request().Method == http.MethodPost && !retriedConflict {
			retriedConflict = true
			if h.clearLastScanJob(printerIP) {
				_ = res.Body.Close()
				time.Sleep(500 * time.Millisecond)
				req2, err2 := http.NewRequest(c.Request().Method, url, bytes.NewReader(body))
				if err2 != nil {
					lastErr = err2
					continue
				}
				copyESCLHeaders(req2.Header, c.Request().Header)
				req2.URL.RawQuery = c.Request().URL.RawQuery
				res2, err3 := h.httpClient.Do(req2)
				if err3 != nil {
					lastErr = err3
					continue
				}
				res = res2
			}
		}

		// Bila ScanJobs POST balas 503, bersihkan job macet lalu coba sekali lagi.
		if res.StatusCode == http.StatusServiceUnavailable && esclPath == "ScanJobs" && c.Request().Method == http.MethodPost {
			_ = res.Body.Close()
			h.clearStuckESCLJobs(printerIP)

			req2, _ := http.NewRequest(c.Request().Method, url, bytes.NewReader(body))
			copyESCLHeaders(req2.Header, c.Request().Header)
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
		usedScheme = scheme
		break
	}

	if resp == nil {
		return c.JSON(http.StatusBadGateway, map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Printer (%s) tidak merespon eSCL: %v", printerIP, lastErr),
		})
	}
	defer resp.Body.Close()

	// 409 masih tersisa (tak ada job yang bisa kita hapus) → beri tahu pengguna
	// dengan jelas. Meneruskan body kosong printer hanya menghasilkan pesan
	// "menolak permintaan scan" yang tidak bisa ditindaklanjuti.
	if resp.StatusCode == http.StatusConflict && esclPath == "ScanJobs" &&
		c.Request().Method == http.MethodPost {
		return c.JSON(http.StatusConflict, map[string]interface{}{
			"success": false,
			"error": "Printer masih memproses pekerjaan scan lain. Tunggu 10-30 detik lalu coba " +
				"lagi; bila tetap gagal, cek printer (tutup/ADF/kertas) atau mulai ulang printer.",
		})
	}

	// Catat job ScanJobs yang berhasil dibuat agar bisa dibersihkan pada
	// percobaan berikutnya yang kena 409.
	if esclPath == "ScanJobs" && c.Request().Method == http.MethodPost &&
		resp.StatusCode >= 200 && resp.StatusCode < 300 {
		rememberLastScanJob(printerIP, usedScheme, resp.Header.Get("Location"))
	}

	// Salin hanya header respons allowlist dari printer ke klien. Header sensitif
	// (Set-Cookie/Location/WWW-Authenticate/Server) & hop-by-hop tak diteruskan.
	copyPrinterResponseHeaders(c.Response().Header(), resp.Header)

	// Rewrite Location → endpoint proxy internal agar klien melanjutkan di kita.
	// Printer mengembalikan ".../ScanJobs/<id>" absolut atau relatif; ambil
	// segmen terakhir setelah ScanJobs agar multi-segmen tetap benar.
	if loc := resp.Header.Get("Location"); loc != "" {
		rewritten := loc
		if idx := strings.Index(loc, "ScanJobs"); idx >= 0 {
			part := strings.Trim(loc[idx+len("ScanJobs"):], "/")
			if part != "" {
				rewritten = "/api/docstation/escl/ScanJobs/" + part
			}
		}
		c.Response().Header().Set("Location", rewritten)
		c.Response().Header().Set("X-Docstation-Job", rewritten)
	}

	c.Logger().Infof("docstation escl user=%s printer=%s %s %s -> %d", currentUserID(c), printerIP, c.Request().Method, esclPath, resp.StatusCode)
	return c.Stream(resp.StatusCode, resp.Header.Get("Content-Type"), resp.Body)
}

// clearStuckESCLJobs mencoba menghapus sisa ScanJob via daftar job.
//
// CATATAN PEMBATASAN NYATA: firmware Canon G7000 dan Epson L6270 membalas
// 405 Method Not Allowed untuk GET /eSCL/ScanJobs, sehingga fungsi ini
// berhenti di "continue" dan tidak menghapus apa pun pada kedua printer
// tersebut (hanya berguna pada firmware yang mengizinkan GET daftar job).
// Pembersihan yang benar-benar bekerja dilakukan lewat clearLastScanJob,
// yang memakai URL job yang pernah kita catat sendiri.
func (h *DocStationHandler) clearStuckESCLJobs(printerIP string) {
	lock := docStationPrinterLock(printerIP)
	lock.Lock()
	defer lock.Unlock()
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
		res, err := h.shortClient.Do(req)
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
				if delRes, derr := h.shortClient.Do(delReq); derr == nil {
					_ = delRes.Body.Close()
				}
			}
		}
		return
	}
}

// docStationLocks adalah mutex per-printer agar operasi bantu (clearStuck)
// tak berlomba dengan scan bersamaan ke printer yang sama.
var (
	docStationLocksMu sync.Mutex
	docStationLocks   = map[string]*sync.Mutex{}
)

func docStationPrinterLock(ip string) *sync.Mutex {
	docStationLocksMu.Lock()
	defer docStationLocksMu.Unlock()
	if l, ok := docStationLocks[ip]; ok {
		return l
	}
	l := &sync.Mutex{}
	docStationLocks[ip] = l
	return l
}

// docStationLastJob menyimpan URL ScanJob terakhir yang dibuat per printer
// (abs printer, mis. https://192.168.10.140/eSCL/ScanJobs/<id>).
//
// Dibutuhkan karena firmware Canon/Epson MENOLAK GET /eSCL/ScanJobs (405),
// sehingga clearStuckESCLJobs tidak pernah bisa menemukan daftar job macet
// sendiri. Tanpa catatan ini, job yang menggantung (mis. browser ditutup di
// tengah scan) membuat POST ScanJobs berikutnya selalu dibalas 409 Conflict.
var (
	docStationLastJobMu sync.Mutex
	docStationLastJob   = map[string]string{}
)

// rememberLastScanJob mencatat URL job hasil POST ScanJobs sukses.
// loc boleh absolut atau relatif (dipakai scheme saat ini).
func rememberLastScanJob(printerIP, scheme, loc string) {
	if loc == "" {
		return
	}
	if !strings.HasPrefix(loc, "http") {
		loc = fmt.Sprintf("%s://%s%s", scheme, printerIP, loc)
	}
	docStationLastJobMu.Lock()
	defer docStationLastJobMu.Unlock()
	docStationLastJob[printerIP] = loc
}

// clearLastScanJob menghapus job terakhir yang dicatat (bila masih ada) lalu
// mengembalikan true bila job sudah pasti tidak ada lagi — dipanggil saat
// printer membalas 409 Conflict agar POST bisa diulang sekali dengan printer
// bersih. Memakai shortClient (5 dtk) supaya tak menahan permintaan lama.
func (h *DocStationHandler) clearLastScanJob(printerIP string) bool {
	docStationLastJobMu.Lock()
	jobURL := docStationLastJob[printerIP]
	delete(docStationLastJob, printerIP)
	docStationLastJobMu.Unlock()
	if jobURL == "" {
		return false
	}
	req, err := http.NewRequest(http.MethodDelete, jobURL, nil)
	if err != nil {
		return false
	}
	res, err := h.shortClient.Do(req)
	if err != nil {
		return false
	}
	_ = res.Body.Close()
	// Semua 2xx (200 OK / 204 No Content) = job terhapus; 404 = job sudah
	// tidak ada lagi. Keduanya berarti printer bersih untuk POST ulang.
	if res.StatusCode >= 200 && res.StatusCode < 300 {
		return true
	}
	return res.StatusCode == http.StatusNotFound
}

// extractJobURLs mengambil isi elemen yang berakhiran JobUri/JobUrl dari XML.
// Pelacakan kedalaman (depth) dipakai agar EndElement bersarang tak menghapus
// status inJob milik elemen luar secara prematur.
func extractJobURLs(data []byte) []string {
	var urls []string
	dec := xml.NewDecoder(bytes.NewReader(data))
	inJobDepth := -1
	depth := 0
	for {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			depth++
			local := t.Name.Local
			if strings.HasSuffix(local, "JobUri") || strings.HasSuffix(local, "JobUrl") {
				inJobDepth = depth
			}
		case xml.CharData:
			if inJobDepth == depth {
				if s := strings.TrimSpace(string(t)); s != "" {
					urls = append(urls, s)
				}
			}
		case xml.EndElement:
			if inJobDepth == depth {
				inJobDepth = -1
			}
			depth--
			_ = t
		}
	}
	return urls
}

// PrintJob menerima binary (PDF/JPEG/PNG) lalu mengirim ke printer (IPP, fallback raw 9100).
func (h *DocStationHandler) PrintJob(c echo.Context) error {
	printerIP, secure, err := h.resolvePrinter(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	body, err := io.ReadAll(io.LimitReader(c.Request().Body, docStationMaxBodyBytes+1))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Gagal membaca data cetak"})
	}
	if len(body) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data print kosong"})
	}
	if int64(len(body)) > docStationMaxBodyBytes {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": fmt.Sprintf("ukuran file melebihi batas %d MB", docStationMaxBodyBytes/(1<<20))})
	}

	docFormat := ""
	var sendErr error
	switch {
	case bytes.HasPrefix(body, []byte{0xFF, 0xD8}): // JPEG
		docFormat = "image/jpeg"
		sendErr = h.sendIPP(printerIP, secure, body, docFormat)
	case bytes.HasPrefix(body, []byte{0x89, 0x50, 0x4E, 0x47}): // PNG
		docFormat = "image/png"
		sendErr = h.sendIPP(printerIP, secure, body, docFormat)
	case bytes.HasPrefix(body, []byte("%PDF")): // PDF
		docFormat = "application/pdf"
		sendErr = h.sendIPP(printerIP, secure, body, docFormat)
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
	c.Logger().Infof("docstation print user=%s printer=%s bytes=%d format=%s", currentUserID(c), printerIP, len(body), docFormat)
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
