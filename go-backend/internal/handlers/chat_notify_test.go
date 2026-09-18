package handlers

import (
	"crypto/rand"
	"crypto/ecdsa"
	"crypto/elliptic"
	"database/sql"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/sekolahku/go-backend/internal/chat"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/push"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

// setupNotifyTestDB membangun skema minimal yang dipakai chat handler +
// notifikasi + push (in-memory SQLite).
func setupNotifyTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	schema := `
		CREATE TABLE users (
			id TEXT PRIMARY KEY, name TEXT, full_name TEXT, email TEXT UNIQUE,
			image TEXT, username TEXT, role TEXT DEFAULT 'user',
			is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE chat_conversations (
			id TEXT PRIMARY KEY, type TEXT NOT NULL DEFAULT 'direct',
			created_by TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE chat_participants (
			id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL,
			last_read_at INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
			joined_at INTEGER NOT NULL DEFAULT 0, UNIQUE(conversation_id, user_id)
		);
		CREATE TABLE chat_messages (
			id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_id TEXT NOT NULL,
			content TEXT NOT NULL DEFAULT '', attachment_url TEXT, attachment_kind TEXT,
			attachment_name TEXT, created_at INTEGER NOT NULL DEFAULT 0,
			edited_at INTEGER, deleted_at INTEGER
		);
		CREATE TABLE admin_notifications (
			id TEXT PRIMARY KEY, user_id TEXT, type TEXT, category TEXT,
			title TEXT, message TEXT, target_url TEXT, is_read INTEGER DEFAULT 0,
			metadata TEXT, created_at INTEGER
		);
		CREATE TABLE push_subscriptions (
			id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE,
			p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT,
			created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0,
			last_used_at INTEGER
		);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

// validSubscriptionKeys membuat pasangan key P-256 valid (format yang
// diharapkan webpush-go) + auth secret 16 byte, sehingga enkripsi payload
// benar-benar berhasil dan request sampai ke endpoint tiruan kita.
func validSubscriptionKeys(t *testing.T) (p256dh, auth string) {
	t.Helper()
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	pub := elliptic.Marshal(elliptic.P256(), priv.PublicKey.X, priv.PublicKey.Y)
	authBytes := make([]byte, 16)
	if _, err := rand.Read(authBytes); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(pub),
		base64.RawURLEncoding.EncodeToString(authBytes)
}

// newPushTestService membangun push.Service + server tiruan yang mencatat
// pengiriman. Mengembalikan service + jumlah pengiriman yang diterima.
func newPushTestService(t *testing.T, db *sql.DB, userID string) (*push.Service, *int32) {
	t.Helper()
	p256dh, auth := validSubscriptionKeys(t)

	var delivered int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&delivered, 1)
		w.WriteHeader(http.StatusCreated)
	}))
	t.Cleanup(srv.Close)

	pushRepo := repository.NewPushRepository(db)
	if err := pushRepo.Upsert(userID, models.PushSubscribeRequest{
		Endpoint:  srv.URL,
		P256dh:    p256dh,
		Auth:      auth,
		UserAgent: "test",
	}); err != nil {
		t.Fatalf("upsert subscription: %v", err)
	}

	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatalf("vapid keys: %v", err)
	}
	return push.NewService(pushRepo, pub, priv, "mailto:test@example.com"), &delivered
}

func newTestChatHandler(t *testing.T) (*ChatHandler, *sql.DB, *int32) {
	t.Helper()
	db := setupNotifyTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, name, full_name, email, role, is_active) VALUES
			('sender1', 'Pengirim', 'Pengirim Test', 'sender@example.com', 'admin', 1),
			('rcpt1', 'Penerima', 'Penerima Test', 'rcpt@example.com', 'orangtua', 1);
		INSERT INTO chat_conversations (id, type, created_by, created_at, updated_at)
			VALUES ('conv1', 'direct', 'sender1', 1, 1);
		INSERT INTO chat_participants (id, conversation_id, user_id, joined_at)
			VALUES ('p1','conv1','sender1',1), ('p2','conv1','rcpt1',1);
	`)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	pushSvc, delivered := newPushTestService(t, db, "rcpt1")
	h := &ChatHandler{
		Repo:   repository.NewChatRepository(db),
		Notifs: repository.NewNotificationRepository(db),
		Push:   pushSvc,
		Hub:    chat.NewHub(),
	}
	return h, db, delivered
}

func notifCount(t *testing.T, db *sql.DB, userID string) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM admin_notifications WHERE user_id = ?`, userID).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

func TestNotifyRecipientOfflinePushes(t *testing.T) {
	h, db, delivered := newTestChatHandler(t)

	h.notifyRecipient("conv1", "sender1", models.ChatMessage{Content: "halo offline"}, "rcpt1")

	if n := notifCount(t, db, "rcpt1"); n != 1 {
		t.Fatalf("penerima offline harus dapat 1 baris notifikasi, dapat %d", n)
	}
	if got := atomic.LoadInt32(delivered); got != 1 {
		t.Fatalf("penerima offline harus dikirimi push (endpoint menerima %d request)", got)
	}
}

func TestNotifyRecipientVisibleSkipsPush(t *testing.T) {
	h, db, delivered := newTestChatHandler(t)

	// Penerima online & halaman terlihat, tapi tidak membuka percakapan ini.
	conn := chat.NewConnection("rcpt1")
	h.Hub.Register(conn)

	h.notifyRecipient("conv1", "sender1", models.ChatMessage{Content: "halo visible"}, "rcpt1")

	// Baris in-app tetap dibuat (fix lonceng kosong)...
	if n := notifCount(t, db, "rcpt1"); n != 1 {
		t.Fatalf("penerima visible tetap dapat baris notifikasi, dapat %d", n)
	}
	// ...tapi TANPA Web Push (pengguna sedang melihat aplikasi).
	if got := atomic.LoadInt32(delivered); got != 0 {
		t.Fatalf("penerima visible tidak boleh dapat push, endpoint menerima %d", got)
	}
}

func TestNotifyRecipientEngagedSkipsAll(t *testing.T) {
	h, db, delivered := newTestChatHandler(t)

	conn := chat.NewConnection("rcpt1")
	h.Hub.Register(conn)
	h.Hub.SetActiveConversation(conn, "conv1") // sedang membuka percakapan ini

	h.notifyRecipient("conv1", "sender1", models.ChatMessage{Content: "halo engaged"}, "rcpt1")

	if n := notifCount(t, db, "rcpt1"); n != 0 {
		t.Fatalf("penerima engaged tidak boleh dapat baris notifikasi, dapat %d", n)
	}
	if got := atomic.LoadInt32(delivered); got != 0 {
		t.Fatalf("penerima engaged tidak boleh dapat push, endpoint menerima %d", got)
	}
}
