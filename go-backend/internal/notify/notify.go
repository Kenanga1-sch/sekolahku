// Package notify menghubungkan event sekolah ke notifikasi orang tua:
// in-app (admin_notifications per user ortu) + Web Push per perangkat,
// menghormati preferensi kategori per user.
package notify

import (
	"log"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/push"
	"github.com/sekolahku/go-backend/internal/repository"
)

// strPtrOrNil target kosong berarti tanpa tautan.
func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

type ParentNotifier struct {
	Parents *repository.ParentRepository
	Notifs  *repository.NotificationRepository
	Prefs   *repository.PreferenceRepository
	Push    *push.Service
}

func NewParentNotifier(parents *repository.ParentRepository, notifs *repository.NotificationRepository, prefs *repository.PreferenceRepository, pushSvc *push.Service) *ParentNotifier {
	return &ParentNotifier{Parents: parents, Notifs: notifs, Prefs: prefs, Push: pushSvc}
}

// NotifyParentsOfStudent mengirim notifikasi (in-app + push) ke semua
// orang tua aktif milik siswa. category = preferensi kategori ortu
// (absensi/tabungan/pengumuman/pr/umum). nType untuk ikon in-app.
func (n *ParentNotifier) NotifyParentsOfStudent(studentID, category, nType, title, body, targetURL, pushTag string) {
	if n == nil || n.Parents == nil || studentID == "" {
		return
	}
	userIDs, err := n.Parents.GetParentUserIDs(studentID)
	if err != nil {
		log.Printf("[NOTIFY-ORTU] gagal ambil ortu siswa %s: %v", studentID, err)
		return
	}
	if len(userIDs) == 0 {
		return
	}

	// Hormati preferensi kategori.
	if n.Prefs != nil {
		userIDs = n.Prefs.FilterEnabled(userIDs, category)
		if len(userIDs) == 0 {
			return
		}
	}

	for _, uid := range userIDs {
		// In-app (muncul di portal ortu & dashboard notifikasi).
		if n.Notifs != nil {
			uidCopy := uid
			_ = n.Notifs.CreateNotification(models.Notification{
				UserID:    &uidCopy,
				Type:      nType,
				Category:  category,
				Title:     title,
				Message:   body,
				TargetURL: strPtrOrNil(targetURL),
			})
		}
	}

	// Push ke semua perangkat ortu yang berlangganan.
	if n.Push != nil && n.Push.Enabled() {
		n.Push.SendToUsers(userIDs, models.PushPayload{
			Title: title,
			Body:  body,
			URL:   targetURL,
			Tag:   pushTag,
		})
	}
}

// NotifyAllParents broadcast ke SEMUA akun orang tua (mis. pengumuman
// sekolah). Tetap menghormati preferensi kategori.
func (n *ParentNotifier) NotifyAllParents(category, nType, title, body, targetURL, pushTag string) {
	if n == nil || n.Parents == nil {
		return
	}
	rows, err := n.Parents.DB.Query(`SELECT DISTINCT user_id FROM parent_students WHERE is_active = 1`)
	if err != nil {
		log.Printf("[NOTIFY-ORTU] gagal ambil semua ortu: %v", err)
		return
	}
	ids := make([]string, 0, 32)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	if len(ids) == 0 {
		return
	}

	if n.Prefs != nil {
		ids = n.Prefs.FilterEnabled(ids, category)
		if len(ids) == 0 {
			return
		}
	}

	for _, uid := range ids {
		if n.Notifs != nil {
			uidCopy := uid
			_ = n.Notifs.CreateNotification(models.Notification{
				UserID:    &uidCopy,
				Type:      nType,
				Category:  category,
				Title:     title,
				Message:   body,
				TargetURL: strPtrOrNil(targetURL),
			})
		}
	}

	if n.Push != nil && n.Push.Enabled() {
		n.Push.SendToUsers(ids, models.PushPayload{
			Title: title,
			Body:  body,
			URL:   targetURL,
			Tag:   pushTag,
		})
	}
}
