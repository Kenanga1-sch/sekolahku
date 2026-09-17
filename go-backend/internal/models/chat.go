package models

import "errors"

// ErrNotParticipant user bukan peserta percakapan ini.
var ErrNotParticipant = errors.New("user bukan peserta percakapan")

// MaxChatContent panjang maksimum isi pesan teks (karakter).
const MaxChatContent = 5000

// ChatConversation percakapan. Saat ini hanya 'direct' (1-1); kolom Type
// disiapkan untuk 'group' tanpa perlu migrasi ulang nanti.
type ChatConversation struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	CreatedBy string `json:"createdBy"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// ChatParticipant peserta percakapan. LastReadAt dipakai menghitung pesan
// belum dibaca dan menentukan read receipt (tick biru).
type ChatParticipant struct {
	ID             string `json:"id"`
	ConversationID string `json:"conversationId"`
	UserID         string `json:"userId"`
	LastReadAt     int64  `json:"lastReadAt"`
	Archived       bool   `json:"archived"`
	JoinedAt       int64  `json:"joinedAt"`
}

// ChatMessage pesan dalam percakapan. Content selalu plain text
// (disanitasi saat ditulis). Attachment opsional untuk gambar/file.
type ChatMessage struct {
	ID             string  `json:"id"`
	ConversationID string  `json:"conversationId"`
	SenderID       string  `json:"senderId"`
	Content        string  `json:"content"`
	AttachmentURL  *string `json:"attachmentUrl"`
	AttachmentKind *string `json:"attachmentKind"`
	AttachmentName *string `json:"attachmentName"`
	CreatedAt      int64   `json:"createdAt"`
	EditedAt       *int64  `json:"editedAt"`
	DeletedAt      *int64  `json:"deletedAt"`
}

// ChatUserSummary info minimal lawan bicara (cukup untuk daftar percakapan
// & dialog percakapan baru; tidak membuka data sensitif).
type ChatUserSummary struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Email string  `json:"email"`
	Role  string  `json:"role"`
	Image *string `json:"image"`
}

// ChatConversationView daftar percakapan dari sudut pandang seorang user:
// lawan bicara, pesan terakhir, jumlah belum dibaca, dan LastReadAt lawan
// bicara (untuk read receipt).
type ChatConversationView struct {
	ChatConversation
	OtherUser       *ChatUserSummary `json:"otherUser"`
	LastMessage     *ChatMessage     `json:"lastMessage"`
	UnreadCount     int              `json:"unreadCount"`
	OtherLastReadAt int64            `json:"otherLastReadAt"`
}

// ChatHistoryResponse pesan terurut kronologis (ascending); NextCursor =
// createdAt pesan terlama untuk memuat lebih lama (cursor-based).
type ChatHistoryResponse struct {
	Data       []ChatMessage `json:"data"`
	NextCursor *int64        `json:"nextCursor"`
	HasMore    bool          `json:"hasMore"`
}

// ChatListResponse daftar percakapan + total.
type ChatListResponse struct {
	Data  []ChatConversationView `json:"data"`
	Total int                    `json:"total"`
}

// CreateConversationRequest mulai/buka percakapan DM. Idempoten: bila
// percakapan antara dua user sudah ada, dikembalikan yang itu.
type CreateConversationRequest struct {
	ParticipantID string `json:"participantId"`
}

// SendMessageRequest isi pesan baru. Wajib salah satu: content atau
// attachment (gambar/file).
type SendMessageRequest struct {
	Content        string  `json:"content"`
	AttachmentURL  *string `json:"attachmentUrl"`
	AttachmentKind *string `json:"attachmentKind"`
	AttachmentName *string `json:"attachmentName"`
}
