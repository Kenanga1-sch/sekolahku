package service

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/disintegration/imaging"

	"cloudstorage/internal/config"
	"cloudstorage/internal/crypto"
	"cloudstorage/internal/model"
	"cloudstorage/internal/repository"
	"cloudstorage/internal/telegram"
)

type TelegramAPI interface {
	UploadFile(reader io.Reader, filename string, chatID string, size int64) (string, int64, int64, error)
	DeleteMessage(chatID string, messageID int64) error
	DownloadFile(fileID string) (io.ReadCloser, error)
	DownloadFileWithRange(fileID, rangeHeader string) (*http.Response, error)
}

type Service struct {
	repo     *repository.Repository
	cfg      *config.Config
	telegram TelegramAPI
}

func NewService(repo *repository.Repository, cfg *config.Config) *Service {
	return NewServiceWithTelegram(repo, cfg, telegram.NewClient(cfg.TelegramToken, cfg.TelegramAPI))
}

func NewServiceWithTelegram(repo *repository.Repository, cfg *config.Config, tg TelegramAPI) *Service {
	return &Service{
		repo:     repo,
		cfg:      cfg,
		telegram: tg,
	}
}

func (s *Service) AuthRequired() bool {
	return s.cfg.AuthToken != ""
}

func (s *Service) MaxUploadSize() int64 {
	if s.cfg.MaxUploadSize > 0 {
		return s.cfg.MaxUploadSize
	}
	return 2048 * 1024 * 1024
}

func (s *Service) ListFiles(parentID *string) ([]model.File, error) {
	return s.repo.ListFiles(parentID)
}

func (s *Service) ListFilesPage(parentID *string, limit, offset int) ([]model.File, error) {
	return s.repo.ListFilesPage(parentID, limit, offset)
}

func (s *Service) CountFiles(parentID *string) (int, error) {
	return s.repo.CountFiles(parentID)
}

func (s *Service) ListAllFolders() ([]model.File, error) {
	return s.repo.ListAllFolders()
}

func (s *Service) CreateFolder(name string, parentID *string) (*model.File, error) {
	if name == "" {
		return nil, errors.New("name is required")
	}
	id, err := generateID()
	if err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	f := &model.File{
		ID:        id,
		Name:      name,
		ParentID:  parentID,
		IsFolder:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.WithTx(func(r *repository.Repository) error {
		if err := validateTarget(r, parentID); err != nil {
			return err
		}
		used := collectUsedNames(r, parentID, "")
		return createFileWithUniqueName(r, f, used)
	}); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *Service) UploadFile(file multipart.File, header *multipart.FileHeader, parentID *string) (*model.File, error) {
	chatID, err := s.chatID()
	if err != nil {
		return nil, err
	}

	// Baca seluruh file ke memory untuk enkripsi jika diperlukan
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	// Validasi Content-Type: pastikan tipe yang dikirim klien sesuai dengan isi file
	contentType := http.DetectContentType(data)
	expectedContentType := header.Header.Get("Content-Type")
	if contentType != expectedContentType {
		// Izinkan mismatch untuk jenis file khusus (seperti aplikasi/) tetapi beri peringatan
		if !strings.HasPrefix(contentType, "application/") || !strings.HasPrefix(expectedContentType, "application/") {
			return nil, fmt.Errorf("mime type mismatch: expected %s, got %s", expectedContentType, contentType)
		}
	}

	uploadData := data
	encrypted := false
	if s.cfg.EncryptionEnabled && s.cfg.EncryptionKey != "" {
		encData, err := crypto.Encrypt(data, s.cfg.EncryptionKey)
		if err != nil {
			return nil, fmt.Errorf("enkripsi gagal: %w", err)
		}
		uploadData = encData
		encrypted = true
	}

	fileID, _, messageID, err := s.telegram.UploadFile(bytes.NewReader(uploadData), header.Filename, chatID, int64(len(uploadData)))
	if err != nil {
		return nil, err
	}

	id, err := generateID()
	if err != nil {
		_ = s.telegram.DeleteMessage(chatID, messageID)
		return nil, err
	}
	now := time.Now().Unix()

	f := &model.File{
		ID:        id,
		Name:      header.Filename,
		ParentID:  parentID,
		IsFolder:  false,
		FileID:    &fileID,
		MessageID: &messageID,
		MimeType:  contentType, // Gunakan yang tervalidasi daripada dari header
		Size:      int64(len(data)), // Simpan ukuran asli
		Encrypted: encrypted,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.WithTx(func(r *repository.Repository) error {
		used := collectUsedNames(r, parentID, "")
		return createFileWithUniqueName(r, f, used)
	}); err != nil {
		_ = s.telegram.DeleteMessage(chatID, messageID)
		return nil, err
	}

	return f, nil
}

func (s *Service) chatID() (string, error) {
	if s.cfg.TelegramChatID != "" {
		return s.cfg.TelegramChatID, nil
	}
	return "", errors.New("TELEGRAM_CHAT_ID belum dikonfigurasi")
}

func (s *Service) GetFile(id string) (*model.File, error) {
	return s.repo.GetFile(id)
}

func (s *Service) RenameFile(id, name string) (*model.File, error) {
	if name == "" {
		return nil, errors.New("name is required")
	}
	f, err := s.repo.GetFile(id)
	if err != nil {
		return nil, err
	}
	used := collectUsedNames(s.repo, f.ParentID, id)
	if uniqueNameFromUsed(used, name) != name {
		return nil, errors.New("nama sudah digunakan di lokasi ini")
	}
	f.Name = name
	f.UpdatedAt = time.Now().Unix()
	if err := s.repo.UpdateFile(f); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *Service) DeleteFile(id string) error {
	return s.repo.WithTx(func(r *repository.Repository) error {
		return softDeleteCascade(r, id, time.Now().Unix())
	})
}

func softDeleteCascade(r *repository.Repository, id string, ts int64) error {
	f, err := r.GetFile(id)
	if err != nil {
		return err
	}
	if err := r.SoftDelete(id, ts); err != nil {
		return err
	}
	if f.IsFolder {
		children, err := r.ListFilesAny(&id)
		if err != nil {
			return err
		}
		for _, child := range children {
			if child.DeletedAt == nil {
				if err := softDeleteCascade(r, child.ID, ts); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (s *Service) CreateShareLink(id string) (string, error) {
	f, err := s.repo.GetFile(id)
	if err != nil {
		return "", err
	}
	if f.ShareToken != nil {
		if f.ShareExpiresAt == nil || *f.ShareExpiresAt > time.Now().Unix() {
			return *f.ShareToken, nil
		}
	}
	token, err := generateToken()
	if err != nil {
		return "", err
	}
	f.ShareToken = &token
	f.UpdatedAt = time.Now().Unix()
	if s.cfg.ShareExpiryDays > 0 {
		exp := f.UpdatedAt + s.cfg.ShareExpiryDays*86400
		f.ShareExpiresAt = &exp
	}
	if err := s.repo.UpdateFile(f); err != nil {
		return "", err
	}
	return token, nil
}

func (s *Service) GetSharedFile(token string) (*model.File, error) {
	f, err := s.repo.GetFileByShareToken(token)
	if err != nil {
		return nil, err
	}
	if f.ShareExpiresAt != nil && time.Now().Unix() > *f.ShareExpiresAt {
		if err := s.repo.RevokeShareLink(f.ID); err != nil {
			return nil, err
		}
		return nil, errors.New("link share sudah kadaluarsa")
	}
	return f, nil
}

func (s *Service) Search(query string) ([]model.File, error) {
	files, err := s.repo.Search(query)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return files, nil
	}
	paths, err := s.repo.GetAllActivePaths()
	if err != nil {
		return nil, err
	}
	for i := range files {
		if p, ok := paths[files[i].ID]; ok {
			files[i].Path = p
		}
	}
	return files, nil
}

func (s *Service) DownloadFile(id string) (*model.File, error) {
	return s.repo.GetFile(id)
}

func (s *Service) DownloadTelegramFile(fileID string) (io.ReadCloser, error) {
	return s.telegram.DownloadFile(fileID)
}

func (s *Service) DownloadTelegramFileWithRange(fileID, rangeHeader string) (*http.Response, error) {
	return s.telegram.DownloadFileWithRange(fileID, rangeHeader)
}

func (s *Service) DownloadDecryptedFile(id string) (io.ReadCloser, error) {
	f, err := s.repo.GetFile(id)
	if err != nil {
		return nil, err
	}
	if f.FileID == nil {
		return nil, errors.New("file has no telegram file_id")
	}

	rc, err := s.telegram.DownloadFile(*f.FileID)
	if err != nil {
		return nil, err
	}

	if !f.Encrypted || s.cfg.EncryptionKey == "" {
		return rc, nil
	}

	// Download seluruh data terenkripsi
	data, err := io.ReadAll(rc)
	rc.Close()
	if err != nil {
		return nil, err
	}

	decData, err := crypto.Decrypt(data, s.cfg.EncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("dekripsi gagal: %w", err)
	}

	return io.NopCloser(bytes.NewReader(decData)), nil
}

func (s *Service) GetThumbnail(id string) ([]byte, string, error) {
	f, err := s.repo.GetFile(id)
	if err != nil {
		return nil, "", err
	}
	if f.FileID == nil {
		return nil, "", errors.New("file has no telegram file_id")
	}
	if !strings.HasPrefix(f.MimeType, "image/") {
		return nil, "", errors.New("not an image")
	}

	format := imaging.JPEG
	ext := "jpg"
	if strings.Contains(f.MimeType, "png") || strings.Contains(f.MimeType, "gif") || strings.Contains(f.MimeType, "webp") {
		format = imaging.PNG
		ext = "png"
	}

	cachePath := s.thumbCachePath(*f.FileID, ext)
	if data, err := os.ReadFile(cachePath); err == nil {
		return data, "image/" + ext, nil
	}

	rc, err := s.telegram.DownloadFile(*f.FileID)
	if err != nil {
		return nil, "", err
	}
	defer rc.Close()

	img, _, err := image.Decode(rc)
	if err != nil {
		return nil, "", err
	}

	thumb := imaging.Fit(img, 400, 400, imaging.Lanczos)
	buf := &bytes.Buffer{}
	if err := imaging.Encode(buf, thumb, format, imaging.JPEGQuality(85)); err != nil {
		return nil, "", err
	}

	if s.cfg.ThumbCacheDir != "" {
		if err := os.MkdirAll(s.cfg.ThumbCacheDir, 0o755); err == nil {
			_ = os.WriteFile(cachePath, buf.Bytes(), 0o644)
		}
	}

	return buf.Bytes(), "image/" + ext, nil
}

func (s *Service) thumbCachePath(fileID, ext string) string {
	sum := sha256.Sum256([]byte(fileID))
	return filepath.Join(s.cfg.ThumbCacheDir, hex.EncodeToString(sum[:])+"."+ext)
}

func (s *Service) removeThumbCache(fileID *string) {
	if fileID == nil || s.cfg.ThumbCacheDir == "" {
		return
	}
	_ = os.Remove(s.thumbCachePath(*fileID, "jpg"))
	_ = os.Remove(s.thumbCachePath(*fileID, "png"))
}

// CleanThumbCache menghapus file thumbnail yang file_id-nya sudah tidak
// direferensikan oleh file aktif (mis. sudah dihapus permanen).
func (s *Service) CleanThumbCache() error {
	if s.cfg.ThumbCacheDir == "" {
		return nil
	}
	entries, err := os.ReadDir(s.cfg.ThumbCacheDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	ids, err := s.repo.ListActiveFileIDs()
	if err != nil {
		return err
	}
	hashes := make(map[string]bool, len(ids))
	for id := range ids {
		sum := sha256.Sum256([]byte(id))
		hashes[hex.EncodeToString(sum[:])] = true
	}
	removed := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		hash := strings.TrimSuffix(name, filepath.Ext(name))
		if !hashes[hash] {
			if err := os.Remove(filepath.Join(s.cfg.ThumbCacheDir, name)); err == nil {
				removed++
			}
		}
	}
	if removed > 0 {
		log.Printf("thumbcache: menghapus %d file stale", removed)
	}
	return nil
}

func (s *Service) ListTrash() ([]model.File, error) {
	return s.repo.ListTrash()
}

func (s *Service) RestoreFile(id string) error {
	return s.repo.WithTx(func(r *repository.Repository) error {
		return restoreCascade(r, id)
	})
}

// RestoreAll memulihkan seluruh isi trash.
func (s *Service) RestoreAll() error {
	return s.repo.WithTx(func(r *repository.Repository) error {
		trash, err := r.ListTrash()
		if err != nil {
			return err
		}
		for _, f := range trash {
			if f.DeletedAt != nil {
				if err := restoreCascade(r, f.ID); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// EmptyTrash menghapus permanen seluruh isi trash. File di Telegram hanya
// dihapus jika tidak ada referensi lain yang masih memakainya.
func (s *Service) EmptyTrash() error {
	return s.repo.WithTx(func(r *repository.Repository) error {
		trash, err := r.ListTrash()
		if err != nil {
			return err
		}
		inTrash := make(map[string]bool)
		for _, f := range trash {
			inTrash[f.ID] = true
		}
		for _, f := range trash {
			// Lewati item yang masih punya parent di trash (akan ikut
			// terhapus bersama parent-nya).
			if f.ParentID != nil && inTrash[*f.ParentID] {
				continue
			}
			if err := s.permanentDeleteCascade(r, f.ID); err != nil {
				return err
			}
		}
		return nil
	})
}

func restoreCascade(r *repository.Repository, id string) error {
	f, err := r.GetFileAny(id)
	if err != nil {
		return err
	}
	used := collectUsedNames(r, f.ParentID, id)
	f.Name = uniqueNameFromUsed(used, f.Name)
	f.UpdatedAt = time.Now().Unix()
	if err := r.UpdateFile(f); err != nil {
		return err
	}
	if err := r.RestoreFile(id); err != nil {
		return err
	}
	if f.IsFolder {
		children, err := r.ListFilesAny(&id)
		if err != nil {
			return err
		}
		for _, child := range children {
			if child.DeletedAt != nil {
				if err := restoreCascade(r, child.ID); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (s *Service) PermanentDelete(id string) error {
	return s.repo.WithTx(func(r *repository.Repository) error {
		return s.permanentDeleteCascade(r, id)
	})
}

func (s *Service) permanentDeleteCascade(r *repository.Repository, id string) error {
	f, err := r.GetFileAny(id)
	if err != nil {
		return err
	}
	if f.IsFolder {
		children, err := r.ListFilesAny(&id)
		if err != nil {
			return err
		}
		for _, child := range children {
			if err := s.permanentDeleteCascade(r, child.ID); err != nil {
				return err
			}
		}
	}
	if f.FileID != nil && f.MessageID != nil {
		// Hapus pesan Telegram hanya jika ini referensi terakhir (tidak ada
		// baris lain, termasuk hasil copy atau yang ada di trash, yang masih
		// memakai file_id yang sama).
		n, err := r.CountByFileID(*f.FileID)
		if err == nil && n == 1 {
			if chatID, cerr := s.chatID(); cerr == nil {
				if derr := s.telegram.DeleteMessage(chatID, *f.MessageID); derr != nil {
					log.Printf("failed to delete telegram message %d: %v", *f.MessageID, derr)
				}
			}
		}
	}
	s.removeThumbCache(f.FileID)
	return r.PermanentDelete(id)
}

func (s *Service) RevokeShareLink(id string) error {
	if _, err := s.repo.GetFile(id); err != nil {
		return err
	}
	return s.repo.RevokeShareLink(id)
}

func (s *Service) CopyFiles(ids []string, targetID *string) error {
	return s.repo.WithTx(func(r *repository.Repository) error {
		if err := validateTarget(r, targetID); err != nil {
			return err
		}
		for _, id := range ids {
			if err := copySingleRecursive(r, id, targetID); err != nil {
				return err
			}
		}
		return nil
	})
}

func copySingleRecursive(r *repository.Repository, id string, targetID *string) error {
	f, err := r.GetFile(id)
	if err != nil {
		return err
	}
	return copyRecursive(r, f, targetID, collectUsedNames(r, targetID, f.ID))
}

func copyRecursive(r *repository.Repository, f *model.File, targetID *string, used map[string]bool) error {
	newID, err := generateID()
	if err != nil {
		return err
	}
	now := time.Now().Unix()

	newFile := &model.File{
		ID:        newID,
		Name:      f.Name,
		ParentID:  targetID,
		IsFolder:  f.IsFolder,
		FileID:    f.FileID,
		MessageID: f.MessageID,
		MimeType:  f.MimeType,
		Size:      f.Size,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := createFileWithUniqueName(r, newFile, used); err != nil {
		return err
	}

	if f.IsFolder {
		children, err := r.ListFiles(&f.ID)
		if err != nil {
			return err
		}
		childUsed := map[string]bool{}
		for _, child := range children {
			if err := copyRecursive(r, &child, &newFile.ID, childUsed); err != nil {
				return err
			}
		}
	}

	return nil
}

func collectUsedNames(r *repository.Repository, parentID *string, excludeID string) map[string]bool {
	existing, err := r.ListFiles(parentID)
	if err != nil {
		return map[string]bool{}
	}
	used := make(map[string]bool, len(existing))
	for _, e := range existing {
		if e.ID != excludeID {
			used[e.Name] = true
		}
	}
	return used
}

func getUniqueNameExcluding(r *repository.Repository, name string, parentID *string, excludeID string) string {
	return uniqueNameFromUsed(collectUsedNames(r, parentID, excludeID), name)
}

func uniqueNameFromUsed(used map[string]bool, name string) string {
	if !used[name] {
		return name
	}

	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)

	i := 1
	for {
		candidate := fmt.Sprintf("%s (%d)%s", base, i, ext)
		if !used[candidate] {
			return candidate
		}
		i++
	}
}

// createFileWithUniqueName menyisipkan file dengan nama unik di parent-nya.
// Jika konflik nama terjadi (termasuk race konkuren yang dicegat oleh unique
// index), nama diberi suffix dan insert diulang secara deterministik.
func createFileWithUniqueName(r *repository.Repository, f *model.File, used map[string]bool) error {
	base := f.Name
	ext := filepath.Ext(base)
	stem := strings.TrimSuffix(base, ext)
	f.Name = uniqueNameFromUsed(used, base)
	used[f.Name] = true

	for attempt := 0; attempt < 100; attempt++ {
		if err := r.CreateFile(f); err == nil {
			return nil
		} else if !repository.IsUniqueConstraint(err) {
			return err
		}
		n := 1
		for {
			candidate := fmt.Sprintf("%s (%d)%s", stem, n, ext)
			if candidate != f.Name && !used[candidate] {
				f.Name = candidate
				used[candidate] = true
				break
			}
			n++
		}
	}
	return errors.New("tidak bisa membuat nama file unik")
}

func (s *Service) MoveFiles(ids []string, targetID *string) error {
	return s.repo.WithTx(func(r *repository.Repository) error {
		if err := validateTarget(r, targetID); err != nil {
			return err
		}
		for _, id := range ids {
			f, err := r.GetFile(id)
			if err != nil {
				return err
			}
			if targetID != nil && f.IsFolder {
				isDesc, err := isDescendant(r, *targetID, id)
				if err != nil {
					return err
				}
				if isDesc {
					return fmt.Errorf("tidak bisa memindahkan folder ke dalam dirinya sendiri")
				}
			}

			sameParent := (f.ParentID == nil && targetID == nil) ||
				(f.ParentID != nil && targetID != nil && *f.ParentID == *targetID)
			if !sameParent {
				f.Name = getUniqueNameExcluding(r, f.Name, targetID, id)
			}
			f.ParentID = targetID
			f.UpdatedAt = time.Now().Unix()
			if err := r.UpdateFile(f); err != nil {
				return err
			}
		}
		return nil
	})
}

func validateTarget(r *repository.Repository, targetID *string) error {
	if targetID == nil {
		return nil
	}
	tf, err := r.GetFile(*targetID)
	if err != nil {
		return errors.New("folder tujuan tidak ditemukan")
	}
	if !tf.IsFolder {
		return errors.New("target bukan folder")
	}
	return nil
}

func isDescendant(r *repository.Repository, candidateID, ancestorID string) (bool, error) {
	seen := make(map[string]bool)
	curr := candidateID
	for curr != "" && curr != ancestorID {
		if seen[curr] {
			return false, nil
		}
		seen[curr] = true
		f, err := r.GetFile(curr)
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

func generateID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func generateToken() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
