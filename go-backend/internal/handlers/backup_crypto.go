package handlers

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"os"

	"golang.org/x/crypto/scrypt"
)

// Format file backup terenkripsi ("backup envelope"):
//
//	"SKBP"            4 byte magic
//	 0x01             1 byte versi
//	 salt             32 byte salt scrypt
//	 nonce            12 byte nonce AES-GCM
//	 ciphertext       sisa file
//
// Kunci diturunkan dari BACKUP_ZIP_PASSWORD lewat scrypt (N=2^15, r=8, p=1).
// AES-256-GCM memberi keamanan + integritas: file tidak bisa diam-diam diubah
// tanpa password. Backup lama (plain zip) tetap dikenali di RestoreBackup.

const (
	backupMagic     = "SKBP"
	backupVersion   = 1
	backupSaltLen   = 32
	backupNonceLen  = 12
	backupKeyLen    = 32
	backupHeaderLen = len(backupMagic) + 1 + backupSaltLen + backupNonceLen
)

func backupPassword() string {
	return os.Getenv("BACKUP_ZIP_PASSWORD")
}

// BackupEncryptionEnabled melaporkan apakah password backup sudah dikonfigurasi.
// Dipakai oleh GetSettings agar admin tahu backup yang dikirim sudah terenkripsi
// atau belum — password itu sendiri TIDAK pernah dibocorkan ke response.
func BackupEncryptionEnabled() bool {
	return backupPassword() != ""
}

// deriveKey menurunkan kunci AES-256 dari password + salt memakai scrypt.
func deriveKey(password string, salt []byte) ([]byte, error) {
	return scrypt.Key([]byte(password), salt, 1<<15, 8, 1, backupKeyLen)
}

// encryptFile mengenkripsi srcPath ke dstPath. Password wajib tidak kosong.
func encryptFile(dstPath, srcPath, password string) error {
	plain, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("gagal membaca file plain: %w", err)
	}

	salt := make([]byte, backupSaltLen)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return fmt.Errorf("gagal membuat salt: %w", err)
	}

	key, err := deriveKey(password, salt)
	if err != nil {
		return fmt.Errorf("gagal menurunkan kunci: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("gagal membuat cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("gagal membuat GCM: %w", err)
	}

	nonce := make([]byte, backupNonceLen)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return fmt.Errorf("gagal membuat nonce: %w", err)
	}

	// Header: magic + versi + salt + nonce, lalu ciphertext menyerang.
	header := make([]byte, 0, backupHeaderLen+len(plain)+16)
	header = append(header, []byte(backupMagic)...)
	header = append(header, backupVersion)
	header = append(header, salt...)
	header = append(header, nonce...)

	ciphertext := gcm.Seal(header, nonce, plain, nil)

	return os.WriteFile(dstPath, ciphertext, 0o600)
}

// decryptFile memeriksa srcPath: bila ber-encryption envelope, mendekripsi ke
// dstPath dan mengembalikan (true, nil); bila plain zip, mengembalikan
// (false, nil) tanpa menyentuh dstPath.
func decryptFileIfNeeded(srcPath, dstPath string) (bool, error) {
	f, err := os.Open(srcPath)
	if err != nil {
		return false, fmt.Errorf("gagal membuka file backup: %w", err)
	}
	defer f.Close()

	magic := make([]byte, len(backupMagic))
	if _, err := io.ReadFull(f, magic); err != nil {
		return false, nil // file terlalu pendek / bukan envelope
	}
	if string(magic) != backupMagic {
		return false, nil // plain zip lama
	}

	password := backupPassword()
	if password == "" {
		return false, errors.New("backup terenkripsi tetapi BACKUP_ZIP_PASSWORD tidak diset di server — tidak bisa memulihkan")
	}

	// Baca sisa header: versi + salt + nonce.
	rest := make([]byte, backupHeaderLen-len(backupMagic))
	if _, err := io.ReadFull(f, rest); err != nil {
		return false, fmt.Errorf("header envelope tidak utuh: %w", err)
	}
	if rest[0] != backupVersion {
		return false, fmt.Errorf("versi envelope %d tidak didukung", rest[0])
	}
	salt := rest[1 : 1+backupSaltLen]
	nonce := rest[1+backupSaltLen:]

	ciphertext, err := io.ReadAll(f)
	if err != nil {
		return false, fmt.Errorf("gagal membaca ciphertext: %w", err)
	}

	key, err := deriveKey(password, salt)
	if err != nil {
		return false, fmt.Errorf("gagal menurunkan kunci: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return false, fmt.Errorf("gagal membuat cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return false, fmt.Errorf("gagal membuat GCM: %w", err)
	}

	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return false, errors.New("password backup salah atau file rusak (otentikasi GCM gagal)")
	}

	if err := os.WriteFile(dstPath, plain, 0o600); err != nil {
		return false, fmt.Errorf("gagal menulis zip hasil dekripsi: %w", err)
	}
	return true, nil
}
