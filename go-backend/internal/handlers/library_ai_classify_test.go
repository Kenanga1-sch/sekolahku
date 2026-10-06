package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

// Tanpa provider AI sama sekali, endpoint harus menjawab cepat dengan
// ai_enabled=false (bukan error 500) supaya UI bisa menyembunyikan tombol AI.
func TestAIClassifyTanpaProviderMenjawabCepatDanNonaktif(t *testing.T) {
	t.Setenv("AI_API_KEY", "")
	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/library/catalog/ai-classify",
		strings.NewReader(`{"title":"Laut Bercerita","author":"Leila S. Chudori"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	h := NewLibraryHandler(&repository.LibraryRepository{}, nil)

	started := time.Now()
	if err := h.AIClassify(ctx); err != nil {
		t.Fatalf("AIClassify returned error: %v", err)
	}
	if elapsed := time.Since(started); elapsed > 3*time.Second {
		t.Fatalf("tanpa provider harus gagal cepat, memakan %s", elapsed)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response gagal: %v", err)
	}
	if resp["ai_enabled"] != false {
		t.Fatalf("ai_enabled seharusnya false, dapat %v", resp["ai_enabled"])
	}
	msg, _ := resp["message"].(string)
	if !strings.Contains(msg, "AI & LLM") {
		t.Fatalf("pesan harus mengarahkan ke pengaturan AI, dapat %q", msg)
	}
}
