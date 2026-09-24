package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
)

// Encrypt encrypts plaintext using AES-GCM with the provided key.
// Returns ciphertext with nonce prepended (nonce + ciphertext).
func Encrypt(plaintext []byte, key string) ([]byte, error) {
	if key == "" {
		return plaintext, nil
	}
	keyBytes, err := hex.DecodeString(key)
	if err != nil {
		return nil, errors.New("invalid encryption key: must be hex-encoded")
	}
	if len(keyBytes) != 32 {
		return nil, errors.New("encryption key must be 32 bytes (64 hex characters)")
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

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// Decrypt decrypts ciphertext using AES-GCM with the provided key.
// Expects nonce prepended (nonce + ciphertext).
func Decrypt(ciphertext []byte, key string) ([]byte, error) {
	if key == "" {
		return ciphertext, nil
	}
	if len(ciphertext) == 0 {
		return ciphertext, nil
	}
	keyBytes, err := hex.DecodeString(key)
	if err != nil {
		return nil, errors.New("invalid encryption key: must be hex-encoded")
	}
	if len(keyBytes) != 32 {
		return nil, errors.New("encryption key must be 32 bytes (64 hex characters)")
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce := ciphertext[:nonceSize]
	ciphertext = ciphertext[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("decryption failed: " + err.Error())
	}
	return plaintext, nil
}