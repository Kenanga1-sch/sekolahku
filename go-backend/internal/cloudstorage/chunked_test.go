package cloudstorage

import (
	"bytes"
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// setupChunkedService seperti setupService + repo sesi upload + tabelnya.
func setupChunkedService(t *testing.T) (*Service, *repository.CloudUploadSessionRepository, *fakeTG) {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	_, err = db.Exec(`
		CREATE TABLE cloud_files (
			id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
			parent_id TEXT, is_folder INTEGER NOT NULL DEFAULT 0, file_id TEXT,
			message_id INTEGER, mime_type TEXT, size INTEGER NOT NULL DEFAULT 0,
			encrypted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER,
			share_token TEXT, share_expires_at INTEGER,
			is_starred INTEGER NOT NULL DEFAULT 0, accessed_at INTEGER,
			sort_order INTEGER NOT NULL DEFAULT 0, share_kind TEXT
		);
		CREATE UNIQUE INDEX idx_cloud_files_unique_name
			ON cloud_files(owner_id, name, COALESCE(parent_id, '')) WHERE deleted_at IS NULL;
		CREATE TABLE cloud_upload_sessions (
			id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, file_name TEXT NOT NULL,
			mime_type TEXT NOT NULL DEFAULT '', parent_id TEXT,
			total_size INTEGER NOT NULL, total_chunks INTEGER NOT NULL,
			chunk_size INTEGER NOT NULL, uploaded_chunks INTEGER NOT NULL DEFAULT 0,
			encrypted INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'uploading',
			error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0
		);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	cloudRepo := repository.NewCloudStorageRepository(db)
	sessRepo := repository.NewCloudUploadSessionRepository(db)
	tg := newFakeTG()
	svc := NewService(cloudRepo, tg, Config{BotToken: "t", ChatID: "c", MaxUploadBytes: 100 << 20})
	svc.SetSessionRepo(sessRepo)
	// os.TempDir dipakai chunkDir; arahkan ke tmp test agar bersih.
	t.Setenv("TMPDIR", t.TempDir())
	return svc, sessRepo, tg
}

func chunkBytes(n, size int) []byte {
	return bytes.Repeat([]byte{byte('A' + n)}, size)
}

func TestChunkedUploadRoundtrip(t *testing.T) {
	svc, _, tg := setupChunkedService(t)

	// File 90 byte dipotong jadi 3 potongan @30 byte.
	const chunkSize = 30
	const total = 90
	sess, err := svc.CreateSession("u1", "video.mp4", "video/mp4", nil, total, 3, chunkSize, false)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if sess.Status != models.UploadStatusUploading {
		t.Fatalf("status awal = %s", sess.Status)
	}

	for i := 0; i < 3; i++ {
		res, err := svc.SaveChunk("u1", sess.ID, i, bytes.NewReader(chunkBytes(i, chunkSize)))
		if err != nil {
			t.Fatalf("save chunk %d: %v", i, err)
		}
		if res.UploadedChunks != i+1 {
			t.Fatalf("chunk %d: uploaded=%d", i, res.UploadedChunks)
		}
	}

	// Complete harus menolak bila potongan belum lengkap: buat sesi kedua
	// dengan 3 potong tapi hanya upload 2.
	sessB, err := svc.CreateSession("u1", "belum-lengkap.bin", "", nil, 90, 3, chunkSize, false)
	if err != nil {
		t.Fatalf("create session B: %v", err)
	}
	for i := 0; i < 2; i++ {
		if _, err := svc.SaveChunk("u1", sessB.ID, i, bytes.NewReader(chunkBytes(i, chunkSize))); err != nil {
			t.Fatalf("save chunk B %d: %v", i, err)
		}
	}
	if _, err := svc.Complete(context.Background(), "u1", sessB.ID); err == nil {
		t.Fatal("complete dengan potongan tidak lengkap harus error")
	}
	_ = svc.AbortSession("u1", sessB.ID)

	sess2, err := svc.Complete(context.Background(), "u1", sess.ID)
	if err != nil {
		t.Fatalf("complete: %v", err)
	}
	if sess2.Status != models.UploadStatusMerging {
		t.Fatalf("status setelah complete = %s", sess2.Status)
	}

	// tunggu goroutine selesai (timeout 5 detik)
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		s, err := svc.GetSessionStatus("u1", sess.ID)
		if err != nil {
			t.Fatalf("status: %v", err)
		}
		if s.Status == models.UploadStatusDone || s.Status == models.UploadStatusFailed {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	s, err := svc.GetSessionStatus("u1", sess.ID)
	if err != nil {
		t.Fatalf("status final: %v", err)
	}
	if s.Status != models.UploadStatusDone {
		t.Fatalf("status final = %s, error=%s", s.Status, s.Error)
	}

	// File di Telegram = hasil gabungan utuh (A×30 + B×30 + C×30).
	var got []byte
	for _, data := range tg.store {
		got = data
	}
	want := append(append(chunkBytes(0, chunkSize), chunkBytes(1, chunkSize)...), chunkBytes(2, chunkSize)...)
	if !bytes.Equal(got, want) {
		t.Fatalf("isi file Telegram = %q, want %q", string(got), string(want))
	}
	if int64(len(got)) != total {
		t.Fatalf("ukuran = %d, want %d", len(got), total)
	}

	// Direktori tmp dibersihkan setelah done.
	if _, err := os.Stat(svc.chunkDir(sess.ID)); err == nil {
		t.Fatal("direktori tmp seharusnya dihapus setelah selesai")
	}
}

func TestChunkedUploadChunkOutOfRange(t *testing.T) {
	svc, _, _ := setupChunkedService(t)
	sess, err := svc.CreateSession("u1", "f.bin", "", nil, 60, 2, 30, false)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := svc.SaveChunk("u1", sess.ID, 5, bytes.NewReader(chunkBytes(0, 30))); err == nil {
		t.Fatal("potongan di luar rentang harus error")
	}
	if _, err := svc.SaveChunk("u2", sess.ID, 0, bytes.NewReader(chunkBytes(0, 30))); err == nil {
		t.Fatal("owner lain tidak boleh mengakses sesi")
	}
}

func TestChunkedUploadAbort(t *testing.T) {
	svc, _, _ := setupChunkedService(t)
	sess, err := svc.CreateSession("u1", "f.bin", "", nil, 60, 2, 30, false)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := svc.SaveChunk("u1", sess.ID, 0, bytes.NewReader(chunkBytes(0, 30))); err != nil {
		t.Fatalf("save chunk: %v", err)
	}
	if err := svc.AbortSession("u1", sess.ID); err != nil {
		t.Fatalf("abort: %v", err)
	}
	if _, err := svc.GetSessionStatus("u1", sess.ID); err == nil {
		t.Fatal("sesi harus terhapus setelah abort")
	}
}

func TestChunkedUploadEncryption(t *testing.T) {
	svc, _, tg := setupChunkedService(t)
	svc.cfg.EncryptionKey = hexKey()
	sess, err := svc.CreateSession("u1", "f.bin", "", nil, 60, 2, 30, true)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	for i := 0; i < 2; i++ {
		if _, err := svc.SaveChunk("u1", sess.ID, i, bytes.NewReader(chunkBytes(i, 30))); err != nil {
			t.Fatalf("save chunk %d: %v", i, err)
		}
	}
	// lengkapi
	_, _ = svc.GetSessionStatus("u1", sess.ID)
	if _, err := svc.Complete(context.Background(), "u1", sess.ID); err != nil {
		t.Fatalf("complete: %v", err)
	}
	deadline := time.Now().Add(5 * time.Second)
	var status string
	for time.Now().Before(deadline) {
		s, err := svc.GetSessionStatus("u1", sess.ID)
		if err != nil {
			break
		}
		status = s.Status
		if status == models.UploadStatusDone || status == models.UploadStatusFailed {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if status != models.UploadStatusDone {
		s, _ := svc.GetSessionStatus("u1", sess.ID)
		t.Fatalf("status = %s err=%s", status, s.Error)
	}
	// File di Telegram terenkripsi: tidak sama dengan plain dan bisa didekripsi.
	var enc []byte
	for _, data := range tg.store {
		enc = data
	}
	plain := append(append(chunkBytes(0, 30), chunkBytes(1, 30)...), chunkBytes(0, 0)...)
	_ = plain
	dec, err := DecryptBlob(enc, svc.cfg.EncryptionKey)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	want := append(chunkBytes(0, 30), chunkBytes(1, 30)...)
	if !bytes.Equal(dec, want) {
		t.Fatalf("dekripsi = %q, want %q", string(dec), string(want))
	}
	if strings.Contains(string(enc), "AAAAAAAAAA") {
		t.Fatal("file terenkripsi seharusnya tidak berisi plain text")
	}
}

func hexKey() string {
	// 32 byte kunci sebagai hex (64 karakter).
	return "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
}
