package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

// TestGetMessage_BentukResponsKontrak memastikan handler mengembalikan
// data.message / data.replies / data.attachments — bentuk yang diharapkan
// halaman detail (lewat handleAction yang menumpuk satu lapis data).
func TestGetMessage_BentukResponsKontrak(t *testing.T) {
	contactRepo, notifRepo := setupContactHandlerDB(t)
	h := &ContactHandler{Repo: contactRepo, Notifications: notifRepo}

	id, _, err := contactRepo.CreateMessage(models.SubmitContactRequest{
		Category: "saran",
		Message:  "pesan uji kontrak bentuk respons",
		Name:     "Pak Uji",
	})
	if err != nil {
		t.Fatalf("CreateMessage: %v", err)
	}
	if _, err := contactRepo.AddReply(id, "Saran akan diteruskan.", "adm1", "Bu Sri"); err != nil {
		t.Fatalf("AddReply: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(id)

	if err := h.GetMessage(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != 200 {
		t.Fatalf("kode: %d", rec.Code)
	}

	var body map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse: %v", err)
	}
	var dataField map[string]json.RawMessage
	if err := json.Unmarshal(body["data"], &dataField); err != nil {
		t.Fatalf("data harus objek (kontrak halaman): %v", err)
	}
	if _, ok := dataField["message"]; !ok {
		t.Fatal("data.message wajib ada (kontrak halaman detail)")
	}
	if _, ok := dataField["replies"]; !ok {
		t.Fatal("data.replies wajib ada")
	}
	if _, ok := dataField["attachments"]; !ok {
		t.Fatal("data.attachments wajib ada")
	}

	// Isi pesan benar-benar terkirim.
	var msg models.ContactMessage
	if err := json.Unmarshal(dataField["message"], &msg); err != nil {
		t.Fatalf("data.message: %v", err)
	}
	if !strings.Contains(msg.Message, "kontrak bentuk respons") || msg.Name != "Pak Uji" {
		t.Fatalf("isi message salah: %+v", msg)
	}
	var replies []models.ContactReply
	if err := json.Unmarshal(dataField["replies"], &replies); err != nil {
		t.Fatalf("data.replies: %v", err)
	}
	if len(replies) != 1 || replies[0].AuthorName != "Bu Sri" {
		t.Fatalf("replies salah: %+v", replies)
	}

	// Membuka detail menandai sudah dibaca.
	var isRead int
	db := h.Repo.DB
	db.QueryRow(`SELECT is_read FROM contact_messages WHERE id = ?`, id).Scan(&isRead)
	if isRead != 1 {
		t.Fatal("membuka detail harus menandai is_read")
	}
}

// TestGetMessage_IDTakDikenal: 404 dengan pesan jelas, bukan 500.
func TestGetMessage_IDTakDikenal(t *testing.T) {
	contactRepo, notifRepo := setupContactHandlerDB(t)
	h := &ContactHandler{Repo: contactRepo, Notifications: notifRepo}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("tidak-ada")

	if err := h.GetMessage(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != 404 || !strings.Contains(rec.Body.String(), "tidak ditemukan") {
		t.Fatalf("harus 404: %d %s", rec.Code, rec.Body.String())
	}
}

// Pastikan DB helper test tetap tersedia untuk file ini (memakai fixture
// dari contact_attachment_test.go).
var _ = sql.ErrNoRows
var _ = repository.NewContactRepository
