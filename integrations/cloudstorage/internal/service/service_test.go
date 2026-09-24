package service

import (
	"bytes"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"testing"
	"time"

	"cloudstorage/internal/config"
	"cloudstorage/internal/model"
	"cloudstorage/internal/repository"
)

type mockTelegram struct {
	deleted []int64
}

func (m *mockTelegram) UploadFile(reader io.Reader, filename string, chatID string, size int64) (string, int64, int64, error) {
	return "file_id_mock", size, 42, nil
}

func (m *mockTelegram) DeleteMessage(chatID string, messageID int64) error {
	m.deleted = append(m.deleted, messageID)
	return nil
}

func (m *mockTelegram) DownloadFile(fileID string) (io.ReadCloser, error) {
	return nil, errors.New("not implemented")
}

func (m *mockTelegram) DownloadFileWithRange(fileID, rangeHeader string) (*http.Response, error) {
	return nil, errors.New("not implemented")
}

type readerCloser struct {
	*bytes.Reader
}

func (readerCloser) Close() error { return nil }

func setupService(t *testing.T) *Service {
	t.Helper()
	svc, _ := setupServiceWithMock(t)
	return svc
}

func setupServiceWithMock(t *testing.T) (*Service, *mockTelegram) {
	t.Helper()
	tmpFile, err := os.CreateTemp("", "svc_test_*.db")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	t.Cleanup(func() { os.Remove(tmpPath) })

	db := repository.InitDB(tmpPath)
	repo := repository.NewRepository(db)
	mock := &mockTelegram{}
	return NewServiceWithTelegram(repo, &config.Config{TelegramChatID: "123"}, mock), mock
}

func createTestFile(t *testing.T, svc *Service, name string, isFolder bool, parentID *string) *model.File {
	t.Helper()
	if isFolder {
		f, err := svc.CreateFolder(name, parentID)
		if err != nil {
			t.Fatalf("failed to create folder: %v", err)
		}
		return f
	}
	id, err := generateID()
	if err != nil {
		t.Fatalf("failed to generate id: %v", err)
	}
	now := time.Now().Unix()
	f := &model.File{
		ID:        id,
		Name:      name,
		ParentID:  parentID,
		IsFolder:  false,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := svc.repo.CreateFile(f); err != nil {
		t.Fatalf("failed to create file: %v", err)
	}
	return f
}

func TestCopyFiles_RecursiveFolder(t *testing.T) {
	svc := setupService(t)

	srcFolder := createTestFile(t, svc, "folder", true, nil)
	createTestFile(t, svc, "a.txt", false, &srcFolder.ID)
	createTestFile(t, svc, "b.txt", false, &srcFolder.ID)

	destFolder := createTestFile(t, svc, "dest", true, nil)

	if err := svc.CopyFiles([]string{srcFolder.ID}, &destFolder.ID); err != nil {
		t.Fatalf("failed to copy files: %v", err)
	}

	destChildren, err := svc.repo.ListFiles(&destFolder.ID)
	if err != nil {
		t.Fatalf("failed to list dest children: %v", err)
	}
	if len(destChildren) != 1 {
		t.Fatalf("expected 1 copied folder in dest, got %d", len(destChildren))
	}

	copiedFolder := destChildren[0]
	if copiedFolder.Name != "folder" {
		t.Errorf("expected folder name 'folder', got %s", copiedFolder.Name)
	}
	if !copiedFolder.IsFolder {
		t.Errorf("expected copied item to be a folder")
	}

	copiedChildren, err := svc.repo.ListFiles(&copiedFolder.ID)
	if err != nil {
		t.Fatalf("failed to list copied folder children: %v", err)
	}
	if len(copiedChildren) != 2 {
		t.Errorf("expected 2 children in copied folder, got %d", len(copiedChildren))
	}
}

func TestMoveFiles_IntoOwnDescendantRejected(t *testing.T) {
	svc := setupService(t)

	folderA := createTestFile(t, svc, "A", true, nil)
	folderB := createTestFile(t, svc, "B", true, &folderA.ID)
	createTestFile(t, svc, "x.txt", false, &folderB.ID)

	if err := svc.MoveFiles([]string{folderA.ID}, &folderB.ID); err == nil {
		t.Fatalf("expected error when moving folder into own descendant")
	}

	got, err := svc.repo.GetFile(folderA.ID)
	if err != nil {
		t.Fatalf("failed to get folder A: %v", err)
	}
	if got.ParentID != nil {
		t.Errorf("expected parent still nil, got %s", *got.ParentID)
	}
}

func TestDeleteRestorePermanent_Cascade(t *testing.T) {
	svc := setupService(t)

	folder := createTestFile(t, svc, "folder", true, nil)
	child := createTestFile(t, svc, "a.txt", false, &folder.ID)

	if err := svc.DeleteFile(folder.ID); err != nil {
		t.Fatalf("failed to delete folder: %v", err)
	}

	trash, err := svc.repo.ListTrash()
	if err != nil {
		t.Fatalf("failed to list trash: %v", err)
	}
	trashIDs := map[string]bool{}
	for _, f := range trash {
		trashIDs[f.ID] = true
	}
	if !trashIDs[folder.ID] {
		t.Errorf("expected folder in trash")
	}
	if !trashIDs[child.ID] {
		t.Errorf("expected child in trash (cascade), got %v", trashIDs)
	}

	if err := svc.RestoreFile(folder.ID); err != nil {
		t.Fatalf("failed to restore folder: %v", err)
	}
	children, err := svc.repo.ListFiles(&folder.ID)
	if err != nil {
		t.Fatalf("failed to list children: %v", err)
	}
	if len(children) != 1 || children[0].ID != child.ID {
		t.Errorf("expected child restored with folder, got %+v", children)
	}

	if err := svc.DeleteFile(folder.ID); err != nil {
		t.Fatalf("failed to delete folder again: %v", err)
	}
	if err := svc.PermanentDelete(folder.ID); err != nil {
		t.Fatalf("failed to permanent delete folder: %v", err)
	}
	if _, err := svc.repo.GetFileAny(child.ID); err == nil {
		t.Errorf("expected child row removed after cascade permanent delete")
	}
}

func TestCopyFiles_DuplicateNameSuffix(t *testing.T) {
	svc := setupService(t)

	src := createTestFile(t, svc, "doc.pdf", false, nil)

	if err := svc.CopyFiles([]string{src.ID}, nil); err != nil {
		t.Fatalf("failed to copy files: %v", err)
	}
	if err := svc.CopyFiles([]string{src.ID}, nil); err != nil {
		t.Fatalf("failed to copy files (2nd): %v", err)
	}

	files, err := svc.repo.ListFiles(nil)
	if err != nil {
		t.Fatalf("failed to list files: %v", err)
	}

	names := map[string]bool{}
	for _, f := range files {
		names[f.Name] = true
	}
	if !names["doc.pdf"] {
		t.Errorf("expected original doc.pdf to exist")
	}
	if !names["doc (1).pdf"] {
		t.Errorf("expected copy to be named 'doc (1).pdf', got names %v", names)
	}
}

func createTestFileWithTelegram(t *testing.T, svc *Service, name string, parentID *string, fileID string, messageID int64) *model.File {
	t.Helper()
	id, err := generateID()
	if err != nil {
		t.Fatalf("failed to generate id: %v", err)
	}
	now := time.Now().Unix()
	f := &model.File{
		ID:        id,
		Name:      name,
		ParentID:  parentID,
		IsFolder:  false,
		FileID:    &fileID,
		MessageID: &messageID,
		MimeType:  "application/octet-stream",
		Size:      10,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := svc.repo.CreateFile(f); err != nil {
		t.Fatalf("failed to create file: %v", err)
	}
	return f
}

func TestPermanentDelete_KeepsTelegramMessageWhenCopyExists(t *testing.T) {
	svc, mock := setupServiceWithMock(t)

	orig := createTestFileWithTelegram(t, svc, "a.txt", nil, "fid-1", 111)

	dest := createTestFile(t, svc, "dest", true, nil)
	if err := svc.CopyFiles([]string{orig.ID}, &dest.ID); err != nil {
		t.Fatalf("failed to copy: %v", err)
	}

	if err := svc.PermanentDelete(orig.ID); err != nil {
		t.Fatalf("failed to permanent delete original: %v", err)
	}

	if len(mock.deleted) != 0 {
		t.Errorf("expected telegram deleteMessage NOT called while copy exists, got %v", mock.deleted)
	}

	copies, err := svc.repo.ListFiles(&dest.ID)
	if err != nil {
		t.Fatalf("failed to list dest children: %v", err)
	}
	if len(copies) != 1 {
		t.Fatalf("expected 1 copy left, got %d", len(copies))
	}

	if err := svc.PermanentDelete(copies[0].ID); err != nil {
		t.Fatalf("failed to permanent delete copy: %v", err)
	}
	if len(mock.deleted) != 1 || mock.deleted[0] != 111 {
		t.Errorf("expected deleteMessage called once with 111 after last reference, got %v", mock.deleted)
	}
}

func TestPermanentDelete_CallsTelegramWhenLastReference(t *testing.T) {
	svc, mock := setupServiceWithMock(t)

	f := createTestFileWithTelegram(t, svc, "a.txt", nil, "fid-2", 222)
	if err := svc.PermanentDelete(f.ID); err != nil {
		t.Fatalf("failed to permanent delete: %v", err)
	}
	if len(mock.deleted) != 1 || mock.deleted[0] != 222 {
		t.Errorf("expected deleteMessage called with 222, got %v", mock.deleted)
	}
}

func TestPermanentDelete_SkipsDeleteWhenReferenceInTrash(t *testing.T) {
	svc, mock := setupServiceWithMock(t)

	orig := createTestFileWithTelegram(t, svc, "a.txt", nil, "fid-3", 333)

	dest := createTestFile(t, svc, "dest", true, nil)
	if err := svc.CopyFiles([]string{orig.ID}, &dest.ID); err != nil {
		t.Fatalf("failed to copy: %v", err)
	}

	if err := svc.DeleteFile(orig.ID); err != nil {
		t.Fatalf("failed to soft delete original: %v", err)
	}
	if err := svc.PermanentDelete(orig.ID); err != nil {
		t.Fatalf("failed to permanent delete original: %v", err)
	}
	if len(mock.deleted) != 0 {
		t.Errorf("expected deleteMessage NOT called while copy (active) exists, got %v", mock.deleted)
	}
}

func TestMoveFiles_RejectsNonFolderTarget(t *testing.T) {
	svc := setupService(t)

	fileA := createTestFile(t, svc, "a.txt", false, nil)
	fileB := createTestFile(t, svc, "b.txt", false, nil)

	if err := svc.MoveFiles([]string{fileA.ID}, &fileB.ID); err == nil {
		t.Fatalf("expected error when moving into a non-folder target")
	}
}

func TestMoveFiles_RejectsMissingTarget(t *testing.T) {
	svc := setupService(t)

	fileA := createTestFile(t, svc, "a.txt", false, nil)
	missing := "does-not-exist"
	if err := svc.MoveFiles([]string{fileA.ID}, &missing); err == nil {
		t.Fatalf("expected error when moving into a missing target")
	}
}

func TestMoveFiles_ResolvesNameConflict(t *testing.T) {
	svc := setupService(t)

	fileA := createTestFile(t, svc, "a.txt", false, nil)
	folder := createTestFile(t, svc, "folder", true, nil)
	createTestFile(t, svc, "a.txt", false, &folder.ID)

	if err := svc.MoveFiles([]string{fileA.ID}, &folder.ID); err != nil {
		t.Fatalf("failed to move: %v", err)
	}

	children, err := svc.repo.ListFiles(&folder.ID)
	if err != nil {
		t.Fatalf("failed to list children: %v", err)
	}
	names := map[string]bool{}
	for _, f := range children {
		names[f.Name] = true
	}
	if !names["a.txt"] {
		t.Errorf("expected original a.txt in target")
	}
	if !names["a (1).txt"] {
		t.Errorf("expected moved file renamed to 'a (1).txt', got %v", names)
	}
}

func TestUploadFile_ResolvesNameConflict(t *testing.T) {
	svc, _ := setupServiceWithMock(t)

	createTestFile(t, svc, "upload.pdf", false, nil)

	header := &multipart.FileHeader{
		Filename: "upload.pdf",
		Header:   make(textproto.MIMEHeader),
		Size:     10,
	}
	f, err := svc.UploadFile(readerCloser{bytes.NewReader([]byte("hello"))}, header, nil)
	if err != nil {
		t.Fatalf("failed to upload: %v", err)
	}
	if f.Name != "upload (1).pdf" {
		t.Errorf("expected uploaded file named 'upload (1).pdf', got %s", f.Name)
	}
}

func TestRenameFile_RejectsDuplicateSiblingName(t *testing.T) {
	svc := setupService(t)

	a := createTestFile(t, svc, "a.txt", false, nil)
	createTestFile(t, svc, "b.txt", false, nil)

	if _, err := svc.RenameFile(a.ID, "b.txt"); err == nil {
		t.Fatalf("expected error renaming to existing sibling name")
	}
	got, err := svc.repo.GetFile(a.ID)
	if err != nil {
		t.Fatalf("failed to get file: %v", err)
	}
	if got.Name != "a.txt" {
		t.Errorf("expected name unchanged, got %s", got.Name)
	}
}

func TestRestore_ResolvesNameConflict(t *testing.T) {
	svc := setupService(t)

	first := createTestFile(t, svc, "doc.pdf", false, nil)
	dup := createTestFile(t, svc, "dup.pdf", false, nil)

	if err := svc.DeleteFile(first.ID); err != nil {
		t.Fatalf("failed to delete: %v", err)
	}
	if _, err := svc.RenameFile(dup.ID, "doc.pdf"); err != nil {
		t.Fatalf("failed to rename dup: %v", err)
	}

	if err := svc.RestoreFile(first.ID); err != nil {
		t.Fatalf("failed to restore: %v", err)
	}

	restored, err := svc.repo.GetFile(first.ID)
	if err != nil {
		t.Fatalf("failed to get restored file: %v", err)
	}
	if restored.Name != "doc (1).pdf" {
		t.Errorf("expected restored file renamed to 'doc (1).pdf', got %s", restored.Name)
	}
}

func setupServiceWithConfig(t *testing.T, cfg *config.Config) *Service {
	t.Helper()
	tmpFile, err := os.CreateTemp("", "svc_test_*.db")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	t.Cleanup(func() { os.Remove(tmpPath) })

	db := repository.InitDB(tmpPath)
	repo := repository.NewRepository(db)
	return NewServiceWithTelegram(repo, cfg, &mockTelegram{})
}

func TestShareLink_NoExpiryByDefault(t *testing.T) {
	svc := setupServiceWithConfig(t, &config.Config{TelegramChatID: "123"})
	f, err := svc.CreateFolder("f", nil)
	if err != nil {
		t.Fatalf("failed to create folder: %v", err)
	}
	if _, err := svc.CreateShareLink(f.ID); err != nil {
		t.Fatalf("failed to create share: %v", err)
	}
	got, err := svc.repo.GetFile(f.ID)
	if err != nil {
		t.Fatalf("failed to get file: %v", err)
	}
	if got.ShareExpiresAt != nil {
		t.Errorf("expected no expiry when ShareExpiryDays=0, got %v", *got.ShareExpiresAt)
	}
}

func TestShareLink_ExpiredIsRejectedAndRevoked(t *testing.T) {
	svc := setupServiceWithConfig(t, &config.Config{TelegramChatID: "123", ShareExpiryDays: 1})
	f, err := svc.CreateFolder("f", nil)
	if err != nil {
		t.Fatalf("failed to create folder: %v", err)
	}
	if _, err := svc.CreateShareLink(f.ID); err != nil {
		t.Fatalf("failed to create share: %v", err)
	}

	got, err := svc.repo.GetFile(f.ID)
	if err != nil {
		t.Fatalf("failed to get file: %v", err)
	}
	if got.ShareExpiresAt == nil {
		t.Fatal("expected expiry set when ShareExpiryDays>0")
	}

	expired := time.Now().Unix() - 10
	got.ShareExpiresAt = &expired
	got.UpdatedAt = time.Now().Unix()
	if err := svc.repo.UpdateFile(got); err != nil {
		t.Fatalf("failed to update file: %v", err)
	}

	if _, err := svc.GetSharedFile(*got.ShareToken); err == nil {
		t.Fatal("expected expired share to be rejected")
	}

	after, err := svc.repo.GetFile(f.ID)
	if err != nil {
		t.Fatalf("failed to get file: %v", err)
	}
	if after.ShareToken != nil {
		t.Errorf("expected share token revoked after expiry")
	}
}
