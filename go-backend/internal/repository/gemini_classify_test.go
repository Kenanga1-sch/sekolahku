package repository

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func setupAIClassifyTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("buka db gagal: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if _, err := db.Exec(`
		CREATE TABLE ai_providers (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			provider_type TEXT NOT NULL DEFAULT 'openai',
			base_url TEXT NOT NULL DEFAULT '',
			model_name TEXT NOT NULL DEFAULT '',
			api_key_env_var TEXT NOT NULL DEFAULT '',
			api_key_value TEXT NOT NULL DEFAULT '',
			is_enabled BOOLEAN NOT NULL DEFAULT 1,
			priority INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
	`); err != nil {
		t.Fatalf("buat tabel ai_providers gagal: %v", err)
	}
	return db
}

// Provider aktif di DB harus menjadi percobaan pertama, sebelum fallback env.
func TestBuildClassifyAttemptsPrioritaskanProviderDB(t *testing.T) {
	db := setupAIClassifyTestDB(t)
	if _, err := db.Exec(`
		INSERT INTO ai_providers
			(id, name, provider_type, base_url, model_name, api_key_env_var, api_key_value, is_enabled, priority, created_at, updated_at)
		VALUES
			('9router', '9Router', 'openai', 'http://127.0.0.1:9/v1', '9router_server_dev', '', 'kunci-uji', 1, 1, 0, 0);
	`); err != nil {
		t.Fatalf("insert provider gagal: %v", err)
	}
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("GEMINI_API_KEY", "")

	r := &LibraryRepository{DB: db}
	attempts := r.buildClassifyAttempts("prompt", "")

	if len(attempts) == 0 {
		t.Fatal("provider DB aktif harus menghasilkan minimal satu percobaan")
	}
	if !strings.HasPrefix(attempts[0].label, "db:9router") {
		t.Fatalf("percobaan pertama harus provider DB, dapat %q", attempts[0].label)
	}
	if !strings.Contains(attempts[0].label, "9router_server_dev") {
		t.Fatalf("label percobaan harus memuat model terpilih, dapat %q", attempts[0].label)
	}
}

// Provider yang dimatikan (is_enabled=0) tidak boleh dipanggil.
func TestBuildClassifyAttemptsAbaikanProviderNonaktif(t *testing.T) {
	db := setupAIClassifyTestDB(t)
	if _, err := db.Exec(`
		INSERT INTO ai_providers
			(id, name, provider_type, base_url, model_name, api_key_env_var, api_key_value, is_enabled, priority, created_at, updated_at)
		VALUES
			('mati', 'Nonaktif', 'gemini', 'https://example.invalid', 'gemini-2.5-flash', '', 'kunci', 0, 1, 0, 0);
	`); err != nil {
		t.Fatalf("insert provider gagal: %v", err)
	}
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("GEMINI_API_KEY", "")

	attempts := (&LibraryRepository{DB: db}).buildClassifyAttempts("prompt", "")
	if len(attempts) != 0 {
		t.Fatalf("provider nonaktif harus diabaikan, dapat %d percobaan", len(attempts))
	}
}

// Tanpa DB maupun kunci env, pemanggilan harus gagal cepat dengan pesan jelas
// (bukan menunggu timeout) — melindungi jalur ISBN fallback yang tanpa DB.
func TestClassifyBookWithAISansProviderGagalCepat(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("AI_API_KEY", "")

	r := &LibraryRepository{}
	start := time.Now()
	_, err := r.ClassifyBookWithAI("Judul", "Penulis", "", nil, "")
	if err == nil {
		t.Fatal("tanpa provider seharusnya error")
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Fatalf("harus gagal cepat, malah memakan %s", elapsed)
	}
}

// Anggaran percobaan pertama wajib lebih pendek dari total agar fallback masih
// sempat berjalan setelah provider lambat.
func TestClassifyBudgetMeninggalkanSisaUntukFallback(t *testing.T) {
	if aiClassifyFirstAttempt >= aiClassifyTotalBudget {
		t.Fatalf("percobaan pertama (%s) harus < total (%s)", aiClassifyFirstAttempt, aiClassifyTotalBudget)
	}
	if sisa := aiClassifyTotalBudget - aiClassifyFirstAttempt; sisa < 3*time.Second {
		t.Fatalf("sisa anggaran fallback terlalu kecil: %s", sisa)
	}
}
