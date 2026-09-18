package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/chat"
)

// WS endpoint WebSocket chat. JWTMiddleware sudah memverifikasi session
// cookie sebelum handler ini (browser mengirim cookie otomatis saat
// handshake WS, jadi otentikasi tetap jalan). Route adalah GET sehingga
// middleware CSRF (yang hanya memeriksa state-changing method) dilewati —
// keamanan same-origin tetap dipegang oleh coder/websocket di Accept.
func (h *ChatHandler) WS(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "error": "Tidak terautentikasi"})
	}
	if h.Hub == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "Fitur real-time nonaktif"})
	}

	conn := chat.NewConnection(userID)

	// Accept memblokir sampai koneksi ditutup; ctx dari request memastikan
	// read loop segera berhenti saat klien memutus atau server shutdown.
	h.Hub.Accept(c.Request().Context(), conn, c.Response(), c.Request(), chat.AcceptOptions{
		OnMessage:  h.handleClientMessage,
		OnPresence: h.handlePresence,
	})
	return nil
}

// handleClientMessage memproses pesan masuk dari klien: relay typing ke
// lawan bicara, catat percakapan aktif & status terlihat, abaikan pong
// (deadline direset di readLoop).
func (h *ChatHandler) handleClientMessage(c *chat.Connection, msg chat.ClientMessage) {
	switch msg.Type {
	case chat.ClientTyping:
		var p chat.TypingPayload
		if err := json.Unmarshal(msg.Data, &p); err != nil || p.ConversationID == "" {
			return
		}
		other, err := h.Repo.GetOtherParticipant(p.ConversationID, c.UserID())
		if err != nil || other == "" {
			return
		}
		p.UserID = c.UserID()
		h.Hub.BroadcastToUser(other, chat.Event{Type: chat.EventTyping, Data: p})

	case chat.ClientActive:
		// Percakapan yang sedang dibuka — dipakai server untuk menekan
		// notifikasi pesan yang sedang dilihat. Validasi peserta dahulu
		// agar klien tidak bisa menekan notifikasi percakapan orang lain.
		var p chat.ActivePayload
		if err := json.Unmarshal(msg.Data, &p); err != nil {
			return
		}
		convID := strings.TrimSpace(p.ConversationID)
		if convID != "" {
			ok, err := h.Repo.IsParticipant(convID, c.UserID())
			if err != nil || !ok {
				return
			}
		}
		h.Hub.SetActiveConversation(c, convID)

	case chat.ClientVisibility:
		var p chat.VisibilityPayload
		if err := json.Unmarshal(msg.Data, &p); err != nil {
			return
		}
		h.Hub.SetVisibility(c, p.Visible)

	case chat.ClientPong:
		// tidak ada aksi; read deadline sudah direset oleh readLoop.
	}
}

// handlePresence menyiarkan status online/offline user ke semua lawan
// bicara aktifnya (green dot di daftar percakapan).
func (h *ChatHandler) handlePresence(userID string, online bool) {
	partners, err := h.Repo.ListPartnerUserIDs(userID)
	if err != nil || len(partners) == 0 {
		return
	}
	ev := chat.Event{
		Type: chat.EventPresence,
		Data: chat.PresencePayload{UserID: userID, Online: online},
	}
	for _, partnerID := range partners {
		h.Hub.BroadcastToUser(partnerID, ev)
	}
}
