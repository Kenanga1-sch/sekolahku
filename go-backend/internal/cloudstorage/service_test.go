package cloudstorage

import (
	"bytes"
	"context"
	"database/sql"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync/atomic"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/sekolahku/go-backend/internal/repository"
)

// fakeTG adalah TelegramAPI in-memory untuk pengujian.
type fakeTG struct {
	nextID  int64
	store   map[string][]byte
	msgs    map[int64]string // message_id → file_id
	deleted map[int64]bool
}

func newFakeTG() *fakeTG {
	return &fakeTG{store: map[string][]byte{}, msgs: map[int64]string{}, deleted: map[int64]bool{}}
}

func (f *fakeTG) SendDocument(ctx context.Context, r io.Reader, filename, chatID string) (string, int64, int64, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return "", 0, 0, err
	}
	id := atomic.AddInt64(&f.nextID, 1)
	fileID := "file-" + strconv.FormatInt(id, 10)
	messageID := id
	f.store[fileID] = data
	f.msgs[messageID] = fileID
	return fileID, int64(len(data)), messageID, nil
}

func (f *fakeTG) CopyMessage(ctx context.Context, fromChatID string, messageID int64, toChatID string) (int64, error) {
	fid, ok := f.msgs[messageID]
	if !ok {
		return 0, io.EOF
	}
	newID := atomic.AddInt64(&f.nextID, 1)
	f.msgs[newID] = fid
	return newID, nil
}

func (f *fakeTG) GetFilePath(ctx context.Context, fileID string) (string, error) {
	if _, ok := f.store[fileID]; !ok {
		return "", sql.ErrNoRows
	}
	return fileID, nil
}

func (f *fakeTG) DownloadStream(ctx context.Context, filePath, rangeHeader string) (*http.Response, error) {
	data, ok := f.store[filePath]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return &http.Response{
		StatusCode:    http.StatusOK,
		Body:          io.NopCloser(bytes.NewReader(data)),
		ContentLength: int64(len(data)),
		Header:        http.Header{"Content-Type": {"application/octet-stream"}},
	}, nil
}

func (f *fakeTG) DeleteMessage(ctx context.Context, chatID string, messageID int64) error {
	f.deleted[messageID] = true
	return nil
}

func setupService(t *testing.T) (*Service, *repository.CloudStorageRepository, *fakeTG) {
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
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	repo := repository.NewCloudStorageRepository(db)
	tg := newFakeTG()
	svc := NewService(repo, tg, Config{BotToken: "t", ChatID: "c", MaxUploadBytes: 100 << 20})
	return svc, repo, tg
}

func makeFileHeader(t *testing.T, name, content string) (multipart.File, *multipart.FileHeader) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("file", name)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := fw.Write([]byte(content)); err != nil {
		t.Fatalf("write: %v", err)
	}
	mw.Close()

	mr := multipart.NewReader(&buf, mw.Boundary())
	form, err := mr.ReadForm(1 << 20)
	if err != nil {
		t.Fatalf("read form: %v", err)
	}
	fhs := form.File["file"]
	src, err := fhs[0].Open()
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	return src, fhs[0]
}

func TestServiceUploadAndDownload(t *testing.T) {
	svc, _, _ := setupService(t)
	src, fh := makeFileHeader(t, "scan.pdf", "hello-cloud")

	f, err := svc.Upload(context.Background(), "userA", src, fh, nil)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	if f.FileID == nil || f.Size != int64(len("hello-cloud")) {
		t.Fatalf("metadata salah: %+v", f)
	}

	res, err := svc.OpenStream(context.Background(), f, "")
	if err != nil {
		t.Fatalf("open stream: %v", err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	if string(data) != "hello-cloud" || res.Size != int64(len("hello-cloud")) {
		t.Fatalf("isi tidak cocok: %q size=%d", data, res.Size)
	}
}

func TestServiceOwnerIsolationUpload(t *testing.T) {
	svc, repo, _ := setupService(t)
	src, fh := makeFileHeader(t, "rahasia.pdf", "A")
	if _, err := svc.Upload(context.Background(), "userA", src, fh, nil); err != nil {
		t.Fatalf("upload: %v", err)
	}
	files, err := repo.ListFiles("userB", nil, 0, 0)
	if err != nil {
		t.Fatalf("list B: %v", err)
	}
	if len(files) != 0 {
		t.Fatalf("userB melihat %d file userA", len(files))
	}
}

func TestServiceDuplicateNameGetsSuffix(t *testing.T) {
	svc, _, _ := setupService(t)
	for i := 0; i < 2; i++ {
		src, fh := makeFileHeader(t, "sama.pdf", "X")
		if _, err := svc.Upload(context.Background(), "u", src, fh, nil); err != nil {
			t.Fatalf("upload %d: %v", i, err)
		}
	}
	files, _, err := svc.List("u", nil, 0, 0)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	names := map[string]bool{}
	for _, f := range files {
		names[f.Name] = true
	}
	if !names["sama.pdf"] || !names["sama (1).pdf"] {
		t.Fatalf("suffix nama tidak benar: %v", names)
	}
}

func TestServiceCopyRecursiveAndTrash(t *testing.T) {
	svc, _, tg := setupService(t)
	ctx := context.Background()

	folder, err := svc.CreateFolder("u", "Dokumen", nil)
	if err != nil {
		t.Fatalf("create folder: %v", err)
	}
	src, fh := makeFileHeader(t, "isi.txt", "data")
	if _, err := svc.Upload(ctx, "u", src, fh, &folder.ID); err != nil {
		t.Fatalf("upload: %v", err)
	}

	// Copy folder ke root → harus menghasilkan salinan rekursif.
	if err := svc.Copy(ctx, "u", []string{folder.ID}, nil); err != nil {
		t.Fatalf("copy: %v", err)
	}
	root, _, _ := svc.List("u", nil, 0, 0)
	if len(root) != 2 { // folder asli + salinan
		t.Fatalf("root seharusnya 2 folder, dapat %d", len(root))
	}

	// Trash folder asli → isinya ikut ter-trash.
	if err := svc.Trash("u", folder.ID); err != nil {
		t.Fatalf("trash: %v", err)
	}
	trash, _ := svc.ListTrash("u")
	if len(trash) != 2 { // folder + isi
		t.Fatalf("trash seharusnya 2 item, dapat %d", len(trash))
	}

	// Empty trash → file Telegram dihapus.
	if err := svc.EmptyTrash(ctx, "u"); err != nil {
		t.Fatalf("empty trash: %v", err)
	}
	trash, _ = svc.ListTrash("u")
	if len(trash) != 0 {
		t.Fatalf("trash belum kosong: %d", len(trash))
	}
	_ = tg
}

func TestServiceShareLifecycle(t *testing.T) {
	svc, _, _ := setupService(t)
	ctx := context.Background()
	src, fh := makeFileHeader(t, "bagi.pdf", "x")
	f, err := svc.Upload(ctx, "u", src, fh, nil)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	token, err := svc.CreateShare("u", f.ID, 0)
	if err != nil || token == "" {
		t.Fatalf("create share: token=%q err=%v", token, err)
	}
	got, err := svc.GetSharedFile(token)
	if err != nil || got.ID != f.ID {
		t.Fatalf("get shared: %v", err)
	}
	if err := svc.RevokeShare("u", f.ID); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	if _, err := svc.GetSharedFile(token); err == nil {
		t.Fatal("token seharusnya tidak valid setelah revoke")
	}
}

func TestEncryptDecryptRoundtrip(t *testing.T) {
	key := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	plain := []byte("dokumen rahasia")
	enc, err := EncryptBlob(plain, key)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if bytes.Equal(enc, plain) {
		t.Fatal("data tidak terenkripsi")
	}
	dec, err := DecryptBlob(enc, key)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if !bytes.Equal(dec, plain) {
		t.Fatalf("hasil dekripsi tidak cocok: %q", dec)
	}
}

func TestTelegramLocalFileRead(t *testing.T) {
	dir := t.TempDir()
	// Simulasikan struktur: <root>/<token>/documents/file.txt
	if err := os.MkdirAll(filepath.Join(dir, "123:ABC", "documents"), 0o755); err != nil {
		t.Fatal(err)
	}
	content := []byte("abcdefghij")
	if err := os.WriteFile(filepath.Join(dir, "123:ABC", "documents", "file.txt"), content, 0o644); err != nil {
		t.Fatal(err)
	}

	c := NewTelegramClient("123:ABC", "http://unused", dir, "/var/lib/telegram-bot-api")

	// Full read.
	resp, err := c.DownloadStream(context.Background(), "/var/lib/telegram-bot-api/123:ABC/documents/file.txt", "")
	if err != nil {
		t.Fatalf("download: %v", err)
	}
	got, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if string(got) != "abcdefghij" {
		t.Fatalf("isi salah: %q", got)
	}
	if resp.ContentLength != 10 {
		t.Fatalf("content-length: %d", resp.ContentLength)
	}

	// Range read bytes=2-5 → "cdef".
	resp, err = c.DownloadStream(context.Background(), "/var/lib/telegram-bot-api/123:ABC/documents/file.txt", "bytes=2-5")
	if err != nil {
		t.Fatalf("range download: %v", err)
	}
	got, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	if string(got) != "cdef" {
		t.Fatalf("range isi salah: %q", got)
	}
	if resp.StatusCode != http.StatusPartialContent {
		t.Fatalf("status bukan 206: %d", resp.StatusCode)
	}
	if cr := resp.Header.Get("Content-Range"); cr != "bytes 2-5/10" {
		t.Fatalf("content-range salah: %q", cr)
	}
}

func TestTelegramLocalFileRejectsTraversal(t *testing.T) {
	dir := t.TempDir()
	c := NewTelegramClient("123:ABC", "http://unused", dir, "/var/lib/telegram-bot-api")
	if _, err := c.DownloadStream(context.Background(), "/var/lib/telegram-bot-api/../etc/passwd", ""); err == nil {
		t.Fatal("path traversal seharusnya ditolak")
	}
}
