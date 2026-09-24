package repository

import (
	"os"
	"testing"
	"time"

	"cloudstorage/internal/model"
)

func TestRepository_CRUD(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "test_db_*.db")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	db := InitDB(tmpPath)
	repo := NewRepository(db)

	now := time.Now().Unix()
	f := &model.File{
		ID:        "test-id-1",
		Name:      "test.txt",
		IsFolder:  false,
		Size:      100,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := repo.CreateFile(f); err != nil {
		t.Fatalf("failed to create file: %v", err)
	}

	got, err := repo.GetFile("test-id-1")
	if err != nil {
		t.Fatalf("failed to get file: %v", err)
	}
	if got.Name != "test.txt" {
		t.Errorf("expected name test.txt, got %s", got.Name)
	}

	files, err := repo.ListFiles(nil)
	if err != nil {
		t.Fatalf("failed to list files: %v", err)
	}
	if len(files) != 1 {
		t.Errorf("expected 1 file, got %d", len(files))
	}

	if err := repo.SoftDelete("test-id-1", time.Now().Unix()); err != nil {
		t.Fatalf("failed to delete file: %v", err)
	}

	trash, err := repo.ListTrash()
	if err != nil {
		t.Fatalf("failed to list trash: %v", err)
	}
	if len(trash) != 1 {
		t.Errorf("expected 1 file in trash, got %d", len(trash))
	}

	if err := repo.RestoreFile("test-id-1"); err != nil {
		t.Fatalf("failed to restore file: %v", err)
	}

	if err := repo.PermanentDelete("test-id-1"); err != nil {
		t.Fatalf("failed to permanent delete file: %v", err)
	}
}
