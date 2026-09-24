package telegram

import (
	"context"
	"crypto/aes"
	"crypto/rand"
	"crypto/cipher"
	"encoding/json"
	"fmt"
	"io"
	math "math/rand"
	"mime/multipart"
	"net/http"
	"net/url"
	"time"
)

const (
	// Rate limit handling untuk Telegram API
	maxRetries       = 3
	retryBaseDelay   = 500 * time.Millisecond
	retryJitter      = 200 * time.Millisecond
	defaultTimeout   = 60 * time.Second
	downloadTimeout  = 30 * time.Minute
)

// Client struct
type Client struct {
	apiURL string
	token  string
	client *http.Client
}

// NewClient creates a new Telegram API client
func NewClient(token string, apiURL string) *Client {
	if apiURL == "" {
		apiURL = "https://api.telegram.org"
	}
	return &Client{
		apiURL: apiURL,
		token:  token,
		client: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

// doAPICall melakukan request ke Telegram API dengan handling rate limit (429)
// dan exponential backoff dengan jitter. Mengembalikan response dan error jika gagal.
func (c *Client) doAPICall(req *http.Request) (*http.Response, error) {
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Cek untuk rate limit (429 Too Many Requests)
	if resp.StatusCode == 429 {
		// Baca header Retry-After jika ada
		retryAfter := resp.Header.Get("Retry-After")
		delay := retryBaseDelay
		if retryAfter != "" {
			if n, err := parseInt(retryAfter); err == nil {
				delay = time.Duration(n) * time.Second
			}
		}

		// Add jitter to prevent thundering herd
		// gunakan math/math.Intn untuk delay tambahan
		jitter := time.Duration(retryJitter) * time.Millisecond * time.Duration(mathRandIntn(2))
		totalDelay := delay + jitter
		time.Sleep(totalDelay)

		// Retry with exponential backoff
		for attempt := 1; attempt < maxRetries; attempt++ {
			backoff := retryBaseDelay * time.Duration(attempt)
			jitter := time.Duration(retryJitter) * time.Millisecond * time.Duration(mathRandIntn(2))
			totalBackoff := backoff + jitter
			time.Sleep(totalBackoff)

			// Resend the same request
			resp2, err2 := c.client.Do(req)
			if err2 != nil {
				resp.Body.Close()
				return nil, err2
			}
			resp2.Body.Close()

			if resp2.StatusCode != 429 {
				resp = resp2
				break
			}
			// Continue loop for another retry
		}
	}

	return resp, nil
}

// mathRandIntn helper - menggunakan math/math.Intn
func mathRandIntn(n int) int {
	return math.Intn(n)
}

// parseInt mencoba parsing string ke integer
func parseInt(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}

// --- Document/Message Types ---

type SendDocumentResponse struct {
	OK      bool             `json:"ok"`
	Error   string           `json:"description"`
	Result  SendDocumentResult `json:"result"`
}

type SendDocumentResult struct {
	Document Document `json:"document"`
	MessageID int64 `json:"message_id"`
}

type Document struct {
	FileID   string `json:"file_id"`
	Size     int64  `json:"file_size"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Duration int    `json:"duration"`
}

type GetFileResponse struct {
	OK      bool `json:"ok"`
	Result  struct {
		FileID    string `json:"file_id"`
		FilePath  string `json:"file_path"`
		FileSize  int64  `json:"file_size"`
	} `json:"result"`
	Error bool `json:"error"`
}

type Message struct {
	MessageID int64  `json:"message_id"`
	From      From   `json:"from"`
	Date      int64  `json:"date"`
	Chat      Chat   `json:"chat"`
	Document  Document `json:"document"`
	Caption   string `json:"caption"`
}

type From struct {
	ID        int64  `json:"id"`
	isBot     bool   `json:"isBot"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	UserName  string `json:"username"`
}

type Chat struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	UserName  string `json:"username"`
	Type      string `json:"type"`
}

type Photo struct {
	FileID   string `json:"file_id"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	FileSize int64  `json:"file_size"`
	Thumb    string `json:"thumb"`
}

// --- File Upload ---

func (c *Client) UploadFile(reader io.Reader, filename string, chatID string, size int64) (string, int64, int64, error) {
	url := fmt.Sprintf("%s/bot%s/sendDocument", c.apiURL, c.token)

	pr, pw := io.Pipe()
	writer := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer writer.Close()
		part, err := writer.CreateFormFile("document", filename)
		if err != nil {
			pw.CloseWithError(err)
			return
		}
		if _, err := io.Copy(part, reader); err != nil {
			pw.CloseWithError(err)
			return
		}
		if err := writer.WriteField("chat_id", chatID); err != nil {
			pw.CloseWithError(err)
			return
		}
	}()

	req, err := http.NewRequest("POST", url, pr)
	if err != nil {
		return "", 0, 0, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := doAPICall(req)
	if err != nil {
		return "", 0, 0, err
	}
	defer resp.Body.Close()

	var result SendDocumentResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", 0, 0, err
	}
	if !result.OK {
		return "", 0, 0, fmt.Errorf("telegram error: %s", result.Error)
	}

	return result.Result.Document.FileID, result.Result.Document.Size, int64(result.Result.MessageID), nil
}

// --- Message Deletion ---

func (c *Client) DeleteMessage(chatID string, messageID int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	url := fmt.Sprintf("%s/bot%s/deleteMessage", c.apiURL, c.token)

	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return err
	}
	q := req.URL.Query()
	q.Set("chat_id", chatID)
	q.Set("message_id", fmt.Sprintf("%d", messageID))
	req.URL.RawQuery = q.Encode()

	resp, err := doAPICall(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result struct {
		OK      bool `json:"ok"`
		Error string `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	if !result.OK {
		return fmt.Errorf("telegram error: %s", result.Error)
	}

	return nil
}

// --- File Operations ---

func (c *Client) GetFile(fileID string) (string, int64, error) {
	filePath, _, err := c.getFileOnce(fileID)
	if err == nil {
		return filePath, 0, nil
	}
	// Retry once for temporary network errors
	time.Sleep(500 * time.Millisecond)
	filePath, size, err := c.getFileOnce(fileID)
	if err != nil {
		return "", 0, err
	}
	return filePath, size, nil
}

func (c *Client) getFileOnce(fileID string) (string, int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	u := fmt.Sprintf("%s/bot%s/getFile?file_id=%s", c.apiURL, c.token, url.QueryEscape(fileID))

	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return "", 0, err
	}

	resp, err := doAPICall(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	var result GetFileResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", 0, err
	}
	if !result.OK {
		return "", 0, fmt.Errorf("telegram error: %s", result.Error)
	}

	filePath := fmt.Sprintf("%s/file/bot%s/%s", c.apiURL, c.token, result.Result.FilePath)
	return filePath, result.Result.FileSize, nil
}

// --- File Download ---

func (c *Client) DownloadFile(fileID string) (io.ReadCloser, error) {
	resp, err := c.DownloadFileWithRange(fileID, "")
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}

func (c *Client) DownloadFileWithRange(fileID, rangeHeader string) (*http.Response, error) {
	filePath, _, err := c.GetFile(fileID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), downloadTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", filePath, nil)
	if err != nil {
		return nil, err
	}
	if rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	resp, err := doAPICall(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		resp.Body.Close()
		return nil, fmt.Errorf("telegram download failed: HTTP %d", resp.StatusCode)
	}
	return resp, nil
}

// --- Encryption ---

// Encrypt mengenkripsikan plaintext menggunakan AES-GCM dengan kunci yang diberikan.
// Mengembalikan ciphertext dengan nonce yang ditempatkan di awal (nonce + ciphertext).
func Encrypt(plaintext []byte, key string) ([]byte, error) {
	if key == "" {
		return plaintext, nil
	}
	keyBytes, err := hex.DecodeString(key)
	if err != nil {
		return nil, fmt.Errorf("invalid encryption key: must be hex-encoded")
	}
	if len(keyBytes) != 32 {
		return nil, fmt.Errorf("encryption key must be 32 bytes (64 hex characters)")
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
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// Decrypt mendekripsikan ciphertext menggunakan AES-GCM dengan kunci yang diberikan.
// Menyetapkan nonce yang ditempatkan di awal (nonce + ciphertext).
func Decrypt(ciphertext []byte, key string) ([]byte, error) {
	if key == "" {
		return ciphertext, nil
	}
	if len(ciphertext) == 0 {
		return ciphertext, nil
	}
	keyBytes, err := hex.DecodeString(key)
	if err != nil {
		return nil, fmt.Errorf("invalid encryption key: must be hex-encoded")
	}
	if len(keyBytes) != 32 {
		return nil, fmt.Errorf("encryption key must be 32 bytes (64 hex characters)")
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
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce := ciphertext[:nonceSize]
	ciphertext = ciphertext[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}
	return plaintext, nil
}
