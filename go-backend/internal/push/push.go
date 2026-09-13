// Package push mengirim Web Push (PWA) lewat protokol VAPID tanpa layanan
// pihak ketiga berbayar. Subscription disimpan per pengguna; endpoint yang
// mati (410/404) otomatis dibersihkan.
package push

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	webpush "github.com/SherClockHolmes/webpush-go"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type Service struct {
	Repo       *repository.PushRepository
	publicKey  string
	privateKey string
	subscriber string
}

func NewService(repo *repository.PushRepository, publicKey, privateKey, subscriber string) *Service {
	if subscriber == "" {
		subscriber = "mailto:admin@sdn1kenanga.sch.id"
	}
	return &Service{
		Repo:       repo,
		publicKey:  strings.TrimSpace(publicKey),
		privateKey: strings.TrimSpace(privateKey),
		subscriber: subscriber,
	}
}

// Enabled true bila VAPID keys tersedia — tanpa itu push dilewati diam-diam
// agar fitur lain tidak pernah gagal karena push belum dikonfigurasi.
func (s *Service) Enabled() bool {
	return s != nil && s.publicKey != "" && s.privateKey != "" && s.Repo != nil
}

// PublicKey dikirim ke frontend untuk pushManager.subscribe.
func (s *Service) PublicKey() string {
	if s == nil {
		return ""
	}
	return s.publicKey
}

// SendToUser mengirim payload ke semua perangkat milik user. Endpoint mati
// dihapus dari DB. Mengembalikan jumlah perangkat yang berhasil.
func (s *Service) SendToUser(userID string, payload models.PushPayload) int {
	if !s.Enabled() || strings.TrimSpace(userID) == "" {
		return 0
	}
	subs, err := s.Repo.ListByUser(userID)
	if err != nil {
		log.Printf("[PUSH] gagal memuat subscription user %s: %v", userID, err)
		return 0
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return 0
	}
	sent := 0
	for _, sub := range subs {
		resp, err := webpush.SendNotification(body, &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				Auth:   sub.Auth,
				P256dh: sub.P256dh,
			},
		}, &webpush.Options{
			Subscriber:      s.subscriber,
			VAPIDPublicKey:  s.publicKey,
			VAPIDPrivateKey: s.privateKey,
			TTL:             3600,
		})
		if err != nil {
			log.Printf("[PUSH] kirim gagal user %s: %v", userID, err)
			continue
		}
		// 404/410 = subscription tak lagi valid (uninstall/browser reset).
		if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
			_ = s.Repo.DeleteByID(sub.ID)
			resp.Body.Close()
			continue
		}
		resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			_ = s.Repo.Touch(sub.ID)
			sent++
		}
	}
	return sent
}

// SendToUsers kirim ke banyak user (fan-out). Tetap best-effort.
func (s *Service) SendToUsers(userIDs []string, payload models.PushPayload) int {
	total := 0
	seen := make(map[string]bool, len(userIDs))
	for _, uid := range userIDs {
		if uid == "" || seen[uid] {
			continue
		}
		seen[uid] = true
		total += s.SendToUser(uid, payload)
	}
	return total
}

// ErrDisabled dipakai handler bila push belum dikonfigurasi.
var ErrDisabled = errors.New("web push belum dikonfigurasi")
