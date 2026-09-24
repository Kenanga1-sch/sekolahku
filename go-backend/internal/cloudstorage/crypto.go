package cloudstorage

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
)

// EncryptBlob mengenkripsi data dengan AES-256-GCM. Key adalah 64 karakter hex
// (32 byte). Nonce (12 byte) ditempatkan di awal ciphertext.
//
// Bila key kosong, data dikembalikan apa adanya (enkripsi nonaktif).
func EncryptBlob(plaintext []byte, key string) ([]byte, error) {
	if key == "" {
		return plaintext, nil
	}
	keyBytes, err := hex.DecodeString(key)
	if err != nil {
		return nil, fmt.Errorf("CLOUDSTORAGE_ENCRYPTION_KEY harus hex: %w", err)
	}
	if len(keyBytes) != 32 {
		return nil, fmt.Errorf("CLOUDSTORAGE_ENCRYPTION_KEY harus 32 byte (64 hex)")
	}
	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

// DecryptBlob membalikkan EncryptBlob.
func DecryptBlob(ciphertext []byte, key string) ([]byte, error) {
	if key == "" {
		return ciphertext, nil
	}
	keyBytes, err := hex.DecodeString(key)
	if err != nil {
		return nil, fmt.Errorf("CLOUDSTORAGE_ENCRYPTION_KEY harus hex: %w", err)
	}
	if len(keyBytes) != 32 {
		return nil, fmt.Errorf("CLOUDSTORAGE_ENCRYPTION_KEY harus 32 byte (64 hex)")
	}
	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(ciphertext) < ns {
		return nil, fmt.Errorf("ciphertext terlalu pendek")
	}
	nonce, data := ciphertext[:ns], ciphertext[ns:]
	return gcm.Open(nil, nonce, data, nil)
}
