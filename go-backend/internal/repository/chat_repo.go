package repository

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/util"
)

// ChatRepository akses data fitur chat (DM 1-1). Mengikuti pola repo
// lain: *sql.DB mentah, placeholder ?, id cuid2, waktu unix-ms.
type ChatRepository struct {
	DB *sql.DB
}

func NewChatRepository(db *sql.DB) *ChatRepository {
	return &ChatRepository{DB: db}
}

// scanMessage memetakan baris chat_messages ke model. Urutan kolom harus
// sama dengan SELECT di tiap method: id, conversation_id, sender_id,
// content, attachment_url, attachment_kind, attachment_name, created_at.
func scanMessage(s rowScanner) (models.ChatMessage, error) {
	var m models.ChatMessage
	var attURL, attKind, attName sql.NullString
	err := s.Scan(
		&m.ID, &m.ConversationID, &m.SenderID, &m.Content,
		&attURL, &attKind, &attName, &m.CreatedAt,
	)
	if err != nil {
		return m, err
	}
	if attURL.Valid {
		m.AttachmentURL = &attURL.String
	}
	if attKind.Valid {
		m.AttachmentKind = &attKind.String
	}
	if attName.Valid {
		m.AttachmentName = &attName.String
	}
	return m, nil
}

// chatMessageColumns daftar kolom untuk SELECT pesan (urutan scanMessage).
const chatMessageColumns = `
	id, conversation_id, sender_id, content, attachment_url, attachment_kind, attachment_name, created_at
`

// FindOrCreateDirect mencari percakapan DM antara dua user; bila tidak
// ada, buat baru. Mengembalikan (conversationID, created, error).
func (r *ChatRepository) FindOrCreateDirect(userA, userB string) (string, bool, error) {
	if userA == "" || userB == "" || userA == userB {
		return "", false, errors.New("pasangan peserta tidak valid")
	}

	var existing string
	err := r.DB.QueryRow(`
		SELECT cp1.conversation_id
		FROM chat_participants cp1
		JOIN chat_participants cp2 ON cp2.conversation_id = cp1.conversation_id
		JOIN chat_conversations c ON c.id = cp1.conversation_id AND c.type = 'direct'
		WHERE cp1.user_id = ? AND cp2.user_id = ? AND cp1.user_id <> cp2.user_id
		LIMIT 1
	`, userA, userB).Scan(&existing)
	if err == nil {
		return existing, false, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", false, err
	}

	now := time.Now().UnixMilli()
	convID := cuid2.Generate()

	tx, err := r.DB.Begin()
	if err != nil {
		return "", false, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`
		INSERT INTO chat_conversations (id, type, created_by, created_at, updated_at)
		VALUES (?, 'direct', ?, ?, ?)
	`, convID, userA, now, now); err != nil {
		return "", false, err
	}
	if _, err := tx.Exec(`
		INSERT INTO chat_participants (id, conversation_id, user_id, last_read_at, archived, joined_at)
		VALUES (?, ?, ?, 0, 0, ?), (?, ?, ?, 0, 0, ?)
	`, cuid2.Generate(), convID, userA, now,
		cuid2.Generate(), convID, userB, now); err != nil {
		return "", false, err
	}

	if err := tx.Commit(); err != nil {
		return "", false, err
	}
	return convID, true, nil
}

// IsParticipant memastikan user masih peserta aktif (tidak diarsipkan).
func (r *ChatRepository) IsParticipant(convID, userID string) (bool, error) {
	var one int
	err := r.DB.QueryRow(`
		SELECT 1 FROM chat_participants
		WHERE conversation_id = ? AND user_id = ? AND archived = 0
	`, convID, userID).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// GetOtherParticipant lawan bicara dalam DM (untuk notifikasi offline).
func (r *ChatRepository) GetOtherParticipant(convID, userID string) (string, error) {
	var other string
	err := r.DB.QueryRow(`
		SELECT user_id FROM chat_participants
		WHERE conversation_id = ? AND user_id <> ? AND archived = 0
		LIMIT 1
	`, convID, userID).Scan(&other)
	if errors.Is(err, sql.ErrNoRows) {
		return "", models.ErrNotParticipant
	}
	return other, err
}

// CreateMessage menyimpan pesan + bump updated_at percakapan (pemikat
// sorting daftar percakapan). Content disanitasi di sini.
func (r *ChatRepository) CreateMessage(m models.ChatMessage) (models.ChatMessage, error) {
	if m.ID == "" {
		m.ID = cuid2.Generate()
	}
	if m.CreatedAt == 0 {
		m.CreatedAt = time.Now().UnixMilli()
	}
	content := util.SanitizePlainText(m.Content)
	if content == "" && m.AttachmentURL == nil {
		return m, errors.New("pesan tidak boleh kosong")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return m, err
	}
	defer tx.Rollback()

	// created_at harus monotonik naik dalam satu percakapan: bila dua pesan
	// dibuat di milidetik yang sama, ordering & cursor pagination (dan read
	// receipt) jadi tidak deterministik. Geser ke max+1 bila menabrak.
	var maxCreatedAt int64
	if err := tx.QueryRow(`
		SELECT COALESCE(MAX(created_at), 0) FROM chat_messages WHERE conversation_id = ?
	`, m.ConversationID).Scan(&maxCreatedAt); err != nil {
		return m, err
	}
	if m.CreatedAt <= maxCreatedAt {
		m.CreatedAt = maxCreatedAt + 1
	}

	if _, err := tx.Exec(`
		INSERT INTO chat_messages
			(id, conversation_id, sender_id, content, attachment_url, attachment_kind, attachment_name, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, m.ID, m.ConversationID, m.SenderID, content,
		m.AttachmentURL, m.AttachmentKind, m.AttachmentName, m.CreatedAt); err != nil {
		return m, err
	}
	if _, err := tx.Exec(`
		UPDATE chat_conversations SET updated_at = ? WHERE id = ?
	`, m.CreatedAt, m.ConversationID); err != nil {
		return m, err
	}
	if err := tx.Commit(); err != nil {
		return m, err
	}

	m.Content = content
	return m, nil
}

// GetMessageByID mengambil satu pesan (mis. konfirmasi setelah kirim).
func (r *ChatRepository) GetMessageByID(id string) (*models.ChatMessage, error) {
	row := r.DB.QueryRow(`
		SELECT `+chatMessageColumns+` FROM chat_messages WHERE id = ?
	`, id)
	m, err := scanMessage(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ListMessages mengambil pesan terurut kronologis (ascending), mulai dari
// yang lebih baru lalu mundur ke pesan lama sebelum cursor. Limit+1 untuk
// menentukan HasMore tanpa query COUNT terpisah.
func (r *ChatRepository) ListMessages(convID, userID string, cursor *int64, limit int) (models.ChatHistoryResponse, error) {
	ok, err := r.IsParticipant(convID, userID)
	if err != nil {
		return models.ChatHistoryResponse{}, err
	}
	if !ok {
		return models.ChatHistoryResponse{}, models.ErrNotParticipant
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}

	query := `
		SELECT ` + chatMessageColumns + `
		FROM chat_messages
		WHERE conversation_id = ? AND deleted_at IS NULL
	`
	args := []interface{}{convID}
	if cursor != nil {
		query += " AND created_at < ?"
		args = append(args, *cursor)
	}
	query += " ORDER BY created_at DESC, id DESC LIMIT ?"
	args = append(args, limit+1)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return models.ChatHistoryResponse{}, err
	}
	defer rows.Close()

	out := make([]models.ChatMessage, 0, limit)
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return models.ChatHistoryResponse{}, err
		}
		out = append(out, m)
	}

	hasMore := len(out) > limit
	if hasMore {
		out = out[:limit]
	}
	// Balik ke ascending supaya siap dirender langsung.
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}

	var nextCursor *int64
	if hasMore && len(out) > 0 {
		oldest := out[0].CreatedAt
		nextCursor = &oldest
	}

	return models.ChatHistoryResponse{
		Data:       out,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

// ListConversations daftar percakapan user: lawan bicara, pesan terakhir,
// jumlah belum dibaca, dan last_read_at lawan bicara (read receipt).
// Tiap query dijalankan cursor-nya ditutup dulu sebelum query berikutnya
// (ramah pool koneksi kecil).
func (r *ChatRepository) ListConversations(userID string, limit, offset int) ([]models.ChatConversationView, int, error) {
	if limit < 1 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := r.DB.Query(`
		SELECT c.id, c.type, c.created_by, c.created_at, c.updated_at,
		       o.user_id, o.last_read_at,
		       u.full_name, u.name, u.email, u.role, u.image
		FROM chat_participants cp
		JOIN chat_conversations c ON c.id = cp.conversation_id
		JOIN chat_participants o ON o.conversation_id = cp.conversation_id AND o.user_id <> cp.user_id
		LEFT JOIN users u ON u.id = o.user_id
		WHERE cp.user_id = ? AND cp.archived = 0
		ORDER BY c.updated_at DESC
		LIMIT ? OFFSET ?
	`, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	views := make([]models.ChatConversationView, 0)
	convIDs := make([]string, 0)
	for rows.Next() {
		var (
			v                                   models.ChatConversationView
			otherID, fullName, name, email, role, image sql.NullString
		)
		if err := rows.Scan(
			&v.ID, &v.Type, &v.CreatedBy, &v.CreatedAt, &v.UpdatedAt,
			&otherID, &v.OtherLastReadAt,
			&fullName, &name, &email, &role, &image,
		); err != nil {
			rows.Close()
			return nil, 0, err
		}
		// Nama tampilan: full_name > name > email.
		display := ""
		switch {
		case fullName.Valid && strings.TrimSpace(fullName.String) != "":
			display = fullName.String
		case name.Valid && strings.TrimSpace(name.String) != "":
			display = name.String
		case email.Valid:
			display = email.String
		}
		other := &models.ChatUserSummary{
			Name:  display,
			Email: email.String,
			Role:  role.String,
		}
		if image.Valid && image.String != "" {
			other.Image = &image.String
		}
		if otherID.Valid {
			other.ID = otherID.String
		}
		v.OtherUser = other
		views = append(views, v)
		convIDs = append(convIDs, v.ID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	if len(convIDs) == 0 {
		return views, 0, nil
	}

	// Pesan terakhir per percakapan (window function; modernc/sqlite >= 3.25).
	lastRows, err := r.DB.Query(`
		SELECT `+chatMessageColumns+` FROM (
			SELECT *, ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at DESC, id DESC) AS rn
			FROM chat_messages
			WHERE deleted_at IS NULL AND conversation_id IN (`+placeholders(len(convIDs))+`)
		) WHERE rn = 1
	`, toIface(convIDs)...)
	if err != nil {
		return nil, 0, err
	}
	lastMap := make(map[string]models.ChatMessage, len(convIDs))
	for lastRows.Next() {
		m, err := scanMessage(lastRows)
		if err != nil {
			lastRows.Close()
			return nil, 0, err
		}
		lastMap[m.ConversationID] = m
	}
	lastRows.Close()

	// Jumlah belum dibaca: pesan orang lain setelah last_read_at saya.
	unreadArgs := append([]interface{}{userID, userID}, toIface(convIDs)...)
	unreadRows, err := r.DB.Query(`
		SELECT m.conversation_id, COUNT(*)
		FROM chat_messages m
		JOIN chat_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ?
		WHERE m.sender_id <> ? AND m.created_at > cp.last_read_at AND m.deleted_at IS NULL
		  AND m.conversation_id IN (`+placeholders(len(convIDs))+`)
		GROUP BY m.conversation_id
	`, unreadArgs...)
	if err != nil {
		return nil, 0, err
	}
	unreadMap := make(map[string]int, len(convIDs))
	for unreadRows.Next() {
		var cid string
		var n int
		if err := unreadRows.Scan(&cid, &n); err == nil {
			unreadMap[cid] = n
		}
	}
	unreadRows.Close()

	for i := range views {
		if lm, ok := lastMap[views[i].ID]; ok {
			lmCopy := lm
			views[i].LastMessage = &lmCopy
		}
		views[i].UnreadCount = unreadMap[views[i].ID]
	}

	return views, len(views), nil
}

// MarkRead tandai pesan sampai sekarang sudah dibaca; kembalikan cap waktu
// baru (dipakai sebagai read receipt untuk pihak lawan bicara).
func (r *ChatRepository) MarkRead(convID, userID string) (int64, error) {
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		UPDATE chat_participants SET last_read_at = ?
		WHERE conversation_id = ? AND user_id = ? AND last_read_at < ?
	`, now, convID, userID, now)
	if err != nil {
		return 0, err
	}
	return now, nil
}

// ListChatUsers user aktif selain diri yang bisa diajak chat (untuk
// dialog percakapan baru). Pencarian di full_name/name/email/username.
func (r *ChatRepository) ListChatUsers(userID, search string, limit int) ([]models.ChatUserSummary, error) {
	if limit < 1 || limit > 100 {
		limit = 20
	}
	q := strings.TrimSpace(search)
	like := "%" + q + "%"

	rows, err := r.DB.Query(`
		SELECT u.id,
		       COALESCE(NULLIF(u.full_name,''), NULLIF(u.name,''), u.email),
		       u.email, u.role, u.image
		FROM users u
		WHERE u.is_active = 1 AND u.id <> ?
		  AND (? = '' OR u.full_name LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)
		ORDER BY COALESCE(NULLIF(u.full_name,''), NULLIF(u.name,''), u.email)
		LIMIT ?
	`, userID, q, like, like, like, like, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.ChatUserSummary, 0)
	for rows.Next() {
		var u models.ChatUserSummary
		var image sql.NullString
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &image); err != nil {
			return nil, err
		}
		if image.Valid && image.String != "" {
			u.Image = &image.String
		}
		out = append(out, u)
	}
	return out, nil
}

// GetUserSummary info minimal satu user (nama tampilan, role, foto) —
// dipakai untuk identitas pengirim di notifikasi & event real-time.
func (r *ChatRepository) GetUserSummary(userID string) (*models.ChatUserSummary, error) {
	var u models.ChatUserSummary
	var fullName, name, image sql.NullString
	err := r.DB.QueryRow(`
		SELECT u.id, u.full_name, u.name, u.email, u.role, u.image
		FROM users u
		WHERE u.id = ? AND u.is_active = 1
	`, userID).Scan(&u.ID, &fullName, &name, &u.Email, &u.Role, &image)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	switch {
	case fullName.Valid && strings.TrimSpace(fullName.String) != "":
		u.Name = fullName.String
	case name.Valid && strings.TrimSpace(name.String) != "":
		u.Name = name.String
	default:
		u.Name = u.Email
	}
	if image.Valid && image.String != "" {
		u.Image = &image.String
	}
	return &u, nil
}

// ListPartnerUserIDs semua user yang punya percakapan aktif dengan user
// ini — dipakai untuk menyiarkan status online/offline (presence).
func (r *ChatRepository) ListPartnerUserIDs(userID string) ([]string, error) {
	rows, err := r.DB.Query(`
		SELECT DISTINCT o.user_id
		FROM chat_participants cp
		JOIN chat_participants o ON o.conversation_id = cp.conversation_id AND o.user_id <> cp.user_id
		WHERE cp.user_id = ? AND cp.archived = 0
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, nil
}

// placeholders membuat "?,?,?" untuk klausa IN.
func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.Repeat("?,", n-1) + "?"
}

// toIface mengubah slice string menjadi []interface{} untuk argumen query.
func toIface(ids []string) []interface{} {
	out := make([]interface{}, 0, len(ids))
	for _, id := range ids {
		out = append(out, id)
	}
	return out
}
