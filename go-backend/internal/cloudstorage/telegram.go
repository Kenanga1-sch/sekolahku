package cloudstorage

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// TelegramAPI adalah abstraksi klien Telegram Bot API agar mudah di-mock.
type TelegramAPI interface {
	// SendDocument mengunggah file dan mengembalikan file_id, message_id, size.
	SendDocument(ctx context.Context, r io.Reader, filename, chatID string) (string, int64, int64, error)
	// CopyMessage menyalin pesan (dan file di dalamnya) tanpa mengunggah ulang.
	CopyMessage(ctx context.Context, fromChatID string, messageID int64, toChatID string) (int64, error)
	// GetFilePath mengembalikan file_path internal Telegram untuk sebuah file_id.
	GetFilePath(ctx context.Context, fileID string) (string, error)
	// DownloadStream mengambil isi file; rangeHeader opsional untuk HTTP Range.
	DownloadStream(ctx context.Context, filePath, rangeHeader string) (*http.Response, error)
	// DeleteMessage menghapus pesan (dan file) dari chat.
	DeleteMessage(ctx context.Context, chatID string, messageID int64) error
}

// TelegramClient mengimplementasikan TelegramAPI di atas net/http.
//
// Mendukung Bot API server lokal (mis. http://host.containers.internal:8081)
// maupun api.telegram.org publik. Konfigurasi apiURL menentukan tujuannya.
//
// Dalam mode --local, server menyimpan berkas di disk dan getFile
// mengembalikan path absolut (mis. /var/lib/telegram-bot-api/<token>/documents/x).
// Endpoint /file/ pada sebagian build server tidak melayani berkas lokal,
// sehingga berkas dibaca langsung dari disk melalui localFileRoot (dir server
// yang di-mount ke container ini).
type TelegramClient struct {
	apiURL        string
	token         string
	client        *http.Client
	localFileRoot string
	remotePrefix  string
}

// NewTelegramClient membuat klien dari token & base URL Bot API.
//
// localFileRoot: direktori (di dalam container) tempat berkas server lokal
// di-mount, mis. "/app/telegram-data". remotePrefix: prefix path yang
// dikembalikan getFile pada server lokal, mis. "/var/lib/telegram-bot-api".
// Bila localFileRoot kosong, berkas selalu diambil lewat HTTP /file/.
func NewTelegramClient(token, apiURL, localFileRoot, remotePrefix string) *TelegramClient {
	if strings.TrimSpace(apiURL) == "" {
		apiURL = "https://api.telegram.org"
	}
	if strings.TrimSpace(remotePrefix) == "" {
		remotePrefix = "/var/lib/telegram-bot-api"
	}
	return &TelegramClient{
		apiURL:        strings.TrimRight(apiURL, "/"),
		token:         token,
		localFileRoot: strings.TrimRight(localFileRoot, "/"),
		remotePrefix:  strings.TrimRight(remotePrefix, "/"),
		client: &http.Client{
			// Timeout per-operasi ditangani via context; klien tidak di-timeout
			// global agar upload/download besar tidak terpotong.
			Transport: &http.Transport{
				MaxIdleConns:        10,
				IdleConnTimeout:     90 * time.Second,
				DisableCompression:  true,
				MaxIdleConnsPerHost: 4,
			},
		},
	}
}

type tgResponse struct {
	OK          bool            `json:"ok"`
	Description string          `json:"description"`
	ErrorCode   int             `json:"error_code"`
	Result      json.RawMessage `json:"result"`
}

type tgDocumentResult struct {
	MessageID int64 `json:"message_id"`
	Document  struct {
		FileID   string `json:"file_id"`
		FileSize int64  `json:"file_size"`
	} `json:"document"`
}

type tgMessageResult struct {
	MessageID int64 `json:"message_id"`
}

type tgFileResult struct {
	FileID   string `json:"file_id"`
	FilePath string `json:"file_path"`
	FileSize int64  `json:"file_size"`
}

// doJSON mengeksekusi request dan mendekode respons JSON Telegram, dengan retry
// untuk rate limit (429) menggunakan Retry-After bila tersedia.
func (c *TelegramClient) doJSON(ctx context.Context, req *http.Request, out interface{}) error {
	const maxAttempts = 4
	baseDelay := 500 * time.Millisecond

	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		resp, err := c.client.Do(req.WithContext(ctx))
		if err != nil {
			return err
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			delay := baseDelay
			if ra := resp.Header.Get("Retry-After"); ra != "" {
				if n, perr := strconv.Atoi(ra); perr == nil && n > 0 {
					delay = time.Duration(n) * time.Second
				}
			}
			_ = drainAndClose(resp.Body)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
			lastErr = fmt.Errorf("telegram rate limited (429)")
			continue
		}

		body, rerr := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		_ = resp.Body.Close()
		if rerr != nil {
			return rerr
		}

		var parsed tgResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			return fmt.Errorf("telegram: respons tidak valid (HTTP %d): %s", resp.StatusCode, truncate(string(body), 200))
		}
		if !parsed.OK {
			desc := parsed.Description
			if desc == "" {
				desc = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
			return fmt.Errorf("telegram: %s", desc)
		}
		if out != nil {
			if err := json.Unmarshal(parsed.Result, out); err != nil {
				return fmt.Errorf("telegram: gagal membaca result: %w", err)
			}
		}
		return nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("telegram: gagal setelah %d percobaan", maxAttempts)
	}
	return lastErr
}

// SendDocument mengunggah file secara streaming (io.Pipe + multipart) sehingga
// tidak perlu menampung seluruh berkas di memori.
func (c *TelegramClient) SendDocument(ctx context.Context, r io.Reader, filename, chatID string) (string, int64, int64, error) {
	if chatID == "" {
		return "", 0, 0, fmt.Errorf("cloudstorage: chat_id belum dikonfigurasi")
	}

	pr, pw := io.Pipe()
	mw := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		part, err := mw.CreateFormFile("document", filename)
		if err != nil {
			pw.CloseWithError(err)
			return
		}
		if _, err := io.Copy(part, r); err != nil {
			pw.CloseWithError(err)
			return
		}
		if err := mw.WriteField("chat_id", chatID); err != nil {
			pw.CloseWithError(err)
			return
		}
		_ = mw.Close()
	}()

	endpoint := fmt.Sprintf("%s/bot%s/sendDocument", c.apiURL, c.token)
	req, err := http.NewRequest(http.MethodPost, endpoint, pr)
	if err != nil {
		return "", 0, 0, err
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())

	var res tgDocumentResult
	if err := c.doJSON(ctx, req, &res); err != nil {
		return "", 0, 0, err
	}
	return res.Document.FileID, res.Document.FileSize, res.MessageID, nil
}

// CopyMessage menyalin pesan server-side (tanpa re-upload) ke chat tujuan.
func (c *TelegramClient) CopyMessage(ctx context.Context, fromChatID string, messageID int64, toChatID string) (int64, error) {
	form := url.Values{}
	form.Set("chat_id", toChatID)
	form.Set("from_chat_id", fromChatID)
	form.Set("message_id", strconv.FormatInt(messageID, 10))

	endpoint := fmt.Sprintf("%s/bot%s/copyMessage", c.apiURL, c.token)
	req, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	var res tgMessageResult
	if err := c.doJSON(ctx, req, &res); err != nil {
		return 0, err
	}
	return res.MessageID, nil
}

// GetFilePath meminta path internal Telegram untuk file_id.
func (c *TelegramClient) GetFilePath(ctx context.Context, fileID string) (string, error) {
	endpoint := fmt.Sprintf("%s/bot%s/getFile?file_id=%s", c.apiURL, c.token, url.QueryEscape(fileID))
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	var res tgFileResult
	if err := c.doJSON(ctx, req, &res); err != nil {
		return "", err
	}
	if res.FilePath == "" {
		return "", fmt.Errorf("telegram: file_path kosong")
	}
	return res.FilePath, nil
}

// DownloadStream membuka stream file dari Bot API. rangeHeader opsional
// ("bytes=start-end") untuk seek video/audio.
//
// Pada server lokal (mode --local), filePath adalah path absolut di disk
// server. Bila localFileRoot dikonfigurasi, berkas dibaca langsung dari disk
// (endpoint /file/ pada sebagian build server tidak melayani berkas lokal).
func (c *TelegramClient) DownloadStream(ctx context.Context, filePath, rangeHeader string) (*http.Response, error) {
	if c.localFileRoot != "" && strings.HasPrefix(filePath, c.remotePrefix) {
		return c.openLocalFile(filePath, rangeHeader)
	}

	endpoint := fmt.Sprintf("%s/file/bot%s/%s", c.apiURL, c.token, filePath)
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	resp, err := c.client.Do(req.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		defer resp.Body.Close()
		return nil, fmt.Errorf("telegram: unduh gagal (HTTP %d)", resp.StatusCode)
	}
	return resp, nil
}

// openLocalFile membaca berkas server lokal langsung dari disk dan mengemasnya
// sebagai *http.Response agar antarmuka DownloadStream tetap seragam.
// Mendukung header Range sederhana (bytes=start-end / bytes=start- / bytes=-n).
func (c *TelegramClient) openLocalFile(absPath, rangeHeader string) (*http.Response, error) {
	rel := strings.TrimPrefix(absPath, c.remotePrefix)
	rel = strings.TrimPrefix(rel, "/")
	if rel == "" || strings.Contains(rel, "..") {
		return nil, fmt.Errorf("telegram: path berkas lokal tidak valid")
	}
	full := filepath.Join(c.localFileRoot, filepath.FromSlash(rel))

	f, err := os.Open(full)
	if err != nil {
		return nil, err
	}
	stat, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	size := stat.Size()

	header := http.Header{}
	header.Set("Accept-Ranges", "bytes")
	header.Set("Content-Type", "application/octet-stream")
	status := http.StatusOK

	if rangeHeader != "" {
		start, end, ok := parseSimpleRange(rangeHeader, size)
		if ok {
			if _, err := f.Seek(start, io.SeekStart); err != nil {
				f.Close()
				return nil, err
			}
			length := end - start + 1
			header.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, size))
			header.Set("Content-Length", strconv.FormatInt(length, 10))
			status = http.StatusPartialContent
			return &http.Response{
				StatusCode:    status,
				Header:        header,
				Body:          io.NopCloser(io.LimitReader(f, length)),
				ContentLength: length,
			}, nil
		}
	}

	header.Set("Content-Length", strconv.FormatInt(size, 10))
	return &http.Response{
		StatusCode:    status,
		Header:        header,
		Body:          f,
		ContentLength: size,
	}, nil
}

// parseSimpleRange mengurai header Range "bytes=start-end" menjadi indeks byte
// inklusif. Mengembalikan ok=false bila format tak didukung.
func parseSimpleRange(rangeHeader string, size int64) (int64, int64, bool) {
	spec := strings.TrimPrefix(rangeHeader, "bytes=")
	parts := strings.SplitN(spec, "-", 2)
	if len(parts) != 2 {
		return 0, 0, false
	}
	startStr := strings.TrimSpace(parts[0])
	endStr := strings.TrimSpace(parts[1])
	if startStr == "" {
		// suffix range: bytes=-N
		n, err := strconv.ParseInt(endStr, 10, 64)
		if err != nil || n <= 0 {
			return 0, 0, false
		}
		start := size - n
		if start < 0 {
			start = 0
		}
		return start, size - 1, true
	}
	start, err := strconv.ParseInt(startStr, 10, 64)
	if err != nil || start < 0 || start >= size {
		return 0, 0, false
	}
	end := size - 1
	if endStr != "" {
		if e, err := strconv.ParseInt(endStr, 10, 64); err == nil && e < size {
			end = e
		}
	}
	if end < start {
		return 0, 0, false
	}
	return start, end, true
}

// DeleteMessage menghapus pesan beserta file dari chat.
func (c *TelegramClient) DeleteMessage(ctx context.Context, chatID string, messageID int64) error {
	form := url.Values{}
	form.Set("chat_id", chatID)
	form.Set("message_id", strconv.FormatInt(messageID, 10))

	endpoint := fmt.Sprintf("%s/bot%s/deleteMessage", c.apiURL, c.token)
	req, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return c.doJSON(ctx, req, nil)
}

func drainAndClose(rc io.ReadCloser) error {
	if rc == nil {
		return nil
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(rc, 4<<10))
	return rc.Close()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
