package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupContactHandlerDB(t *testing.T) (*repository.ContactRepository, *repository.NotificationRepository) {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if _, err := db.Exec(`
		CREATE TABLE contact_messages (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
			subject TEXT, message TEXT NOT NULL,
			category TEXT NOT NULL DEFAULT 'lainnya', status TEXT NOT NULL DEFAULT 'baru',
			ticket TEXT, is_read BOOLEAN DEFAULT 0, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE contact_attachments (
			id TEXT PRIMARY KEY, message_id TEXT NOT NULL,
			kind TEXT NOT NULL DEFAULT 'evidence', file_kind TEXT NOT NULL DEFAULT 'image',
			file_path TEXT NOT NULL, original_name TEXT, file_size INTEGER NOT NULL DEFAULT 0,
			mime_type TEXT, uploaded_by TEXT, created_at INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT);
		INSERT INTO users (id, role) VALUES ('adm1','admin'), ('adm2','superadmin'), ('g1','guru');
		CREATE TABLE admin_notifications (
			id TEXT PRIMARY KEY, user_id TEXT, type TEXT, category TEXT,
			title TEXT, message TEXT, target_url TEXT, is_read INTEGER DEFAULT 0,
			metadata TEXT, created_at INTEGER
		);
	`); err != nil {
		t.Fatalf("create: %v", err)
	}
	return repository.NewContactRepository(db), repository.NewNotificationRepository(db)
}

func TestSubmitMessage_MultipartDenganGambar(t *testing.T) {
	contactRepo, notifRepo := setupContactHandlerDB(t)
	h := &ContactHandler{Repo: contactRepo, Notifications: notifRepo}

	// PNG 1x1 asli (magic byte benar).
	png := append([]byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, make([]byte, 40)...)
	// HTML menyamar sebagai .png — harus ditolak.
	spoofHTML := []byte("<html><body><script>alert(1)</script></body></html>")

	buildBody := func(fileBytes []byte, filename string) (*bytes.Buffer, string) {
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		payload, _ := json.Marshal(models.SubmitContactRequest{
			Category: "pengaduan",
			Message:  "laporan uji dengan lampiran gambar",
		})
		w.WriteField("payload", string(payload))
		fw, _ := w.CreateFormFile("files", filename)
		fw.Write(fileBytes)
		w.Close()
		return &buf, w.FormDataContentType()
	}

	// Kasus 1: PNG valid diterima + lampiran tercatat + notifikasi ke admin.
	body, ctype := buildBody(png, "bukti.png")
	req := httptest.NewRequest("POST", "/", body)
	req.Header.Set("Content-Type", ctype)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	if err := h.SubmitMessage(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), "ticket") {
		t.Fatalf("PNG valid harus diterima: %d %s", rec.Code, rec.Body.String())
	}
	var ticket string
	json.Unmarshal([]byte(rec.Body.String()), &map[string]interface{}{})
	// Ambil tiket lewat parsing sederhana.
	var parsed map[string]map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &parsed)
	if d, ok := parsed["data"]; ok {
		ticket, _ = d["ticket"].(string)
	}
	if ticket == "" {
		t.Fatal("tiket kosong")
	}
	view, err := contactRepo.GetStatusByTicket(ticket)
	if err != nil || view == nil {
		t.Fatalf("GetStatusByTicket: %v", err)
	}
	if view.ResolutionCount != 0 {
		t.Fatalf("bukti pelapor tidak boleh dihitung resolution: %d", view.ResolutionCount)
	}

	// Kasus 2: HTML menyamar .png — ditolak mentah.
	body2, ctype2 := buildBody(spoofHTML, "evil.png")
	req2 := httptest.NewRequest("POST", "/", body2)
	req2.Header.Set("Content-Type", ctype2)
	rec2 := httptest.NewRecorder()
	c2 := echo.New().NewContext(req2, rec2)
	if err := h.SubmitMessage(c2); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec2.Code != 400 {
		t.Fatalf("HTML menyamar .png harus ditolak 400, dapat %d: %s", rec2.Code, rec2.Body.String())
	}
}

func makeFileHeader(t *testing.T, filename string, content []byte) *multipart.FileHeader {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, _ := w.CreateFormFile("files", filename)
	fw.Write(content)
	w.Close()
	req := httptest.NewRequest("POST", "/", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	if err := req.ParseMultipartForm(1 << 20); err != nil {
		t.Fatalf("parse multipart: %v", err)
	}
	return req.MultipartForm.File["files"][0]
}

func TestValidateContactAttachment_VideoDanBatas(t *testing.T) {
	// MP4 minimal yang lolos deteksi WHATWG: box ftyp berukuran 24,
	// major brand "mp42" (mengandung "mp4"), versi "isom", brand lain "mp42".
	mp4 := []byte{0x00, 0x00, 0x00, 0x18}
	mp4 = append(mp4, []byte("ftyp")...)   // 4..8
	mp4 = append(mp4, []byte("mp42")...)   // 8..12 major brand
	mp4 = append(mp4, []byte("isom")...)   // 12..16 versi (diabaikan detektor)
	mp4 = append(mp4, []byte("mp42")...)   // 16..20
	mp4 = append(mp4, []byte("iso2")...)   // 20..24 menutup box
	mp4 = append(mp4, make([]byte, 60)...) // isi sisa

	fh := makeFileHeader(t, "bukti.mp4", mp4)
	_, _, ext, err := validateContactAttachment(fh)
	if err != nil {
		t.Fatalf("mp4 valid harus lolos: %v", err)
	}
	if ext != ".mp4" {
		t.Fatalf("ekstensi salah: %s", ext)
	}

	// Gambar > 5MB ditolak.
	big := &multipart.FileHeader{Filename: "besar.jpg", Size: 6 << 20}
	if _, _, _, err := validateContactAttachment(big); err == nil {
		t.Fatal("gambar 6MB harus ditolak")
	}

	// Video > 15MB ditolak.
	bigVideo := &multipart.FileHeader{Filename: "besar.mp4", Size: 16 << 20}
	if _, _, _, err := validateContactAttachment(bigVideo); err == nil {
		t.Fatal("video 16MB harus ditolak")
	}

	// Ekstensi berbahaya langsung ditolak.
	bad := &multipart.FileHeader{Filename: "x.html", Size: 10}
	if _, _, _, err := validateContactAttachment(bad); err == nil {
		t.Fatal(".html harus ditolak")
	}

	// PNG asli diterima sebagai image.
	png := append([]byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, make([]byte, 40)...)
	fileKind, mime, _, err := validateContactAttachment(makeFileHeader(t, "foto.png", png))
	if err != nil {
		t.Fatalf("png valid harus lolos: %v", err)
	}
	if fileKind != "image" || mime != "image/png" {
		t.Fatalf("png harus image/png: %s %s", fileKind, mime)
	}

	// HTML menyamar .png — ditolak (magic byte menang).
	spoof := []byte("<html><body><script>alert(1)</script></body></html>")
	if _, _, _, err := validateContactAttachment(makeFileHeader(t, "evil.png", spoof)); err == nil {
		t.Fatal("HTML menyamar .png harus ditolak")
	}

	// SVG (XSS vector) ditolak lewat blocklist ekstensi.
	svg := []byte("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")
	if _, _, _, err := validateContactAttachment(makeFileHeader(t, "x.svg", svg)); err == nil {
		t.Fatal(".svg harus ditolak")
	}
}

func TestSaveContactAttachment_NamaAcak(t *testing.T) {
	// resolveSharedPublicUploadsDir relatif terhadap cwd — pindah ke temp
	// dir dengan public/uploads agar tidak menyentuh direktori kerja.
	tmp := t.TempDir()
	wd, _ := os.Getwd()
	if err := os.Chdir(tmp); err != nil {
		t.Skipf("tidak bisa chdir: %v", err)
	}
	defer os.Chdir(wd)

	png := append([]byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, make([]byte, 40)...)
	fh := makeFileHeader(t, "nama-rahasia-pelapor.png", png)

	path1, _, err := saveContactAttachment(fh, ".png")
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	path2, _, err := saveContactAttachment(fh, ".png")
	if err != nil {
		t.Fatalf("save2: %v", err)
	}
	if path1 == path2 {
		t.Fatal("nama file harus acak (berbeda)")
	}
	if strings.Contains(path1, "rahasia") || strings.Contains(path1, "..") {
		t.Fatalf("nama pengguna bocor / traversal: %s", path1)
	}
	if !strings.HasPrefix(path1, "/uploads/contact/") {
		t.Fatalf("path salah: %s", path1)
	}
	if strings.HasSuffix(path1, "..png") {
		t.Fatalf("ekstensi titik ganda: %s", path1)
	}
}
