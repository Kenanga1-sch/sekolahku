package chat

import (
	"testing"
	"time"
)

// TestRegisterBroadcastUnregister memeriksa alur dasar: daftar, siarkan
// ke satu user (multi-tab), lalu lepas.
func TestRegisterBroadcastUnregister(t *testing.T) {
	h := NewHub()

	c1 := NewConnection("u1")
	c2 := NewConnection("u1") // tab kedua user yang sama
	c3 := NewConnection("u2")

	if online := h.Register(c1); !online {
		t.Fatal("koneksi pertama harus melaporkan online=true")
	}
	if online := h.Register(c2); online {
		t.Fatal("koneksi kedua user yang sama harus online=false")
	}
	h.Register(c3)

	if !h.IsUserOnline("u1") || !h.IsUserOnline("u2") {
		t.Fatal("kedua user seharusnya online")
	}

	// Broadcast ke u1 sampai ke SEMUA tab-nya.
	h.BroadcastToUser("u1", Event{Type: EventMessage, Data: "halo"})
	for i, c := range []*Connection{c1, c2} {
		select {
		case ev := <-c.send:
			if ev.Type != EventMessage || ev.Data != "halo" {
				t.Fatalf("tab %d: event salah: %+v", i, ev)
			}
		case <-time.After(time.Second):
			t.Fatalf("tab %d tidak menerima event", i)
		}
	}
	// u3... maksudnya u2 tidak menerima (bukan penerima).
	select {
	case <-c3.send:
		t.Fatal("u2 tidak seharusnya menerima broadcast ke u1")
	default:
	}

	// Unregister tab pertama: user masih online (tab kedua masih ada).
	if offline := h.Unregister(c1); offline {
		t.Fatal("unregister tab pertama tidak boleh melaporkan offline")
	}
	if !h.IsUserOnline("u1") {
		t.Fatal("u1 masih punya tab kedua, harusnya online")
	}
	// Unregister tab terakhir: user offline.
	if offline := h.Unregister(c2); !offline {
		t.Fatal("unregister koneksi terakhir harus offline=true")
	}
	if h.IsUserOnline("u1") {
		t.Fatal("u1 seharusnya offline")
	}
}

// TestBroadcastToOfflineUserNoBlock memastikan broadcast ke user tanpa
// koneksi tidak panic dan tidak memblokir.
func TestBroadcastToOfflineUserNoBlock(t *testing.T) {
	h := NewHub()
	done := make(chan struct{})
	go func() {
		h.BroadcastToUser("tidakada", Event{Type: EventMessage})
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("broadcast ke user offline memblokir")
	}
}

// TestBroadcastDropsWhenBufferFull memastikan event di-drop (bukan
// memblokir) bila klien tidak membaca dan buffer penuh.
func TestBroadcastDropsWhenBufferFull(t *testing.T) {
	h := NewHub()
	c := NewConnection("u1")
	h.Register(c)

	// Isi buffer (64) + beberapa extra — tidak boleh macet.
	for i := 0; i < 100; i++ {
		h.BroadcastToUser("u1", Event{Type: EventMessage})
	}
	n := 0
	for {
		select {
		case <-c.send:
			n++
		default:
			if n > 64 {
				t.Fatalf("buffer seharusnya maksimal 64, dapat %d", n)
			}
			return
		}
	}
}

// TestUnregisterUnknownConnection memastikan operasi pada koneksi yang
// tidak terdaftar aman.
func TestUnregisterUnknownConnection(t *testing.T) {
	h := NewHub()
	c := NewConnection("u1")
	if offline := h.Unregister(c); offline {
		t.Fatal("unregister koneksi tak terdaftar harus false")
	}
	h.Register(c)
	h.Unregister(c)
	if offline := h.Unregister(c); offline {
		t.Fatal("unregister kedua kalinya harus false")
	}
}

// TestActiveConversation memastikan notifikasi hanya ditahan untuk
// percakapan yang memang sedang dibuka pengguna.
func TestActiveConversation(t *testing.T) {
	h := NewHub()
	c := NewConnection("u1")
	h.Register(c)

	if h.IsActiveConversation("u1", "convX") {
		t.Fatal("koneksi baru belum membuka percakapan apapun")
	}
	h.SetActiveConversation(c, "convX")
	if !h.IsActiveConversation("u1", "convX") {
		t.Fatal("convX harus terdeteksi sedang dibuka")
	}
	if h.IsActiveConversation("u1", "convLain") {
		t.Fatal("convLain tidak sedang dibuka")
	}
	// Keluar dari percakapan: tidak ada lagi yang aktif.
	h.SetActiveConversation(c, "")
	if h.IsActiveConversation("u1", "convX") {
		t.Fatal("setelah keluar, tidak ada percakapan aktif")
	}
	// Percakapan aktif hilang saat koneksi diputus.
	h.SetActiveConversation(c, "convX")
	h.Unregister(c)
	if h.IsActiveConversation("u1", "convX") {
		t.Fatal("koneksi putus harus menghapus status percakapan aktif")
	}
}

// TestVisibility memastikan push hanya ditahan saat halaman benar-benar
// terlihat (foreground), termasuk kasus multi-tab.
func TestVisibility(t *testing.T) {
	h := NewHub()
	c1 := NewConnection("u1")
	c2 := NewConnection("u1") // tab kedua
	h.Register(c1)
	h.Register(c2)

	if !h.IsUserVisible("u1") {
		t.Fatal("koneksi baru dianggap visible")
	}
	// Tab pertama di-background, tab kedua masih terlihat.
	h.SetVisibility(c1, false)
	if !h.IsUserVisible("u1") {
		t.Fatal("user masih visible lewat tab kedua")
	}
	// Semua tab di-background: user tidak terlihat (push dikirim).
	h.SetVisibility(c2, false)
	if h.IsUserVisible("u1") {
		t.Fatal("semua tab tersembunyi harusnya tidak visible")
	}
	// Kembali terlihat.
	h.SetVisibility(c2, true)
	if !h.IsUserVisible("u1") {
		t.Fatal("tab terlihat kembali harus membuat user visible")
	}
}
