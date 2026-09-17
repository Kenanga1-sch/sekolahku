package repository

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/sekolahku/go-backend/internal/models"
)

func setupChatTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	schema := `
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT,
			email TEXT UNIQUE,
			image TEXT,
			username TEXT,
			role TEXT DEFAULT 'user',
			full_name TEXT,
			is_active INTEGER DEFAULT 1,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE chat_conversations (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL DEFAULT 'direct',
			created_by TEXT NOT NULL,
			created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE chat_participants (
			id TEXT PRIMARY KEY,
			conversation_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			last_read_at INTEGER NOT NULL DEFAULT 0,
			archived INTEGER NOT NULL DEFAULT 0,
			joined_at INTEGER NOT NULL DEFAULT 0,
			UNIQUE(conversation_id, user_id)
		);
		CREATE TABLE chat_messages (
			id TEXT PRIMARY KEY,
			conversation_id TEXT NOT NULL,
			sender_id TEXT NOT NULL,
			content TEXT NOT NULL DEFAULT '',
			attachment_url TEXT,
			attachment_kind TEXT,
			attachment_name TEXT,
			created_at INTEGER NOT NULL DEFAULT 0,
			edited_at INTEGER,
			deleted_at INTEGER
		);
		CREATE INDEX idx_chat_messages_conv_created ON chat_messages(conversation_id, created_at, id);
		CREATE INDEX idx_chat_participants_user ON chat_participants(user_id, archived);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}

	// Seed dua user aktif + satu nonaktif.
	if _, err := db.Exec(`
		INSERT INTO users (id, name, full_name, email, role, is_active) VALUES
			('u_guru', 'Pak Budi', 'Budi Santoso', 'budi@sekolah.id', 'guru', 1),
			('u_ortu', 'Ibu Siti', 'Siti Aminah', 'siti@sekolah.id', 'orangtua', 1),
			('u_mati', 'Nonaktif', 'Nonaktif', 'mati@sekolah.id', 'staff', 0);
	`); err != nil {
		t.Fatalf("seed users: %v", err)
	}
	return db
}

// TestFindOrCreateDirectIdempotent memastikan percakapan DM yang sama
// dikembalikan bila dibuat ulang (tidak menduplikasi).
func TestFindOrCreateDirectIdempotent(t *testing.T) {
	db := setupChatTestDB(t)
	defer db.Close()
	repo := NewChatRepository(db)

	conv1, created1, err := repo.FindOrCreateDirect("u_guru", "u_ortu")
	if err != nil {
		t.Fatalf("create pertama: %v", err)
	}
	if !created1 {
		t.Fatal("percakapan baru harusnya created=true")
	}

	conv2, created2, err := repo.FindOrCreateDirect("u_ortu", "u_guru")
	if err != nil {
		t.Fatalf("create kedua: %v", err)
	}
	if created2 {
		t.Fatal("percakapan yang sudah ada harusnya created=false")
	}
	if conv1 != conv2 {
		t.Fatalf("id percakapan berbeda: %s vs %s", conv1, conv2)
	}

	// Peserta harus tepat dua.
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM chat_participants WHERE conversation_id = ?`, conv1).Scan(&n); err != nil {
		t.Fatalf("count participants: %v", err)
	}
	if n != 2 {
		t.Fatalf("jumlah peserta = %d, want 2", n)
	}
}

// TestFindOrCreateDirectRejectsSelfChat melindungi dari percakapan dengan
// diri sendiri (akan melanggar UNIQUE(conversation_id, user_id)).
func TestFindOrCreateDirectRejectsSelfChat(t *testing.T) {
	db := setupChatTestDB(t)
	defer db.Close()
	repo := NewChatRepository(db)

	if _, _, err := repo.FindOrCreateDirect("u_guru", "u_guru"); err == nil {
		t.Fatal("chat dengan diri sendiri harus ditolak")
	}
}

// TestCreateMessageSanitizesContent memastikan tag HTML dibuang sebelum
// disimpan (chat dirender sebagai plain text di klien).
func TestCreateMessageSanitizesContent(t *testing.T) {
	db := setupChatTestDB(t)
	defer db.Close()
	repo := NewChatRepository(db)

	convID, _, err := repo.FindOrCreateDirect("u_guru", "u_ortu")
	if err != nil {
		t.Fatalf("create conv: %v", err)
	}

	dirty := `Halo <script>alert(1)</script><b>tebal</b>`
	saved, err := repo.CreateMessage(models.ChatMessage{
		ConversationID: convID,
		SenderID:       "u_guru",
		Content:        dirty,
	})
	if err != nil {
		t.Fatalf("CreateMessage: %v", err)
	}
	if saved.Content != "Halo tebal" {
		t.Fatalf("content tidak tersanitasi: %q", saved.Content)
	}

	got, err := repo.GetMessageByID(saved.ID)
	if err != nil || got == nil {
		t.Fatalf("GetMessageByID: %v (%v)", err, got)
	}
	if got.Content != "Halo tebal" {
		t.Fatalf("content di DB tidak bersih: %q", got.Content)
	}
}

// TestCreateMessageRejectsEmpty memastikan pesan kosong (tanpa teks dan
// lampiran) ditolak.
func TestCreateMessageRejectsEmpty(t *testing.T) {
	db := setupChatTestDB(t)
	defer db.Close()
	repo := NewChatRepository(db)

	convID, _, _ := repo.FindOrCreateDirect("u_guru", "u_ortu")
	if _, err := repo.CreateMessage(models.ChatMessage{
		ConversationID: convID,
		SenderID:       "u_guru",
	}); err == nil {
		t.Fatal("pesan kosong harus ditolak")
	}

	// Pesan dengan lampiran saja boleh.
	if _, err := repo.CreateMessage(models.ChatMessage{
		ConversationID: convID,
		SenderID:       "u_guru",
		AttachmentURL:  strPtr("/uploads/chat/a.jpg"),
		AttachmentKind: strPtr("image"),
	}); err != nil {
		t.Fatalf("pesan attachment-only seharusnya boleh: %v", err)
	}
}

// TestListMessagesParticipantGuard memastikan user lain tidak bisa membaca
// percakapan yang bukan miliknya.
func TestListMessagesParticipantGuard(t *testing.T) {
	db := setupChatTestDB(t)
	defer db.Close()
	repo := NewChatRepository(db)

	convID, _, _ := repo.FindOrCreateDirect("u_guru", "u_ortu")
	if _, err := repo.CreateMessage(models.ChatMessage{
		ConversationID: convID, SenderID: "u_guru", Content: "rahasia",
	}); err != nil {
		t.Fatalf("CreateMessage: %v", err)
	}

	// Peserta boleh membaca.
	res, err := repo.ListMessages(convID, "u_ortu", nil, 50)
	if err != nil {
		t.Fatalf("ListMessages peserta: %v", err)
	}
	if len(res.Data) != 1 || res.Data[0].Content != "rahasia" {
		t.Fatalf("data pesan salah: %+v", res.Data)
	}

	// User asing ditolak.
	if _, err := repo.ListMessages(convID, "u_mati", nil, 50); err != models.ErrNotParticipant {
		t.Fatalf("user asing harus ErrNotParticipant, dapat: %v", err)
	}
}

// TestListConversationsUnreadAndLastMessage memeriksa agregasi: pesan
// terakhir, jumlah belum dibaca, dan reset setelah MarkRead.
func TestListConversationsUnreadAndLastMessage(t *testing.T) {
	db := setupChatTestDB(t)
	defer db.Close()
	repo := NewChatRepository(db)

	convID, _, _ := repo.FindOrCreateDirect("u_guru", "u_ortu")
	m1, _ := repo.CreateMessage(models.ChatMessage{ConversationID: convID, SenderID: "u_guru", Content: "satu"})
	m2, _ := repo.CreateMessage(models.ChatMessage{ConversationID: convID, SenderID: "u_guru", Content: "dua"})

	views, total, err := repo.ListConversations("u_ortu", 50, 0)
	if err != nil {
		t.Fatalf("ListConversations: %v", err)
	}
	if total != 1 || len(views) != 1 {
		t.Fatalf("total/len = %d/%d, want 1/1", total, len(views))
	}
	v := views[0]
	if v.UnreadCount != 2 {
		t.Fatalf("unread = %d, want 2", v.UnreadCount)
	}
	if v.LastMessage == nil || v.LastMessage.ID != m2.ID {
		t.Fatalf("last message salah: %+v", v.LastMessage)
	}
	if v.OtherUser == nil || v.OtherUser.ID != "u_guru" || v.OtherUser.Name != "Budi Santoso" {
		t.Fatalf("other user salah: %+v", v.OtherUser)
	}

	// Setelah dibaca, unread habis.
	if _, err := repo.MarkRead(convID, "u_ortu"); err != nil {
		t.Fatalf("MarkRead: %v", err)
	}
	views, _, err = repo.ListConversations("u_ortu", 50, 0)
	if err != nil {
		t.Fatalf("ListConversations setelah baca: %v", err)
	}
	if views[0].UnreadCount != 0 {
		t.Fatalf("unread setelah baca = %d, want 0", views[0].UnreadCount)
	}
	_ = m1
}

// TestListChatUsersOnlyActive memastikan user nonaktif tidak muncul sebagai
// calon lawan bicara, dan pencarian memfilter dengan benar.
func TestListChatUsersOnlyActive(t *testing.T) {
	db := setupChatTestDB(t)
	defer db.Close()
	repo := NewChatRepository(db)

	all, err := repo.ListChatUsers("u_guru", "", 20)
	if err != nil {
		t.Fatalf("ListChatUsers: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("jumlah user = %d, want 1 (hanya yang aktif selain diri)", len(all))
	}
	if all[0].ID != "u_ortu" {
		t.Fatalf("user yang muncul: %s, want u_ortu", all[0].ID)
	}

	hit, _ := repo.ListChatUsers("u_guru", "Siti", 20)
	if len(hit) != 1 {
		t.Fatalf("pencarian 'Siti' harus 1 hasil, dapat %d", len(hit))
	}
	miss, _ := repo.ListChatUsers("u_guru", "tidakada", 20)
	if len(miss) != 0 {
		t.Fatalf("pencarian tidak ada harus 0 hasil, dapat %d", len(miss))
	}
}

// TestGetUserSummary memeriksa urutan fallback nama tampilan.
func TestGetUserSummary(t *testing.T) {
	db := setupChatTestDB(t)
	defer db.Close()
	repo := NewChatRepository(db)

	u, err := repo.GetUserSummary("u_guru")
	if err != nil || u == nil {
		t.Fatalf("GetUserSummary: %v (%v)", err, u)
	}
	if u.Name != "Budi Santoso" {
		t.Fatalf("nama = %q, want 'Budi Santoso'", u.Name)
	}
	if u.Role != "guru" {
		t.Fatalf("role = %q, want 'guru'", u.Role)
	}

	if u, err := repo.GetUserSummary("u_mati"); err != nil || u != nil {
		t.Fatalf("user nonaktif harus nil, dapat %v (err %v)", u, err)
	}
}

// TestNotificationMarkConversationRead memastikan badge notifikasi chat
// dibersihkan saat percakapan dibuka.
func TestNotificationMarkConversationRead(t *testing.T) {
	db := setupChatTestDB(t)
	defer db.Close()

	if _, err := db.Exec(`
		CREATE TABLE admin_notifications (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			type TEXT,
			category TEXT,
			title TEXT,
			message TEXT,
			target_url TEXT,
			is_read INTEGER DEFAULT 0,
			metadata TEXT,
			created_at INTEGER
		);
	`); err != nil {
		t.Fatalf("create admin_notifications: %v", err)
	}
	nrepo := NewNotificationRepository(db)

	uid := "u_ortu"
	target := "/chat/open?c=convX"
	_ = nrepo.CreateNotification(models.Notification{UserID: &uid, Category: "chat", TargetURL: &target, Title: "Pesan"})
	// Notifikasi kategori lain dengan target sama — harus tetap belum dibaca.
	other := "/chat/open?c=convX"
	_ = nrepo.CreateNotification(models.Notification{UserID: &uid, Category: "system", TargetURL: &other, Title: "Sistem"})

	if err := nrepo.MarkConversationRead(uid, "convX"); err != nil {
		t.Fatalf("MarkConversationRead: %v", err)
	}

	var chatRead, sysRead int
	_ = db.QueryRow(`SELECT is_read FROM admin_notifications WHERE category='chat'`).Scan(&chatRead)
	_ = db.QueryRow(`SELECT is_read FROM admin_notifications WHERE category='system'`).Scan(&sysRead)
	if chatRead != 1 {
		t.Fatalf("notifikasi chat harus sudah dibaca (is_read=1)")
	}
	if sysRead != 0 {
		t.Fatalf("notifikasi non-chat tidak ikut terbaca")
	}
}
