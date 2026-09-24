package cloudstorage

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"io"
	"path"
	"strings"
	"time"

	"github.com/nrednav/cuid2"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// MaxZipBytes adalah batas total ukuran konten yang diizinkan masuk ke ZIP.
// Arsip yang melebihi batas ini ditolak agar tidak membebani server/penyimpanan.
const MaxZipBytes int64 = 4 << 30 // 4 GiB

// MaxTextBytes adalah batas ukuran berkas teks yang boleh diedit inline.
const MaxTextBytes int64 = 2 << 20 // 2 MiB

// ---------------------------------------------------------------------------
// Unduh massal (ZIP)
// ---------------------------------------------------------------------------

// zipEntry adalah satu berkas yang akan dimasukkan ke arsip.
type zipEntry struct {
	name string // path relatif di dalam arsip
	file *models.CloudFile
}

// StreamZip membuat arsip ZIP dari ID yang dipilih dan menulisnya langsung ke
// w (streaming, tanpa menahan seluruh arsip di memori). Bila item adalah
// folder, seluruh isinya dimasukkan secara rekursif dengan prefiks nama folder.
//
// Mengembalikan total byte konten yang dimasukkan (perkiraan) atau error bila
// melebihi MaxZipBytes.
func (s *Service) StreamZip(ctx context.Context, ownerID string, ids []string, w io.Writer) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("tidak ada item dipilih")
	}
	entries, total, err := s.collectZipEntries(ownerID, ids)
	if err != nil {
		return 0, err
	}
	if total > MaxZipBytes {
		return 0, fmt.Errorf("total ukuran melebihi batas %d GB", MaxZipBytes/(1<<30))
	}

	zw := zip.NewWriter(w)
	used := map[string]bool{}
	var written int64
	for _, e := range entries {
		name := uniqueZipName(used, e.name)
		header := &zip.FileHeader{
			Name:     name,
			Method:   zip.Store, // konten media sudah terkompresi; hindari CPU ekstra
			Modified: time.Unix(e.file.UpdatedAt, 0),
		}
		header.SetMode(0o644)
		fw, err := zw.CreateHeader(header)
		if err != nil {
			_ = zw.Close()
			return written, err
		}
		if err := s.writeZipContent(ctx, e.file, fw); err != nil {
			_ = zw.Close()
			return written, err
		}
		written += e.file.Size
	}
	if err := zw.Close(); err != nil {
		return written, err
	}
	return written, nil
}

// StreamZipShared membuat ZIP dari isi folder yang dibagikan (berdasarkan token).
func (s *Service) StreamZipShared(ctx context.Context, token string, w io.Writer) (int64, error) {
	root, err := s.GetSharedFile(token)
	if err != nil {
		return 0, err
	}
	if !root.IsFolder {
		return 0, errors.New("bukan folder")
	}
	return s.StreamZip(ctx, root.OwnerID, []string{root.ID}, w)
}

// collectZipEntries mengumpulkan seluruh berkas (rekursif) beserta total ukuran.
func (s *Service) collectZipEntries(ownerID string, ids []string) ([]zipEntry, int64, error) {
	var entries []zipEntry
	var total int64
	var walk func(f *models.CloudFile, prefix string) error
	walk = func(f *models.CloudFile, prefix string) error {
		if f.IsFolder {
			children, err := s.repo.ListFiles(ownerID, &f.ID, 0, 0)
			if err != nil {
				return err
			}
			for i := range children {
				if err := walk(&children[i], path.Join(prefix, f.Name)); err != nil {
					return err
				}
			}
			return nil
		}
		entries = append(entries, zipEntry{name: path.Join(prefix, f.Name), file: f})
		total += f.Size
		return nil
	}
	for _, id := range ids {
		f, err := s.repo.GetFile(ownerID, id)
		if err != nil {
			return nil, 0, err
		}
		if err := walk(f, ""); err != nil {
			return nil, 0, err
		}
	}
	return entries, total, nil
}

// writeZipContent menyalin isi satu berkas (dengan dekripsi bila perlu) ke arsip.
func (s *Service) writeZipContent(ctx context.Context, f *models.CloudFile, w io.Writer) error {
	res, err := s.OpenStream(ctx, f, "")
	if err != nil {
		return err
	}
	defer res.Body.Close()
	_, err = io.Copy(w, res.Body)
	return err
}

// uniqueZipName memastikan nama entri dalam arsip unik (menambahkan suffix).
func uniqueZipName(used map[string]bool, name string) string {
	if name == "" {
		name = "file"
	}
	if !used[name] {
		used[name] = true
		return name
	}
	ext := path.Ext(name)
	stem := strings.TrimSuffix(name, ext)
	for i := 1; ; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", stem, i, ext)
		if !used[candidate] {
			used[candidate] = true
			return candidate
		}
	}
}

// ---------------------------------------------------------------------------
// Editor teks / catatan
// ---------------------------------------------------------------------------

// IsEditableText melaporkan apakah berkas boleh diedit sebagai teks.
func IsEditableText(f *models.CloudFile) bool {
	if f.IsFolder {
		return false
	}
	mt := f.MimeType
	if strings.HasPrefix(mt, "text/") {
		return true
	}
	switch mt {
	case "application/json", "application/xml", "application/javascript", "application/x-yaml":
		return true
	}
	ext := strings.ToLower(path.Ext(f.Name))
	switch ext {
	case ".txt", ".md", ".markdown", ".json", ".csv", ".log", ".yml", ".yaml", ".xml", ".html", ".css", ".js", ".ts", ".ini", ".conf":
		return true
	}
	return false
}

// CreateNote membuat catatan teks baru (nama opsional; default catatan-<ts>.md).
func (s *Service) CreateNote(ctx context.Context, ownerID, name, content string, parentID *string) (*models.CloudFile, error) {
	if !s.Enabled() {
		return nil, errors.New("Cloud Storage belum dikonfigurasi")
	}
	if err := s.validateParent(ownerID, parentID); err != nil {
		return nil, err
	}
	if int64(len(content)) > MaxTextBytes {
		return nil, fmt.Errorf("catatan melebihi batas %d MB", MaxTextBytes/(1<<20))
	}
	name = strings.TrimSpace(name)
	if name == "" {
		name = fmt.Sprintf("catatan-%s.md", time.Now().Format("20060102-150405"))
	}

	mimeType := detectMime(name, "text/plain")
	if !strings.HasPrefix(mimeType, "text/") {
		mimeType = "text/plain"
	}

	size := int64(len(content))
	fileID, _, messageID, err := s.tg.SendDocument(ctx, strings.NewReader(content), name, s.cfg.ChatID)
	if err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	used, _ := s.repo.UsedNames(ownerID, parentID, "")
	f := &models.CloudFile{
		ID:        cuid2.Generate(),
		OwnerID:   ownerID,
		Name:      repository.UniqueCloudName(used, name),
		ParentID:  parentID,
		IsFolder:  false,
		FileID:    &fileID,
		MessageID: &messageID,
		MimeType:  mimeType,
		Size:      size,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.createWithUniqueName(ownerID, parentID, f, name); err != nil {
		_ = s.tg.DeleteMessage(ctx, s.cfg.ChatID, messageID)
		return nil, err
	}
	return f, nil
}

// UpdateTextContent mengganti isi sebuah berkas teks: unggah konten baru ke
// Telegram, tukar file_id/message_id, lalu hapus pesan lama bila tidak ada
// referensi lain (hasil copy).
func (s *Service) UpdateTextContent(ctx context.Context, ownerID, id, content string) (*models.CloudFile, error) {
	if !s.Enabled() {
		return nil, errors.New("Cloud Storage belum dikonfigurasi")
	}
	if int64(len(content)) > MaxTextBytes {
		return nil, fmt.Errorf("konten melebihi batas %d MB", MaxTextBytes/(1<<20))
	}
	f, err := s.repo.GetFile(ownerID, id)
	if err != nil {
		return nil, err
	}
	if !IsEditableText(f) {
		return nil, errors.New("berkas ini tidak dapat diedit sebagai teks")
	}

	oldFileID := f.FileID
	oldMessageID := f.MessageID

	fileID, _, messageID, err := s.tg.SendDocument(ctx, strings.NewReader(content), f.Name, s.cfg.ChatID)
	if err != nil {
		return nil, err
	}

	f.FileID = &fileID
	f.MessageID = &messageID
	f.Size = int64(len(content))
	if f.MimeType == "" || !strings.HasPrefix(f.MimeType, "text/") {
		f.MimeType = detectMime(f.Name, "text/plain")
	}
	f.UpdatedAt = time.Now().Unix()
	f.Encrypted = false

	if err := s.repo.Update(f); err != nil {
		// Rollback metadata gagal → bersihkan berkas baru agar tidak orphan.
		_ = s.tg.DeleteMessage(ctx, s.cfg.ChatID, messageID)
		return nil, err
	}

	// Hapus pesan lama bila tidak ada referensi lain.
	if oldFileID != nil && oldMessageID != nil {
		if n, cerr := s.countByFileID(oldFileID); cerr == nil && n == 0 {
			if derr := s.tg.DeleteMessage(ctx, s.cfg.ChatID, *oldMessageID); derr != nil {
				// Tidak fatal: berkas sudah diperbarui.
				_ = derr
			}
		}
	}
	s.removeThumbCache(oldFileID)
	return f, nil
}

// ---------------------------------------------------------------------------
// Rotasi gambar
// ---------------------------------------------------------------------------

// RotateImage memutar gambar 90/180/270 derajat, mengunggah hasilnya, dan
// mengganti berkas lama (pesan Telegram lama dihapus bila tak ada referensi lain).
func (s *Service) RotateImage(ctx context.Context, ownerID, id string, deg int) (*models.CloudFile, error) {
	if !s.Enabled() {
		return nil, errors.New("Cloud Storage belum dikonfigurasi")
	}
	if deg != 90 && deg != 180 && deg != 270 {
		return nil, errors.New("sudut rotasi harus 90, 180, atau 270")
	}
	f, err := s.repo.GetFile(ownerID, id)
	if err != nil {
		return nil, err
	}
	if f.FileID == nil || f.IsFolder {
		return nil, errors.New("bukan berkas gambar")
	}
	if !strings.HasPrefix(f.MimeType, "image/") {
		return nil, errors.New("rotasi hanya untuk gambar")
	}
	if f.Encrypted && s.cfg.EncryptionKey != "" {
		return nil, errors.New("rotasi tidak tersedia untuk berkas terenkripsi")
	}

	res, err := s.OpenStream(ctx, f, "")
	if err != nil {
		return nil, err
	}
	raw, err := io.ReadAll(res.Body)
	res.Body.Close()
	if err != nil {
		return nil, err
	}
	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, errors.New("gagal membaca gambar")
	}
	rotated := rotateImage(src, deg)

	var buf bytes.Buffer
	if err := encodeJPEG(&buf, rotated, 90); err != nil {
		return nil, err
	}

	oldFileID := f.FileID
	oldMessageID := f.MessageID

	name := f.Name
	fileID, size, messageID, err := s.tg.SendDocument(ctx, bytes.NewReader(buf.Bytes()), name, s.cfg.ChatID)
	if err != nil {
		return nil, err
	}
	if size == 0 {
		size = int64(buf.Len())
	}

	f.FileID = &fileID
	f.MessageID = &messageID
	f.Size = size
	f.MimeType = "image/jpeg"
	f.UpdatedAt = time.Now().Unix()
	if err := s.repo.Update(f); err != nil {
		_ = s.tg.DeleteMessage(ctx, s.cfg.ChatID, messageID)
		return nil, err
	}

	if oldFileID != nil && oldMessageID != nil {
		if n, cerr := s.countByFileID(oldFileID); cerr == nil && n == 0 {
			_ = s.tg.DeleteMessage(ctx, s.cfg.ChatID, *oldMessageID)
		}
	}
	s.removeThumbCache(oldFileID)
	s.removeThumbCache(&fileID)
	return f, nil
}

// rotateImage memutar gambar searah jarum jam sebesar deg derajat.
func rotateImage(src image.Image, deg int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	var dst *image.RGBA
	switch deg {
	case 90:
		dst = image.NewRGBA(image.Rect(0, 0, h, w))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				dst.Set(h-1-y, x, src.At(b.Min.X+x, b.Min.Y+y))
			}
		}
	case 180:
		dst = image.NewRGBA(image.Rect(0, 0, w, h))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				dst.Set(w-1-x, h-1-y, src.At(b.Min.X+x, b.Min.Y+y))
			}
		}
	case 270:
		dst = image.NewRGBA(image.Rect(0, 0, h, w))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				dst.Set(y, w-1-x, src.At(b.Min.X+x, b.Min.Y+y))
			}
		}
	default:
		return src
	}
	return dst
}
