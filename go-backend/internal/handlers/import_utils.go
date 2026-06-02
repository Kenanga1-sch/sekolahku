package handlers

import (
	"fmt"
	"strings"
)

func importString(row map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		value, ok := row[key]
		if !ok || value == nil {
			continue
		}

		switch typed := value.(type) {
		case string:
			if trimmed := strings.TrimSpace(typed); trimmed != "" {
				return trimmed
			}
		case float64:
			return strings.TrimSpace(fmt.Sprintf("%.0f", typed))
		case float32:
			return strings.TrimSpace(fmt.Sprintf("%.0f", typed))
		case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
			return strings.TrimSpace(fmt.Sprint(typed))
		default:
			if trimmed := strings.TrimSpace(fmt.Sprint(typed)); trimmed != "" {
				return trimmed
			}
		}
	}

	return ""
}

func optionalImportStringPtr(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}
