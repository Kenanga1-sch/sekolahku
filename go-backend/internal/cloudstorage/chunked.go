package cloudstorage

// Chunked upload: file besar dipotong di klien (karena batas ~100MB request
// Cloudflare Tunnel), tiap potongan disimpan sementara, lalu digabung dan
// dikirim ke Telegram Bot API lokal sebagai SATU file utuh.
//
// Alur:
//   1. klien minta CreateSession  → repo insert status uploading
//   2. klien upload potongan N     → tulis tmp, AddChunk (atomic increment)
//   3. klien panggil Complete      → status merging, lalu goroutine:
//        gabung potongan → (enkripsi bila aktif) → SendDocument → simpan
//        metadata cloud_files → hapus tmp → status done/failed
//   4. klien polling status sampai done
//
// Enkripsi diterapkan pada hasil gabungan (bukan per-potongan) agar file di
// Telegram identik dengan jalur upload biasa.

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/nrednav/cuid2"

	"github.com/sekolahku/go-backend/internal/repository"
	"github.com/sekolahku/go-backend/internal/models"
)

// ChunkUploadResult adalah hasil satu potongan yang masuk.
type ChunkUploadResult struct {
	SessionID      string `json:"sessionId"`
	UploadedChunks int    `json:"uploadedChunks"`
	TotalChunks    int    `json:"totalChunks"`
	// Offset byte yang sudah tersimpan (untuk validasi di klien).
	StoredBytes int64 `json:"storedBytes"`
}

// CreateSession membuat sesi upload bertahap baru.
func (s *Service) CreateSession(ownerID, name, mimeType string, parentID *string, totalSize int64, totalChunks int, chunkSize int64, encrypted bool) (*models.CloudUploadSession, error) {
	if !s.Enabled() {
		return nil, errors.New("Cloud Storage belum dikonfigurasi (bot token/chat_id kosong)")
	}
	if totalSize > s.cfg.MaxUploadBytes {
		return nil, fmt.Errorf("file melebihi batas %d MB", s.cfg.MaxUploadBytes/(1024*1024))
	}
	if totalChunks <= 0 || chunkSize <= 0 {
		return nil, fmt.Errorf("jumlah/ukuran potongan tidak valid")
	}
	sess := &models.CloudUploadSession{
		ID:           cuid2.Generate(),
		OwnerID:      ownerID,
		FileName:     name,
		MimeType:     mimeType,
		ParentID:     parentID,
		TotalSize:    totalSize,
		TotalChunks:  totalChunks,
		ChunkSize:    chunkSize,
		Encrypted:    encrypted,
		Status:       models.UploadStatusUploading,
	}
	if err := s.sessRepo.Create(sess); err != nil {
		return nil, err
	}
	return sess, nil
}

// SaveChunk menyimpan satu potongan (index 0-based) ke direktori sementara.
func (s *Service) SaveChunk(ownerID, sessionID string, index int, reader io.Reader) (*ChunkUploadResult, error) {
	sess, err := s.sessRepo.Get(ownerID, sessionID)
	if err != nil {
		return nil, err
	}
	if sess.Status != models.UploadStatusUploading {
		return nil, fmt.Errorf("sesi tidak dalam status uploading (status: %s)", sess.Status)
	}
	if index < 0 || index >= sess.TotalChunks {
		return nil, fmt.Errorf("nomor potongan di luar rentang (0..%d)", sess.TotalChunks-1)
	}

	dir := s.chunkDir(sessionID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	// Tulis ke .part dulu lalu rename — perpotongan konkuren tidak saling
	// menimpa hasil final, dan rename atomik di POSIX.
	tmpPath := filepath.Join(dir, fmt.Sprintf("chunk-%d.part", index))
	finalPath := filepath.Join(dir, fmt.Sprintf("chunk-%d", index))
	f, err := os.Create(tmpPath)
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(f, reader); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return nil, err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmpPath)
		return nil, err
	}
	if err := os.Rename(tmpPath, finalPath); err != nil {
		os.Remove(tmpPath)
		return nil, err
	}

	uploaded, err := s.sessRepo.AddChunk(ownerID, sessionID)
	if err != nil {
		return nil, err
	}
	return &ChunkUploadResult{
		SessionID:      sessionID,
		UploadedChunks: uploaded,
		TotalChunks:    sess.TotalChunks,
		StoredBytes:    int64(uploaded) * sess.ChunkSize,
	}, nil
}

// Complete memulai penggabungan + pengiriman ke Telegram secara async.
// Mengembalikan sesi dengan status merging; klien polling GetSessionStatus.
func (s *Service) Complete(ctx context.Context, ownerID, sessionID string) (*models.CloudUploadSession, error) {
	sess, err := s.sessRepo.Get(ownerID, sessionID)
	if err != nil {
		return nil, err
	}
	if sess.Status != models.UploadStatusUploading {
		return nil, fmt.Errorf("sesi tidak dalam status uploading (status: %s)", sess.Status)
	}
	if sess.UploadedChunks != sess.TotalChunks {
		return nil, fmt.Errorf("potongan belum lengkap: %d/%d", sess.UploadedChunks, sess.TotalChunks)
	}
	if err := s.sessRepo.SetStatus(ownerID, sessionID, models.UploadStatusMerging, ""); err != nil {
		return nil, err
	}

	go s.processSession(context.Background(), ownerID, sessionID)

	sess.Status = models.UploadStatusMerging
	sess.Error = ""
	return sess, nil
}

// processSession menggabung potongan, mengirim ke Telegram, lalu menyimpan
// metadata. Berjalan di goroutine; context background karena request klien
// sudah selesai (endpoint complete langsung kembali).
func (s *Service) processSession(ctx context.Context, ownerID, sessionID string) {
	setFailed := func(msg string) {
		_ = s.sessRepo.SetStatus(ownerID, sessionID, models.UploadStatusFailed, msg)
	}

	sess, err := s.sessRepo.Get(ownerID, sessionID)
	if err != nil {
		setFailed("sesi tidak ditemukan saat penggabungan")
		return
	}

	dir := s.chunkDir(sessionID)
	mergedPath := filepath.Join(dir, "merged")
	if err := s.mergeChunks(dir, mergedPath, sess.TotalChunks); err != nil {
		setFailed("gagal menggabung potongan: " + err.Error())
		return
	}

	// Buka hasil gabungan; stream ke Telegram (enkripsi bila aktif memuat
	// seluruh file ke memori dulu — sama seperti jalur Upload biasa).
	f, err := os.Open(mergedPath)
	if err != nil {
		setFailed("gagal membuka hasil gabungan: " + err.Error())
		return
	}
	defer f.Close()

	var uploadReader io.Reader = f
	if sess.Encrypted && s.cfg.EncryptionKey != "" {
		plain, err := io.ReadAll(f)
		if err != nil {
			setFailed("gagal membaca hasil gabungan: " + err.Error())
			return
		}
		enc, err := EncryptBlob(plain, s.cfg.EncryptionKey)
		if err != nil {
			setFailed("gagal mengenkripsi: " + err.Error())
			return
		}
		uploadReader = bytes.NewReader(enc)
	}

	fileID, size, messageID, err := s.tg.SendDocument(ctx, uploadReader, sess.FileName, s.cfg.ChatID)
	if err != nil {
		setFailed("gagal mengirim ke Telegram: " + err.Error())
		return
	}
	if size == 0 {
		size = sess.TotalSize
	}

	// Simpan metadata seperti upload biasa.
	now := time.Now().Unix()
	used, _ := s.repo.UsedNames(ownerID, sess.ParentID, "")
	cloudFile := &models.CloudFile{
		ID:         cuid2.Generate(),
		OwnerID:    ownerID,
		Name:       repository.UniqueCloudName(used, sess.FileName),
		ParentID:   sess.ParentID,
		FileID:     &fileID,
		MessageID:  &messageID,
		MimeType:   sess.MimeType,
		Size:       size,
		Encrypted:  sess.Encrypted,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.createWithUniqueName(ownerID, sess.ParentID, cloudFile, sess.FileName); err != nil {
		// Gagal simpan metadata → hapus file di Telegram agar tidak orphan.
		_ = s.tg.DeleteMessage(ctx, s.cfg.ChatID, messageID)
		setFailed("gagal menyimpan metadata: " + err.Error())
		return
	}

	_ = os.RemoveAll(dir)
	_ = s.sessRepo.SetStatus(ownerID, sessionID, models.UploadStatusDone, "")
}

// mergeChunks menggabung potongan 0..N-1 menjadi satu file berurutan.
func (s *Service) mergeChunks(dir, outPath string, totalChunks int) error {
	out, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer out.Close()
	for i := 0; i < totalChunks; i++ {
		in, err := os.Open(filepath.Join(dir, fmt.Sprintf("chunk-%d", i)))
		if err != nil {
			return fmt.Errorf("potongan %d hilang: %w", i, err)
		}
		if _, err := io.Copy(out, in); err != nil {
			in.Close()
			return fmt.Errorf("gagal membaca potongan %d: %w", i, err)
		}
		in.Close()
	}
	return out.Sync()
}

// GetSessionStatus mengembalikan status sesi untuk polling klien.
func (s *Service) GetSessionStatus(ownerID, sessionID string) (*models.CloudUploadSession, error) {
	return s.sessRepo.Get(ownerID, sessionID)
}

// AbortSession membatalkan upload: hapus potongan sementara + baris sesi.
func (s *Service) AbortSession(ownerID, sessionID string) error {
	sess, err := s.sessRepo.Get(ownerID, sessionID)
	if err != nil {
		return err
	}
	if sess.Status == models.UploadStatusMerging || sess.Status == models.UploadStatusDone {
		return fmt.Errorf("tidak dapat membatalkan sesi dengan status %s", sess.Status)
	}
	_ = os.RemoveAll(s.chunkDir(sessionID))
	return s.sessRepo.Delete(ownerID, sessionID)
}

// CleanupStale menghapus sesi yang terhenti (> maxAge detik tanpa update)
// beserta potongan sementaranya. Dipanggil periodic oleh handler.
func (s *Service) CleanupStale(maxAge int64) error {
	stale, err := s.sessRepo.ListStale(maxAge)
	if err != nil {
		return err
	}
	for _, sess := range stale {
		_ = os.RemoveAll(s.chunkDir(sess.ID))
		_ = s.sessRepo.Delete(sess.OwnerID, sess.ID)
	}
	return nil
}

// chunkDir mengembalikan direktori sementara sebuah sesi.
//
// Memakai cfg.ChunkDir bila diisi (diarahkan ke disk persisten), selain itu
// fallback ke os.TempDir(). Di container, /tmp biasanya tmpfs kecil (64MB)
// sehingga file besar gagal "no space left on device".
func (s *Service) chunkDir(sessionID string) string {
	base := s.cfg.ChunkDir
	if base == "" {
		base = filepath.Join(os.TempDir(), "cloud-uploads")
	}
	return filepath.Join(base, sessionID)
}
