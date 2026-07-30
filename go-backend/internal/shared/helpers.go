package shared

import (
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// ============ String Helpers ============

// StringPtr trims and returns a pointer to the string, or nil if empty.
func StringPtr(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

// OptionalString converts sql.NullString to *string.
func OptionalString(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	value := strings.TrimSpace(ns.String)
	if value == "" {
		return nil
	}
	return &value
}

// ============ Int Helpers ============

// IntPtr returns a pointer to the int value.
func IntPtr(v int) *int { return &v }

// ============ Time Helpers ============

// ParseDateOnly parses a date string (YYYY-MM-DD or RFC3339), returning nil if empty/unparseable.
func ParseDateOnly(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	if t, err := time.Parse("2006-01-02", value); err == nil {
		return &t
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return &t
	}
	return nil
}

// ParseOptionalDate parses a date string, returning error if format is invalid.
func ParseOptionalDate(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return &parsed, nil
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return &parsed, nil
	}
	return nil, fmt.Errorf("format tanggal tidak valid")
}

// TimeToUnixMilli converts *time.Time to Unix milliseconds for SQL params.
func TimeToUnixMilli(t *time.Time) interface{} {
	if t == nil || t.IsZero() {
		return nil
	}
	return t.UnixMilli()
}

// ============ Context Helpers ============

// CurrentUserID extracts the authenticated user ID from Echo context.
func CurrentUserID(c echo.Context) string {
	if v, ok := c.Get("user_id").(string); ok {
		return v
	}
	if v, ok := c.Get("userId").(string); ok {
		return v
	}
	return ""
}

// ============ Raw JSON Helpers ============

// RawString extracts a string value from a raw map, trying multiple keys.
func RawString(raw map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			switch v := value.(type) {
			case string:
				return v
			case float64:
				return fmt.Sprintf("%v", v)
			case bool:
				if v {
					return "true"
				}
				return "false"
			}
		}
	}
	return ""
}

// RawFloat extracts a float64 value from a raw map, trying multiple keys.
func RawFloat(raw map[string]interface{}, keys ...string) float64 {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			switch v := value.(type) {
			case float64:
				return v
			case string:
				var f float64
				fmt.Sscanf(v, "%f", &f)
				return f
			}
		}
	}
	return 0
}

// RawInt extracts an int value from a raw map, trying multiple keys.
func RawInt(raw map[string]interface{}, keys ...string) int {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			switch v := value.(type) {
			case float64:
				return int(v)
			case string:
				var i int
				fmt.Sscanf(v, "%d", &i)
				return i
			}
		}
	}
	return 0
}

// RawBool extracts a bool value from a raw map, trying multiple keys.
func RawBool(raw map[string]interface{}, keys ...string) bool {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			switch v := value.(type) {
			case bool:
				return v
			case float64:
				return v != 0
			case string:
				lower := strings.ToLower(strings.TrimSpace(v))
				return lower == "true" || lower == "1" || lower == "yes"
			}
		}
	}
	return false
}

// ============ File Upload Helpers ============

// CleanUploadName sanitizes a filename for safe storage.
func CleanUploadName(name string) string {
	name = filepath.Base(name)
	name = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '-'
	}, name)
	name = strings.Trim(name, ".-")
	if name == "" {
		return "dokumen.pdf"
	}
	return name
}

// SaveUploadedFile saves a form file to disk under the given subdirectory path.
// Returns the public URL path to the file.
func SaveUploadedFile(c echo.Context, formKey, subDir string, maxSizeMB int, allowedExts []string, required bool) (string, error) {
	file, err := c.FormFile(formKey)
	if err != nil {
		if required {
			return "", fmt.Errorf("file wajib diupload")
		}
		return "", nil
	}

	maxSize := int64(maxSizeMB) * 1024 * 1024
	if maxSize <= 0 {
		maxSize = 10 * 1024 * 1024
	}
	if file.Size > maxSize {
		return "", fmt.Errorf("ukuran file maksimal %dMB", maxSizeMB)
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if len(allowedExts) > 0 {
		allowed := false
		for _, ae := range allowedExts {
			if ext == "."+strings.TrimPrefix(strings.ToLower(ae), ".") {
				allowed = true
				break
			}
		}
		if !allowed {
			return "", fmt.Errorf("hanya file %s yang diperbolehkan", strings.Join(allowedExts, ", "))
		}
	}

	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	now := time.Now()
	uploadDir := filepath.Join("uploads", subDir, now.Format("2006"), now.Format("01"))
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", err
	}

	filename := fmt.Sprintf("%d-%s", now.UnixNano(), CleanUploadName(file.Filename))
	fullPath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		return "", err
	}

	return "/" + filepath.ToSlash(fullPath), nil
}