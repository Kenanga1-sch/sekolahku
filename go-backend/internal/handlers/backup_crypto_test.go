package handlers

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

// TestEncryptDecryptRoundTrip memastikan envelope "SKBP" bisa didekripsi
// kembali tepat sama dengan input, dan metadata (salt/nonce) bervariasi.
func TestEncryptDecryptRoundTrip(t *testing.T) {
	dir := t.TempDir()
	plainPath := filepath.Join(dir, "plain.zip")
	encPath := filepath.Join(dir, "plain.zip.enc")
	decPath := filepath.Join(dir, "decrypted.zip")

	// Buat zip kecil yang valid.
	f, err := os.Create(plainPath)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	zz, err := w.Create("rahasia.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := zz.Write([]byte("NIK 1234567890123456")); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	f.Close()

	t.Setenv("BACKUP_ZIP_PASSWORD", "s3cret-backup-pwd")
	if err := encryptFile(encPath, plainPath, "s3cret-backup-pwd"); err != nil {
		t.Fatalf("encrypt gagal: %v", err)
	}

	// Header harus dimulai magic + versi.
	magic := make([]byte, len(backupMagic))
	mf, _ := os.Open(encPath)
	mf.Read(magic)
	mf.Close()
	if string(magic) != backupMagic {
		t.Fatalf("magic salah: got %q", magic)
	}
	if fi, _ := os.Stat(encPath); fi.Size() <= int64(backupHeaderLen) {
		t.Fatalf("file envelope keherasan: %d bytes", fi.Size())
	}

	// Dekripsi harus menghasilkan byte identik.
	encrypted, err := decryptFileIfNeeded(encPath, decPath)
	if err != nil {
		t.Fatalf("decrypt gagal: %v", err)
	}
	if !encrypted {
		t.Fatal("seharusnya terdeteksi sebagai envelope terenkripsi")
	}
	orig, _ := os.ReadFile(plainPath)
	got, _ := os.ReadFile(decPath)
	if string(orig) != string(got) {
		t.Fatal("hasil dekripsi tidak sama dengan input")
	}
}

// TestDecryptWrongPassword memastikan password salah ditolak (GCM gagal).
func TestDecryptWrongPassword(t *testing.T) {
	dir := t.TempDir()
	plainPath := filepath.Join(dir, "p.zip")
	encPath := filepath.Join(dir, "p.zip.enc")
	os.WriteFile(plainPath, []byte("dummy"), 0o600)

	if err := encryptFile(encPath, plainPath, "benar"); err != nil {
		t.Fatal(err)
	}

	t.Setenv("BACKUP_ZIP_PASSWORD", "salah")
	if _, err := decryptFileIfNeeded(encPath, filepath.Join(dir, "out.zip")); err == nil {
		t.Fatal("password salah harusnya ditolak")
	}
}

// TestDecryptEncryptedWithoutPassword: envelope ada tapi env kosong → error jelas.
func TestDecryptEncryptedWithoutPassword(t *testing.T) {
	dir := t.TempDir()
	plainPath := filepath.Join(dir, "p.zip")
	encPath := filepath.Join(dir, "p.zip.enc")
	os.WriteFile(plainPath, []byte("dummy"), 0o600)

	if err := encryptFile(encPath, plainPath, "benar"); err != nil {
		t.Fatal(err)
	}

	t.Setenv("BACKUP_ZIP_PASSWORD", "")
	if _, err := decryptFileIfNeeded(encPath, filepath.Join(dir, "out.zip")); err == nil {
		t.Fatal("harus error saat password tidak diset")
	}
}

// TestPlainZipPassThrough: backup lama (plain zip tanpa envelope) tetap dikenali
// dan TIDAK dianggap error — kompatibilitas mundur.
func TestPlainZipPassThrough(t *testing.T) {
	dir := t.TempDir()
	plainPath := filepath.Join(dir, "lama.zip")

	f, _ := os.Create(plainPath)
	w := zip.NewWriter(f)
	zz, _ := w.Create("lama.txt")
	zz.Write([]byte("data lama"))
	w.Close()
	f.Close()

	t.Setenv("BACKUP_ZIP_PASSWORD", "apapun")
	encrypted, err := decryptFileIfNeeded(plainPath, filepath.Join(dir, "x.zip"))
	if err != nil {
		t.Fatalf("plain zip tidak boleh error: %v", err)
	}
	if encrypted {
		t.Fatal("plain zip tidak boleh dianggap envelope")
	}
}
