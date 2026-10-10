package cloudstorage

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"io"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/nrednav/cuid2"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// Config menampung konfigurasi layanan Cloud Storage dari env.
type Config struct {
	BotToken       string
	ChatID         string
	MaxUploadBytes int64
	ThumbDir       string
	EncryptionKey  string
	// ChunkDir: direktori kerja upload bertahap (potongan sementara + hasil
	// gabungan). Kosong = os.TempDir(). WAJIB diarahkan ke disk non-tmpfs di
	// container (mis. /app/data/cloud-uploads) — /tmp di container sering
	// tmpfs kecil (64MB) sehingga file besar gagal "no space left on device".
	ChunkDir string
	// LocalFileRoot: direktori (di dalam container) tempat berkas server Bot API
	// lokal di-mount, mis. /app/telegram-data. Kosong = ambil lewat HTTP /file/.
	LocalFileRoot string
}

// Service adalah logika bisnis Cloud Storage. Semua operasi file/folder
// ter-scope pada ownerID (isolasi antar-user).
type Service struct {
	repo     *repository.CloudStorageRepository
	sessRepo *repository.CloudUploadSessionRepository
	tg       TelegramAPI
	cfg      Config
}

// NewService membangun service dengan klien Telegram nyata.
func NewService(repo *repository.CloudStorageRepository, tg TelegramAPI, cfg Config) *Service {
	if cfg.MaxUploadBytes <= 0 {
		cfg.MaxUploadBytes = 2048 * 1024 * 1024
	}
	return &Service{repo: repo, tg: tg, cfg: cfg}
}

// SetSessionRepo memasang repo sesi upload bertahap (injektion terpisah
// untuk hindari import cycle: repo mengimpor models, tidak mengimpor paket ini).
func (s *Service) SetSessionRepo(r *repository.CloudUploadSessionRepository) {
	s.sessRepo = r
}

// Enabled melaporkan apakah backend Telegram sudah dikonfigurasi.
func (s *Service) Enabled() bool {
	return s.cfg.BotToken != "" && s.cfg.ChatID != ""
}

// MaxUploadBytes mengembalikan batas ukuran upload.
func (s *Service) MaxUploadBytes() int64 { return s.cfg.MaxUploadBytes }

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

// List mengembalikan isi folder + total (untuk paginasi).
func (s *Service) List(ownerID string, parentID *string, limit, offset int) ([]models.CloudFile, int, error) {
	files, err := s.repo.ListFiles(ownerID, parentID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.repo.CountFiles(ownerID, parentID)
	if err != nil {
		return nil, 0, err
	}
	return files, total, nil
}

// ListOptions menampung parameter listing lanjutan (sortir & filter).
type ListOptions struct {
	Sort    string
	Type    string
	Starred bool
	Limit   int
	Offset  int
}

// ListFiltered mengembalikan isi folder dengan sortir/filter + total.
func (s *Service) ListFiltered(ownerID string, parentID *string, opts ListOptions) ([]models.CloudFile, int, error) {
	ropts := repository.CloudListOptions{
		ParentID: parentID,
		Sort:     opts.Sort,
		Type:     opts.Type,
		Starred:  opts.Starred,
		Limit:    opts.Limit,
		Offset:   opts.Offset,
	}
	files, err := s.repo.ListFilesFiltered(ownerID, ropts)
	if err != nil {
		return nil, 0, err
	}
	ropCount := ropts
	ropCount.Limit, ropCount.Offset = 0, 0
	total, err := s.repo.CountFilesFiltered(ownerID, ropCount)
	if err != nil {
		return nil, 0, err
	}
	return files, total, nil
}

// ListStarred mengembalikan item favorit owner.
func (s *Service) ListStarred(ownerID string) ([]models.CloudFile, error) {
	files, err := s.repo.ListStarred(ownerID)
	if err != nil {
		return nil, err
	}
	s.repo.AttachPaths(ownerID, files)
	return files, nil
}

// ListRecent mengembalikan berkas yang terakhir diakses/diubah.
func (s *Service) ListRecent(ownerID string) ([]models.CloudFile, error) {
	files, err := s.repo.ListRecent(ownerID)
	if err != nil {
		return nil, err
	}
	s.repo.AttachPaths(ownerID, files)
	return files, nil
}

// ListLarge mengembalikan berkas terbesar.
func (s *Service) ListLarge(ownerID string) ([]models.CloudFile, error) {
	files, err := s.repo.ListLarge(ownerID)
	if err != nil {
		return nil, err
	}
	s.repo.AttachPaths(ownerID, files)
	return files, nil
}

// SetStarred menetapkan status favorit sebuah item.
func (s *Service) SetStarred(ownerID, id string, starred bool) (*models.CloudFile, error) {
	if err := s.repo.SetStarred(ownerID, id, starred, time.Now().Unix()); err != nil {
		return nil, err
	}
	return s.repo.GetFile(ownerID, id)
}

// TouchAccessed mencatat waktu akses terakhir (best-effort, error diabaikan
// oleh pemanggil agar tidak menggagalkan unduhan/pratinjau).
func (s *Service) TouchAccessed(ownerID, id string) {
	_ = s.repo.TouchAccessed(ownerID, id, time.Now().Unix())
}

// Reorder menetapkan urutan manual item dalam satu folder.
func (s *Service) Reorder(ownerID string, orderedIDs []string) error {
	if len(orderedIDs) == 0 {
		return errors.New("tidak ada item")
	}
	orders := make(map[string]int64, len(orderedIDs))
	for i, id := range orderedIDs {
		// Pastikan item memang milik owner sebelum mengubah.
		if _, err := s.repo.GetFile(ownerID, id); err != nil {
			return err
		}
		orders[id] = int64(i)
	}
	return s.repo.SetSortOrders(ownerID, orders, time.Now().Unix())
}

// Get mengambil metadata file aktif milik owner.
func (s *Service) Get(ownerID, id string) (*models.CloudFile, error) {
	return s.repo.GetFile(ownerID, id)
}

// Usage mengembalikan total byte & jumlah file aktif milik owner.
func (s *Service) Usage(ownerID string) (int64, int, error) {
	return s.repo.SumSizeByOwner(ownerID)
}

// Search mencari file berdasarkan nama.
func (s *Service) Search(ownerID, query string) ([]models.CloudFile, error) {
	if strings.TrimSpace(query) == "" {
		return []models.CloudFile{}, nil
	}
	return s.repo.Search(ownerID, query)
}

// ListTrash mengembalikan isi trash owner.
func (s *Service) ListTrash(ownerID string) ([]models.CloudFile, error) {
	return s.repo.ListTrash(ownerID)
}

// ---------------------------------------------------------------------------
// Folder & Upload
// ---------------------------------------------------------------------------

// CreateFolder membuat folder baru (nama unik otomatis bila bentrok).
func (s *Service) CreateFolder(ownerID, name string, parentID *string) (*models.CloudFile, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("nama folder wajib diisi")
	}
	if err := s.validateParent(ownerID, parentID); err != nil {
		return nil, err
	}
	used, err := s.repo.UsedNames(ownerID, parentID, "")
	if err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	f := &models.CloudFile{
		ID:        cuid2.Generate(),
		OwnerID:   ownerID,
		Name:      repository.UniqueCloudName(used, name),
		ParentID:  parentID,
		IsFolder:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Create(f); err != nil {
		return nil, err
	}
	return f, nil
}

// Upload menyimpan file baru: stream → (opsional enkripsi) → Telegram → metadata.
//
// File dibaca sepenuhnya ke memori HANYA bila enkripsi aktif (perlu untuk GCM).
// Tanpa enkripsi, file di-stream langsung ke Telegram tanpa buffering besar.
func (s *Service) Upload(ctx context.Context, ownerID string, file multipart.File, header *multipart.FileHeader, parentID *string) (*models.CloudFile, error) {
	if !s.Enabled() {
		return nil, errors.New("Cloud Storage belum dikonfigurasi (bot token/chat_id kosong)")
	}
	if header.Size > s.cfg.MaxUploadBytes {
		return nil, fmt.Errorf("file melebihi batas %d MB", s.cfg.MaxUploadBytes/(1024*1024))
	}
	if err := s.validateParent(ownerID, parentID); err != nil {
		return nil, err
	}

	name := filepath.Base(strings.TrimSpace(header.Filename))
	if name == "" || name == "." || name == "/" {
		name = "file-" + cuid2.Generate()
	}

	var uploadReader io.Reader = file
	encrypted := false
	if s.cfg.EncryptionKey != "" {
		plain, err := io.ReadAll(file)
		if err != nil {
			return nil, err
		}
		enc, err := EncryptBlob(plain, s.cfg.EncryptionKey)
		if err != nil {
			return nil, err
		}
		uploadReader = bytes.NewReader(enc)
		encrypted = true
	}

	mimeType := detectMime(name, header.Header.Get("Content-Type"))

	fileID, size, messageID, err := s.tg.SendDocument(ctx, uploadReader, name, s.cfg.ChatID)
	if err != nil {
		return nil, err
	}
	if size == 0 {
		size = header.Size
	}

	// Simpan metadata dengan nama unik (retry saat konflik konkuren).
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
		Encrypted: encrypted,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.createWithUniqueName(ownerID, parentID, f, name); err != nil {
		// Gagal simpan metadata → hapus file di Telegram agar tidak orphan.
		_ = s.tg.DeleteMessage(ctx, s.cfg.ChatID, messageID)
		return nil, err
	}
	return f, nil
}

func (s *Service) createWithUniqueName(ownerID string, parentID *string, f *models.CloudFile, baseName string) error {
	ext := filepath.Ext(baseName)
	stem := strings.TrimSuffix(baseName, ext)
	for attempt := 0; attempt < 100; attempt++ {
		if err := s.repo.Create(f); err == nil {
			return nil
		} else if !repository.IsCloudUniqueConstraint(err) {
			return err
		}
		f.Name = fmt.Sprintf("%s (%d)%s", stem, attempt+1, ext)
	}
	return errors.New("tidak bisa membuat nama berkas unik")
}

// ---------------------------------------------------------------------------
// Rename / Move / Copy
// ---------------------------------------------------------------------------

// Rename mengubah nama file/folder (nama unik otomatis bila bentrok).
func (s *Service) Rename(ownerID, id, name string) (*models.CloudFile, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("nama wajib diisi")
	}
	f, err := s.repo.GetFile(ownerID, id)
	if err != nil {
		return nil, err
	}
	used, err := s.repo.UsedNames(ownerID, f.ParentID, id)
	if err != nil {
		return nil, err
	}
	f.Name = repository.UniqueCloudName(used, name)
	f.UpdatedAt = time.Now().Unix()
	if err := s.repo.Update(f); err != nil {
		return nil, err
	}
	return f, nil
}

// Move memindahkan file/folder ke folder tujuan (cut-paste).
func (s *Service) Move(ownerID string, ids []string, targetID *string) error {
	if len(ids) == 0 {
		return errors.New("tidak ada item dipilih")
	}
	if err := s.validateParent(ownerID, targetID); err != nil {
		return err
	}
	for _, id := range ids {
		f, err := s.repo.GetFile(ownerID, id)
		if err != nil {
			return err
		}
		if targetID != nil {
			if *targetID == id {
				return errors.New("tidak bisa memindahkan folder ke dalam dirinya sendiri")
			}
			if f.IsFolder {
				desc, err := s.isDescendant(ownerID, *targetID, id)
				if err != nil {
					return err
				}
				if desc {
					return errors.New("tidak bisa memindahkan folder ke dalam subfoldernya")
				}
			}
		}
		sameParent := (f.ParentID == nil && targetID == nil) ||
			(f.ParentID != nil && targetID != nil && *f.ParentID == *targetID)
		if !sameParent {
			used, err := s.repo.UsedNames(ownerID, targetID, id)
			if err != nil {
				return err
			}
			f.Name = repository.UniqueCloudName(used, f.Name)
		}
		f.ParentID = targetID
		f.UpdatedAt = time.Now().Unix()
		if err := s.repo.Update(f); err != nil {
			return err
		}
	}
	return nil
}

// Copy menyalin file/folder secara rekursif. File di Telegram disalin via
// copyMessage (tanpa re-upload); fallback re-upload bila gagal.
func (s *Service) Copy(ctx context.Context, ownerID string, ids []string, targetID *string) error {
	if len(ids) == 0 {
		return errors.New("tidak ada item dipilih")
	}
	if err := s.validateParent(ownerID, targetID); err != nil {
		return err
	}
	for _, id := range ids {
		f, err := s.repo.GetFile(ownerID, id)
		if err != nil {
			return err
		}
		if targetID != nil && f.IsFolder {
			if *targetID == id {
				return errors.New("tidak bisa menyalin folder ke dalam dirinya sendiri")
			}
			desc, err := s.isDescendant(ownerID, *targetID, id)
			if err != nil {
				return err
			}
			if desc {
				return errors.New("tidak bisa menyalin folder ke dalam subfoldernya")
			}
		}
		if err := s.copyRecursive(ctx, ownerID, f, targetID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) copyRecursive(ctx context.Context, ownerID string, f *models.CloudFile, targetID *string) error {
	now := time.Now().Unix()
	newFile := &models.CloudFile{
		ID:        cuid2.Generate(),
		OwnerID:   ownerID,
		Name:      f.Name,
		ParentID:  targetID,
		IsFolder:  f.IsFolder,
		MimeType:  f.MimeType,
		Size:      f.Size,
		Encrypted: f.Encrypted,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if !f.IsFolder && f.FileID != nil {
		// Salin di Telegram. copyMessage butuh message_id sumber.
		var newMessageID int64
		if f.MessageID != nil {
			mid, err := s.tg.CopyMessage(ctx, s.cfg.ChatID, *f.MessageID, s.cfg.ChatID)
			if err == nil {
				newMessageID = mid
			}
		}
		if newMessageID == 0 {
			// Fallback: re-upload (unduh lalu unggah ulang).
			newFileID, mid, err := s.reUpload(ctx, f)
			if err != nil {
				return err
			}
			newFile.FileID = &newFileID
			newMessageID = mid
		} else {
			newFile.FileID = f.FileID
		}
		newFile.MessageID = &newMessageID
	}

	if err := s.createWithUniqueName(ownerID, targetID, newFile, f.Name); err != nil {
		return err
	}

	if f.IsFolder {
		children, err := s.repo.ListChildren(ownerID, f.ID)
		if err != nil {
			return err
		}
		for i := range children {
			if err := s.copyRecursive(ctx, ownerID, &children[i], &newFile.ID); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Service) reUpload(ctx context.Context, f *models.CloudFile) (string, int64, error) {
	path, err := s.tg.GetFilePath(ctx, *f.FileID)
	if err != nil {
		return "", 0, err
	}
	resp, err := s.tg.DownloadStream(ctx, path, "")
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, err
	}
	if f.Encrypted && s.cfg.EncryptionKey != "" {
		if data, err = DecryptBlob(data, s.cfg.EncryptionKey); err != nil {
			return "", 0, err
		}
	}
	fileID, _, messageID, err := s.tg.SendDocument(ctx, bytes.NewReader(data), f.Name, s.cfg.ChatID)
	if err != nil {
		return "", 0, err
	}
	return fileID, messageID, nil
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

// Trash memindahkan file/folder (beserta isinya) ke trash.
func (s *Service) Trash(ownerID, id string) error {
	f, err := s.repo.GetFile(ownerID, id)
	if err != nil {
		return err
	}
	return s.softDeleteCascade(ownerID, f, time.Now().Unix())
}

func (s *Service) softDeleteCascade(ownerID string, f *models.CloudFile, ts int64) error {
	if err := s.repo.SoftDelete(ownerID, f.ID, ts); err != nil {
		return err
	}
	if f.IsFolder {
		children, err := s.repo.ListChildren(ownerID, f.ID)
		if err != nil {
			return err
		}
		for i := range children {
			if children[i].DeletedAt == nil {
				if err := s.softDeleteCascade(ownerID, &children[i], ts); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// Restore memulihkan file/folder (beserta isinya) dari trash.
func (s *Service) Restore(ownerID, id string) error {
	f, err := s.repo.GetFileAny(ownerID, id)
	if err != nil {
		return err
	}
	return s.restoreCascade(ownerID, f)
}

func (s *Service) restoreCascade(ownerID string, f *models.CloudFile) error {
	used, err := s.repo.UsedNames(ownerID, f.ParentID, f.ID)
	if err != nil {
		return err
	}
	f.Name = repository.UniqueCloudName(used, f.Name)
	now := time.Now().Unix()
	f.UpdatedAt = now
	if err := s.repo.Update(f); err != nil {
		return err
	}
	if err := s.repo.Restore(ownerID, f.ID, now); err != nil {
		return err
	}
	if f.IsFolder {
		children, err := s.repo.ListChildren(ownerID, f.ID)
		if err != nil {
			return err
		}
		for i := range children {
			if children[i].DeletedAt != nil {
				if err := s.restoreCascade(ownerID, &children[i]); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// RestoreAll memulihkan seluruh isi trash.
func (s *Service) RestoreAll(ownerID string) error {
	trash, err := s.repo.ListTrash(ownerID)
	if err != nil {
		return err
	}
	inTrash := map[string]bool{}
	for _, f := range trash {
		inTrash[f.ID] = true
	}
	for i := range trash {
		f := &trash[i]
		if f.ParentID != nil && inTrash[*f.ParentID] {
			continue // dipulihkan bersama parent-nya
		}
		if err := s.restoreCascade(ownerID, f); err != nil {
			return err
		}
	}
	return nil
}

// PermanentDelete menghapus file/folder (beserta isinya) secara permanen, dan
// memanggil deleteMessage Telegram bila tidak ada referensi lain (hasil copy).
func (s *Service) PermanentDelete(ctx context.Context, ownerID, id string) error {
	f, err := s.repo.GetFileAny(ownerID, id)
	if err != nil {
		return err
	}
	return s.permanentDeleteCascade(ctx, ownerID, f)
}

func (s *Service) permanentDeleteCascade(ctx context.Context, ownerID string, f *models.CloudFile) error {
	if f.IsFolder {
		children, err := s.repo.ListChildren(ownerID, f.ID)
		if err != nil {
			return err
		}
		for i := range children {
			if err := s.permanentDeleteCascade(ctx, ownerID, &children[i]); err != nil {
				return err
			}
		}
	}
	if f.FileID != nil && f.MessageID != nil && s.Enabled() {
		// Hapus pesan Telegram hanya jika ini referensi terakhir.
		n, err := s.countByFileID(f.FileID)
		if err == nil && n <= 1 {
			if derr := s.tg.DeleteMessage(ctx, s.cfg.ChatID, *f.MessageID); derr != nil {
				log.Printf("cloudstorage: gagal hapus pesan telegram %d: %v", *f.MessageID, derr)
			}
		}
	}
	s.removeThumbCache(f.FileID)
	return s.repo.PermanentDelete(ownerID, f.ID)
}

// EmptyTrash menghapus permanen seluruh isi trash.
func (s *Service) EmptyTrash(ctx context.Context, ownerID string) error {
	trash, err := s.repo.ListTrash(ownerID)
	if err != nil {
		return err
	}
	inTrash := map[string]bool{}
	for _, f := range trash {
		inTrash[f.ID] = true
	}
	for i := range trash {
		f := &trash[i]
		if f.ParentID != nil && inTrash[*f.ParentID] {
			continue
		}
		if err := s.permanentDeleteCascade(ctx, ownerID, f); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) countByFileID(fileID *string) (int, error) {
	if fileID == nil {
		return 0, nil
	}
	var n int
	err := s.repo.DB.QueryRow("SELECT COUNT(*) FROM cloud_files WHERE file_id = ?", *fileID).Scan(&n)
	return n, err
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

// CreateShare membuat (atau mengembalikan) token share untuk sebuah file.
func (s *Service) CreateShare(ownerID, id string, expiryDays int64) (string, error) {
	f, err := s.repo.GetFile(ownerID, id)
	if err != nil {
		return "", err
	}
	now := time.Now().Unix()
	if f.ShareToken != nil {
		if f.ShareExpiresAt == nil || *f.ShareExpiresAt > now {
			return *f.ShareToken, nil
		}
	}
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	kind := "file"
	if f.IsFolder {
		kind = "folder"
	}
	f.ShareToken = &token
	f.ShareKind = &kind
	if expiryDays > 0 {
		exp := now + expiryDays*86400
		f.ShareExpiresAt = &exp
	} else {
		f.ShareExpiresAt = nil
	}
	f.UpdatedAt = now
	if err := s.repo.Update(f); err != nil {
		return "", err
	}
	return token, nil
}

// RevokeShare mencabut token share.
func (s *Service) RevokeShare(ownerID, id string) error {
	f, err := s.repo.GetFile(ownerID, id)
	if err != nil {
		return err
	}
	f.ShareToken = nil
	f.ShareExpiresAt = nil
	f.ShareKind = nil
	f.UpdatedAt = time.Now().Unix()
	return s.repo.Update(f)
}

// SharedEntry adalah metadata ringkas untuk halaman share publik (tanpa
// membocorkan owner_id / file_id).
type SharedEntry struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	IsFolder bool   `json:"is_folder"`
	Size     int64  `json:"size"`
	MimeType string `json:"mime_type"`
}

// ListSharedFolder mengembalikan isi folder yang dibagikan (read-only).
func (s *Service) ListSharedFolder(token string) ([]SharedEntry, error) {
	root, err := s.GetSharedFile(token)
	if err != nil {
		return nil, err
	}
	if !root.IsFolder {
		return nil, errors.New("bukan folder")
	}
	return s.listSharedRecursive(root.OwnerID, root.ID)
}

func (s *Service) listSharedRecursive(ownerID, parentID string) ([]SharedEntry, error) {
	children, err := s.repo.ListFiles(ownerID, &parentID, 0, 0)
	if err != nil {
		return nil, err
	}
	out := []SharedEntry{}
	for _, c := range children {
		out = append(out, SharedEntry{ID: c.ID, Name: c.Name, IsFolder: c.IsFolder, Size: c.Size, MimeType: c.MimeType})
	}
	return out, nil
}

// SharedFileByID mengambil berkas di dalam folder yang di-share memakai token
// sebagai otorisasi. Hanya item yang berada di bawah folder root token tsb.
func (s *Service) SharedFileByID(token, id string) (*models.CloudFile, error) {
	root, err := s.GetSharedFile(token)
	if err != nil {
		return nil, err
	}
	entry, err := s.repo.GetFile(root.OwnerID, id)
	if err != nil {
		return nil, err
	}
	if entry.ID == root.ID {
		return entry, nil
	}
	if !root.IsFolder {
		return nil, repository.ErrCloudNotFound
	}
	desc, err := s.isDescendant(root.OwnerID, entry.ID, root.ID)
	if err != nil {
		return nil, err
	}
	if !desc {
		return nil, repository.ErrCloudNotFound
	}
	return entry, nil
}

// GetSharedFile mengambil file berdasarkan token publik + cek kadaluarsa.
func (s *Service) GetSharedFile(token string) (*models.CloudFile, error) {
	f, err := s.repo.GetByShareToken(token)
	if err != nil {
		return nil, err
	}
	if f.ShareExpiresAt != nil && time.Now().Unix() > *f.ShareExpiresAt {
		return nil, repository.ErrCloudNotFound
	}
	return f, nil
}

// ---------------------------------------------------------------------------
// Download / Thumbnail
// ---------------------------------------------------------------------------

// StreamResult membawa hasil pembukaan stream berkas.
type StreamResult struct {
	Body         io.ReadCloser
	ContentType  string
	Size         int64  // ukuran total berkas (untuk header Content-Range)
	Partial      bool   // true bila ini respons partial (HTTP 206)
	ContentRange string // header Content-Range bila partial (dari sumber)
}

// OpenStream membuka stream isi file untuk diunduh/disajikan (mendukung Range).
// Bila file terenkripsi, Range tidak didukung (harus unduh + dekripsi penuh).
func (s *Service) OpenStream(ctx context.Context, f *models.CloudFile, rangeHeader string) (*StreamResult, error) {
	if f.IsFolder || f.FileID == nil {
		return nil, errors.New("bukan berkas")
	}
	if !s.Enabled() {
		return nil, errors.New("Cloud Storage belum dikonfigurasi")
	}
	path, err := s.tg.GetFilePath(ctx, *f.FileID)
	if err != nil {
		return nil, err
	}

	if f.Encrypted && s.cfg.EncryptionKey != "" {
		resp, err := s.tg.DownloadStream(ctx, path, "")
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		plain, err := DecryptBlob(data, s.cfg.EncryptionKey)
		if err != nil {
			return nil, err
		}
		return &StreamResult{
			Body:        io.NopCloser(bytes.NewReader(plain)),
			ContentType: f.MimeType,
			Size:        int64(len(plain)),
		}, nil
	}

	// Non-enkripsi: teruskan Range.
	resp, err := s.tg.DownloadStream(ctx, path, rangeHeader)
	if err != nil {
		return nil, err
	}
	ct := f.MimeType
	if ct == "" {
		ct = resp.Header.Get("Content-Type")
	}
	total := resp.ContentLength
	if cr := resp.Header.Get("Content-Range"); cr != "" {
		if i := strings.LastIndex(cr, "/"); i >= 0 {
			if n, perr := strconv.ParseInt(cr[i+1:], 10, 64); perr == nil && n > 0 {
				total = n
			}
		}
	}
	return &StreamResult{
		Body:         resp.Body,
		ContentType:  ct,
		Size:         total,
		Partial:      resp.StatusCode == 206,
		ContentRange: resp.Header.Get("Content-Range"),
	}, nil
}

// GetThumbnail menghasilkan thumbnail gambar (cache di disk). Untuk file
// terenkripsi thumbnail tidak dibuat (butuh dekripsi; cukup tampilkan ikon).
func (s *Service) GetThumbnail(ctx context.Context, f *models.CloudFile) ([]byte, string, error) {
	if f.FileID == nil || f.IsFolder || !strings.HasPrefix(f.MimeType, "image/") {
		return nil, "", errors.New("thumbnail tidak tersedia")
	}
	if f.Encrypted && s.cfg.EncryptionKey != "" {
		return nil, "", errors.New("thumbnail tidak tersedia untuk file terenkripsi")
	}

	cachePath := s.thumbCachePath(*f.FileID)
	if data, err := os.ReadFile(cachePath); err == nil {
		return data, "image/jpeg", nil
	}

	res, err := s.OpenStream(ctx, f, "")
	if err != nil {
		return nil, "", err
	}
	defer res.Body.Close()
	rc := res.Body

	src, _, err := image.Decode(rc)
	if err != nil {
		return nil, "", err
	}
	thumb := fitImage(src, 400, 400)
	buf := &bytes.Buffer{}
	if err := encodeJPEG(buf, thumb, 85); err != nil {
		return nil, "", err
	}
	if s.cfg.ThumbDir != "" {
		if err := os.MkdirAll(s.cfg.ThumbDir, 0o755); err == nil {
			_ = os.WriteFile(cachePath, buf.Bytes(), 0o644)
		}
	}
	return buf.Bytes(), "image/jpeg", nil
}

func (s *Service) thumbCachePath(fileID string) string {
	sum := sha256.Sum256([]byte(fileID))
	return filepath.Join(s.cfg.ThumbDir, hex.EncodeToString(sum[:])+".jpg")
}

func (s *Service) removeThumbCache(fileID *string) {
	if fileID == nil || s.cfg.ThumbDir == "" {
		return
	}
	_ = os.Remove(s.thumbCachePath(*fileID))
}

// CleanThumbCache membersihkan thumbnail yatim (file sudah tidak ada).
func (s *Service) CleanThumbCache() error {
	if s.cfg.ThumbDir == "" {
		return nil
	}
	entries, err := os.ReadDir(s.cfg.ThumbDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	rows, err := s.repo.DB.Query("SELECT file_id FROM cloud_files WHERE file_id IS NOT NULL")
	if err != nil {
		return err
	}
	defer rows.Close()
	valid := map[string]bool{}
	for rows.Next() {
		var fid string
		if err := rows.Scan(&fid); err != nil {
			return err
		}
		sum := sha256.Sum256([]byte(fid))
		valid[hex.EncodeToString(sum[:])+".jpg"] = true
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !valid[e.Name()] {
			_ = os.Remove(filepath.Join(s.cfg.ThumbDir, e.Name()))
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func (s *Service) validateParent(ownerID string, parentID *string) error {
	if parentID == nil {
		return nil
	}
	f, err := s.repo.GetFile(ownerID, *parentID)
	if err != nil {
		return errors.New("folder tujuan tidak ditemukan")
	}
	if !f.IsFolder {
		return errors.New("target bukan folder")
	}
	return nil
}

// ---------------------------------------------------------------------------
// Ruang arsip bersama
// ---------------------------------------------------------------------------

// ArchiveOwnerID adalah pemilik semu (pseudo-owner) untuk "ruang arsip
// bersama". File arsip surat/dokumen di Cloud Storage berada di bawah owner ini
// agar tidak bercampur dengan Cloud Storage pribadi pengguna, namun tetap
// dapat diakses staf melalui resolusi khusus di penyaji file.
const ArchiveOwnerID = "_archive"

// ensureArchiveFolder membuat folder arsip (idempoten) di bawah pemilik arsip
// dan mengembalikan ID-nya. name = label folder (mis. "Surat Masuk/2025/07").
func (s *Service) ensureArchiveFolder(name string) (string, error) {
	parts := strings.Split(strings.Trim(strings.TrimSpace(name), "/"), "/")
	parentID := ""
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		var parentPtr *string
		if parentID != "" {
			parentPtr = &parentID
		}
		id, err := s.ensureChildFolder(ArchiveOwnerID, parentPtr, part)
		if err != nil {
			return "", err
		}
		parentID = id
	}
	return parentID, nil
}

// ensureChildFolder mencari folder `name` di bawah parent (owner arsip);
// membuatnya bila belum ada. Mengembalikan ID folder.
func (s *Service) ensureChildFolder(ownerID string, parentID *string, name string) (string, error) {
	children, err := s.repo.ListChildren(ownerID, derefOrEmpty(parentID))
	if err != nil {
		return "", err
	}
	for _, c := range children {
		if c.IsFolder && c.Name == name {
			return c.ID, nil
		}
	}
	now := time.Now().Unix()
	f := &models.CloudFile{
		ID:        cuid2.Generate(),
		OwnerID:   ownerID,
		Name:      name,
		ParentID:  parentID,
		IsFolder:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Create(f); err != nil {
		return "", err
	}
	return f.ID, nil
}

func derefOrEmpty(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// ArchiveUpload menyimpan berkas ke ruang arsip bersama (bukan milik pengguna).
// folderPath = path folder relatif, mis. "Surat Masuk/2025/07".
// Mengembalikan metadata cloud file yang dibuat (owner = ArchiveOwnerID).
func (s *Service) ArchiveUpload(ctx context.Context, folderPath string, file multipart.File, header *multipart.FileHeader) (*models.CloudFile, error) {
	if !s.Enabled() {
		return nil, errors.New("Cloud Storage belum dikonfigurasi (bot token/chat_id kosong)")
	}
	if header.Size > s.cfg.MaxUploadBytes {
		return nil, fmt.Errorf("file melebihi batas %d MB", s.cfg.MaxUploadBytes/(1024*1024))
	}
	folderID, err := s.ensureArchiveFolder(folderPath)
	if err != nil {
		return nil, err
	}
	var parentID *string
	if folderID != "" {
		parentID = &folderID
	}

	name := filepath.Base(strings.TrimSpace(header.Filename))
	if name == "" || name == "." || name == "/" {
		name = "arsip-" + cuid2.Generate()
	}

	var uploadReader io.Reader = file
	encrypted := false
	if s.cfg.EncryptionKey != "" {
		plain, err := io.ReadAll(file)
		if err != nil {
			return nil, err
		}
		enc, err := EncryptBlob(plain, s.cfg.EncryptionKey)
		if err != nil {
			return nil, err
		}
		uploadReader = bytes.NewReader(enc)
		encrypted = true
	}

	mimeType := detectMime(name, header.Header.Get("Content-Type"))
	fileID, size, messageID, err := s.tg.SendDocument(ctx, uploadReader, name, s.cfg.ChatID)
	if err != nil {
		return nil, err
	}
	if size == 0 {
		size = header.Size
	}

	now := time.Now().Unix()
	used, _ := s.repo.UsedNames(ArchiveOwnerID, parentID, "")
	f := &models.CloudFile{
		ID:        cuid2.Generate(),
		OwnerID:   ArchiveOwnerID,
		Name:      repository.UniqueCloudName(used, name),
		ParentID:  parentID,
		IsFolder:  false,
		FileID:    &fileID,
		MessageID: &messageID,
		MimeType:  mimeType,
		Size:      size,
		Encrypted: encrypted,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.createWithUniqueName(ArchiveOwnerID, parentID, f, name); err != nil {
		_ = s.tg.DeleteMessage(ctx, s.cfg.ChatID, messageID)
		return nil, err
	}
	return f, nil
}

// isDescendant memeriksa apakah candidate adalah turunan dari ancestor.
func (s *Service) isDescendant(ownerID, candidateID, ancestorID string) (bool, error) {
	seen := map[string]bool{}
	curr := candidateID
	for curr != "" && curr != ancestorID {
		if seen[curr] {
			return false, nil
		}
		seen[curr] = true
		f, err := s.repo.GetFileAny(ownerID, curr)
		if err != nil {
			return false, err
		}
		if f.ParentID == nil {
			return false, nil
		}
		curr = *f.ParentID
	}
	return curr == ancestorID, nil
}

func randomToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
