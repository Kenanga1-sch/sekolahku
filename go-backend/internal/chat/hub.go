// Package chat mengelola koneksi WebSocket real-time untuk fitur chat.
// Hub bersifat in-memory dan TIDAK pernah menyentuh database — semua
// persistensi tetap di lapisan handler/repository. Hal ini menjaga
// pool koneksi SQLite yang kecil (MaxOpenConns=1) tidak disibukkan oleh
// hub, dan membuat hub mudah diuji.
package chat

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// Tipe event yang dikirim server ke klien.
const (
	EventMessage           = "message"
	EventConversationUpdate = "conversation_updated"
	EventTyping            = "typing"
	EventRead              = "read"
	EventPresence          = "presence"
	EventPong              = "pong"
)

// Tipe pesan yang diterima dari klien (typing/pong/active/visibility).
const (
	ClientTyping     = "typing"
	ClientPong       = "pong"
	ClientActive     = "active"
	ClientVisibility = "visibility"
)

// HeartbeatInterval server mengirim ping app-level setiap ini.
const HeartbeatInterval = 30 * time.Second

// ReadDeadline batas waktu baca; setiap pesan (termasuk pong) meresetnya.
const ReadDeadline = 90 * time.Second

// Event pesan yang dikirim ke klien melalui WebSocket.
type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data,omitempty"`
}

// ClientMessage pesan masuk dari klien (typing/pong).
type ClientMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// TypingPayload data event typing (dua arah).
type TypingPayload struct {
	ConversationID string `json:"conversationId"`
	UserID         string `json:"userId"`
	IsTyping       bool   `json:"isTyping"`
}

// ReadPayload data event read receipt.
type ReadPayload struct {
	ConversationID string `json:"conversationId"`
	UserID         string `json:"userId"`
	LastReadAt     int64  `json:"lastReadAt"`
}

// PresencePayload data event online/offline.
type PresencePayload struct {
	UserID string `json:"userId"`
	Online bool   `json:"online"`
}

// ActivePayload data event client "active" (percakapan yang sedang dibuka).
type ActivePayload struct {
	ConversationID string `json:"conversationId"`
}

// VisibilityPayload data event client "visibility" (halaman terlihat).
type VisibilityPayload struct {
	Visible bool `json:"visible"`
}

// Connection satu koneksi WebSocket milik seorang user. Seorang user
// boleh punya beberapa Connection (mis. beberapa tab browser).
type Connection struct {
	userID     string
	send       chan Event
	activeConv string // percakapan yang sedang dibuka klien ini ("" = tidak ada)
	visible    bool   // halaman klien ini sedang terlihat (foreground)
}

// NewConnection membuat koneksi baru (send buffer internal). Koneksi baru
// dianggap visible sampai klien melaporkan status sebenarnya.
func NewConnection(userID string) *Connection {
	return &Connection{userID: userID, send: make(chan Event, 64), visible: true}
}

// UserID pemilik koneksi (dipakai handler untuk lookup database).
func (c *Connection) UserID() string { return c.userID }

// AcceptOptions hook aplikasi yang dipanggil hub pada momen tertentu.
// Hub tetap tidak tahu apa-apa tentang database — hook inilah yang
// melakukan lookup (mis. siapa lawan bicara) lalu memanggil BroadcastToUser.
type AcceptOptions struct {
	// OnMessage dipanggil untuk setiap pesan masuk dari klien (typing/pong/
	// active/visibility). Menerima connection agar handler bisa memilih
	// koneksi mana yang harus diperbarui (multi-tab).
	OnMessage func(c *Connection, msg ClientMessage)
	// OnPresence dipanggil saat user berstatus online (koneksi pertama)
	// atau offline (koneksi terakhir ditutup).
	OnPresence func(userID string, online bool)
}

// Hub memelihara koneksi aktif per user dan menyiarkan event ke user
// tertentu. Akses ke map internal dilindungi RWMutex: penulisan
// (register/unregister) jarang, pembacaan (broadcast) sering sehingga
// RLock memungkinkan broadcast paralel.
type Hub struct {
	mu    sync.RWMutex
	conns map[string]map[*Connection]struct{}
}

func NewHub() *Hub {
	return &Hub{conns: make(map[string]map[*Connection]struct{})}
}

// Register mendaftarkan koneksi baru; mengembalikan true bila ini koneksi
// pertama user tersebut (transisi offline → online).
func (h *Hub) Register(c *Connection) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	set, exists := h.conns[c.userID]
	if !exists {
		set = make(map[*Connection]struct{})
		h.conns[c.userID] = set
	}
	set[c] = struct{}{}
	return !exists // online baru bila sebelumnya tidak ada koneksi
}

// Unregister melepas koneksi; mengembalikan true bila ini koneksi terakhir
// user tersebut (transisi online → offline).
func (h *Hub) Unregister(c *Connection) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	set, ok := h.conns[c.userID]
	if !ok {
		return false
	}
	delete(set, c)
	if len(set) == 0 {
		delete(h.conns, c.userID)
		return true
	}
	return false
}

// BroadcastToUser mengirim event ke SEMUA koneksi milik user. Kirim
// non-blocking: bila buffer koneksi penuh (klien lambat), event di-drop
// supaya satu klien tidak menghentikan sisanya — klien akan re-sync
// percakapan via REST saat render.
func (h *Hub) BroadcastToUser(userID string, ev Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.conns[userID] {
		select {
		case c.send <- ev:
		default:
		}
	}
}

// IsUserOnline true bila user punya minimal satu koneksi aktif.
func (h *Hub) IsUserOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.conns[userID]) > 0
}

// SetActiveConversation menandai percakapan yang sedang dibuka pada
// connection ini. convID kosong berarti tidak ada percakapan dibuka.
// Hanya connection pengirim yang diperbarui: tiap tab punya state sendiri.
func (h *Hub) SetActiveConversation(c *Connection, convID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c.activeConv = convID
}

// IsActiveConversation true bila user membuka percakapan ini di salah
// satu koneksinya — pesan itu sedang dilihat, tidak perlu notifikasi.
func (h *Hub) IsActiveConversation(userID, convID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.conns[userID] {
		if convID != "" && c.activeConv == convID {
			return true
		}
	}
	return false
}

// SetVisibility menandai apakah halaman connection ini sedang terlihat
// (foreground) atau di-background perangkat.
func (h *Hub) SetVisibility(c *Connection, visible bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c.visible = visible
}

// IsUserVisible true bila salah satu koneksi user terlihat — push tidak
// perlu dikirim karena pengguna sudah melihat aplikasinya.
func (h *Hub) IsUserVisible(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.conns[userID] {
		if c.visible {
			return true
		}
	}
	return false
}

// Accept menerima koneksi WebSocket, mendaftarkannya di hub, lalu
// menjalankan read+write loop sampai koneksi ditutup. Method ini
// memblokir echo handler selama koneksi hidup (pola normal untuk WS).
//
// Keamanan CSWSH: coder/websocket default menolak request cross-origin
// (hanya host request yang diotorisasi) — tepat untuk mencegah situs
// jahat membuka WS memakai cookie korban.
func (h *Hub) Accept(ctx context.Context, c *Connection, w http.ResponseWriter, r *http.Request, opts AcceptOptions) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		CompressionMode: websocket.CompressionDisabled,
	})
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "tutup")

	if h.Register(c) && opts.OnPresence != nil {
		opts.OnPresence(c.userID, true)
	}
	defer func() {
		if h.Unregister(c) && opts.OnPresence != nil {
			opts.OnPresence(c.userID, false)
		}
	}()

	writeCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	go h.writeLoop(writeCtx, c, conn)
	h.readLoop(ctx, c, conn, opts)
}

// readLoop membaca pesan klien dengan deadline per-pesan (direset oleh
// tiap pesan masuk, termasuk pong dari heartbeat). Keluar saat koneksi
// mati atau tidak ada pesan dalam ReadDeadline.
func (h *Hub) readLoop(ctx context.Context, c *Connection, conn *websocket.Conn, opts AcceptOptions) {
	for {
		readCtx, cancel := context.WithTimeout(ctx, ReadDeadline)
		_, data, err := conn.Read(readCtx)
		cancel()
		if err != nil {
			return
		}
		var msg ClientMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		if opts.OnMessage != nil {
			opts.OnMessage(c, msg)
		}
	}
}

// writeLoop mengirim event dari channel koneksi + ping app-level periodik.
func (h *Hub) writeLoop(ctx context.Context, c *Connection, conn *websocket.Conn) {
	ticker := time.NewTicker(HeartbeatInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case ev, ok := <-c.send:
			if !ok {
				return
			}
			b, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			writeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err = conn.Write(writeCtx, websocket.MessageText, b)
			cancel()
			if err != nil {
				return
			}
		case <-ticker.C:
			b, _ := json.Marshal(Event{Type: "ping"})
			writeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := conn.Write(writeCtx, websocket.MessageText, b)
			cancel()
			if err != nil {
				return
			}
		}
	}
}
