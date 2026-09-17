package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/chat"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/push"
	"github.com/sekolahku/go-backend/internal/repository"
)

// ChatHandler endpoint REST + WebSocket fitur chat (DM 1-1). Hub bersifat
// opsional (nil): tanpa hub, fitur chat tetap berfungsi penuh lewat REST
// (pesan tersimpan, notifikasi in-app + Web Push saat offline).
type ChatHandler struct {
	Repo   *repository.ChatRepository
	Notifs *repository.NotificationRepository
	Push   *push.Service
	Hub    *chat.Hub
}

func NewChatHandler(repo *repository.ChatRepository, notifs *repository.NotificationRepository, pushSvc *push.Service, hub *chat.Hub) *ChatHandler {
	return &ChatHandler{Repo: repo, Notifs: notifs, Push: pushSvc, Hub: hub}
}

// chatTargetURL tautan notifikasi yang membuka percakapan; halaman
// /chat/open?c=<id> di sisi klien mengarahkan ke portal yang sesuai
// (dashboard vs portal ortu) sesuai role penerima.
func chatTargetURL(convID string) string {
	return "/chat/open?c=" + convID
}

// List daftar percakapan user (lawan bicara, pesan terakhir, belum dibaca).
func (h *ChatHandler) List(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))

	views, total, err := h.Repo.ListConversations(userID, limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat percakapan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    views,
		"total":   total,
	})
}

// Create mulai atau membuka percakapan DM. Idempoten: percakapan yang
// sudah ada dikembalikan apa adanya.
func (h *ChatHandler) Create(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	var req models.CreateConversationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format data tidak valid"})
	}
	req.ParticipantID = strings.TrimSpace(req.ParticipantID)
	if req.ParticipantID == "" || req.ParticipantID == userID {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Peserta tidak valid"})
	}

	// Peserta harus ada & aktif (lookup langsung by id, bukan LIKE).
	participant, err := h.Repo.GetUserSummary(req.ParticipantID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if participant == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pengguna tidak ditemukan atau tidak aktif"})
	}

	convID, _, err := h.Repo.FindOrCreateDirect(userID, req.ParticipantID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membuat percakapan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    map[string]string{"id": convID},
	})
}

// History pesan percakapan (cursor pagination, kronologis ascending).
func (h *ChatHandler) History(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	convID := c.Param("id")
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	var cursor *int64
	if raw := strings.TrimSpace(c.QueryParam("cursor")); raw != "" {
		if v, err := strconv.ParseInt(raw, 10, 64); err == nil {
			cursor = &v
		}
	}

	res, err := h.Repo.ListMessages(convID, userID, cursor, limit)
	if err != nil {
		if err == models.ErrNotParticipant {
			return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda bukan peserta percakapan ini"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat pesan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": res})
}

// SendMessage simpan pesan baru + notifikasi penerima (in-app + push).
func (h *ChatHandler) SendMessage(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	convID := c.Param("id")

	var req models.SendMessageRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format data tidak valid"})
	}
	req.Content = strings.TrimSpace(req.Content)

	if len(req.Content) > models.MaxChatContent {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Pesan maksimal 5000 karakter"})
	}
	// Lampiran: hanya URL dari upload kita sendiri, dan kind terbatas.
	if req.AttachmentURL != nil {
		url := strings.TrimSpace(*req.AttachmentURL)
		kind := ""
		if req.AttachmentKind != nil {
			kind = strings.ToLower(strings.TrimSpace(*req.AttachmentKind))
		}
		if !strings.HasPrefix(url, "/uploads/") || (kind != "image" && kind != "file") {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Lampiran tidak valid"})
		}
		req.AttachmentURL = &url
		req.AttachmentKind = &kind
	}
	if req.Content == "" && req.AttachmentURL == nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Pesan tidak boleh kosong"})
	}

	ok, err := h.Repo.IsParticipant(convID, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if !ok {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda bukan peserta percakapan ini"})
	}

	msg, err := h.Repo.CreateMessage(models.ChatMessage{
		ConversationID: convID,
		SenderID:       userID,
		Content:        req.Content,
		AttachmentURL:  req.AttachmentURL,
		AttachmentKind: req.AttachmentKind,
		AttachmentName: req.AttachmentName,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan pesan"})
	}

	// Dorong real-time ke penerima + tab lain milik pengirim. Tab pengirim
	// yang mengirim pesan ini sudah dapat respons POST; store frontend
	// mendedupiasi berdasarkan id pesan.
	otherID, _ := h.Repo.GetOtherParticipant(convID, userID)
	if h.Hub != nil {
		ev := chat.Event{Type: chat.EventMessage, Data: msg}
		if otherID != "" {
			h.Hub.BroadcastToUser(otherID, ev)
		}
		h.Hub.BroadcastToUser(userID, ev)
		convEv := chat.Event{Type: chat.EventConversationUpdate, Data: map[string]interface{}{
			"conversationId": convID,
			"lastMessage":    msg,
		}}
		if otherID != "" {
			h.Hub.BroadcastToUser(otherID, convEv)
		}
		h.Hub.BroadcastToUser(userID, convEv)
	}

	// Notifikasi in-app + Web Push hanya bila penerima sedang offline
	// (tidak ada koneksi WS aktif) — pengguna yang sedang chat tidak perlu
	// badge tambahan untuk setiap pesan.
	go h.notifyRecipient(convID, userID, msg, otherID)

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "data": msg})
}

// notifyRecipient kirim notifikasi in-app + Web Push ke lawan bicara bila
// dia sedang offline. Dijalankan di goroutine terpisah agar request cepat
// kembali: push ke perangkat tidak boleh memblokir response.
func (h *ChatHandler) notifyRecipient(convID, senderID string, msg models.ChatMessage, recipientID string) {
	if recipientID == "" {
		var err error
		recipientID, err = h.Repo.GetOtherParticipant(convID, senderID)
		if err != nil || recipientID == "" {
			return
		}
	}
	// Pengirim sedang online → pesan sudah terkirim real-time; lewati.
	if h.Hub != nil && h.Hub.IsUserOnline(recipientID) {
		return
	}

	sender, err := h.Repo.GetUserSummary(senderID)
	senderName := "Pesan baru"
	if err == nil && sender != nil && sender.Name != "" {
		senderName = sender.Name
	}

	preview := msg.Content
	if preview == "" {
		preview = "Mengirim lampiran"
	}
	if len(preview) > 120 {
		preview = preview[:117] + "..."
	}

	target := chatTargetURL(convID)
	if h.Notifs != nil {
		rid := recipientID
		_ = h.Notifs.CreateNotification(models.Notification{
			UserID:    &rid,
			Type:      "info",
			Category:  "chat",
			Title:     senderName,
			Message:   preview,
			TargetURL: &target,
		})
	}

	if h.Push != nil && h.Push.Enabled() {
		h.Push.SendToUser(recipientID, models.PushPayload{
			Title: senderName,
			Body:  preview,
			URL:   target,
			Tag:   "chat-" + convID,
		})
	}
}

// MarkRead tandai pesan dibaca + hapus notifikasi percakapan ini.
func (h *ChatHandler) MarkRead(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	convID := c.Param("id")

	ok, err := h.Repo.IsParticipant(convID, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if !ok {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda bukan peserta percakapan ini"})
	}

	lastRead, err := h.Repo.MarkRead(convID, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menandai pesan dibaca"})
	}
	// Bersihkan badge notifikasi untuk percakapan ini.
	if h.Notifs != nil {
		_ = h.Notifs.MarkConversationRead(userID, convID)
	}
	// Siarkan read receipt ke lawan bicara (tick biru di sisi pengirim).
	if h.Hub != nil {
		if other, err := h.Repo.GetOtherParticipant(convID, userID); err == nil && other != "" {
			h.Hub.BroadcastToUser(other, chat.Event{
				Type: chat.EventRead,
				Data: chat.ReadPayload{ConversationID: convID, UserID: userID, LastReadAt: lastRead},
			})
		}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"lastReadAt": lastRead,
	})
}

// ListUsers user aktif yang bisa diajak chat (untuk dialog percakapan baru).
func (h *ChatHandler) ListUsers(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	q := c.QueryParam("q")
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	users, err := h.Repo.ListChatUsers(userID, q, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat daftar pengguna"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": users})
}
