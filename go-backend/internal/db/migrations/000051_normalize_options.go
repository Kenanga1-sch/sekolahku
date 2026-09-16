package migrations

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

// MigrateNormalizeOptions mengubah options soal lama dari format "A|B|C|D"
// menjadi JSON [{id,text,isCorrect}] dengan correctAnswer diperbaiki sesuai tipe.
//
// Aturan:
//   - options sudah JSON array -> skip
//   - options NULL/kosong        -> skip
//   - options plain text         -> split "|", bangun JSON, update correctAnswer
func MigrateNormalizeOptions(db *sql.DB) error {
	rows, err := db.Query(`
		SELECT id, options, correct_answer, type
		FROM questions
		WHERE deleted_at IS NULL AND options IS NOT NULL AND TRIM(options) != ''
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type row struct {
		ID, Options, Correct, Type string
	}
	var pending []row

	for rows.Next() {
		var r row
		var opts, correct sql.NullString
		var qType sql.NullString
		if err := rows.Scan(&r.ID, &opts, &correct, &qType); err != nil {
			return err
		}
		r.Options = opts.String
		r.Correct = correct.String
		r.Type = qType.String
		pending = append(pending, r)
	}
	rows.Close()

	migrated := 0
	for _, r := range pending {
		trimmed := strings.TrimSpace(r.Options)
		if len(trimmed) > 0 && trimmed[0] == '[' {
			// Sudah JSON — skip.
			continue
		}

		parts := strings.Split(trimmed, "|")
		options := make([]map[string]interface{}, 0, len(parts))
		for i, p := range parts {
			text := strings.TrimSpace(p)
			if text == "" {
				continue
			}
			isCorrect := false
			if r.Correct != "" && strings.EqualFold(text, strings.TrimSpace(r.Correct)) {
				isCorrect = true
			}
			options = append(options, map[string]interface{}{
				"id":        fmt.Sprintf("%d", i+1),
				"text":      text,
				"isCorrect": isCorrect,
			})
		}

		if len(options) == 0 {
			continue
		}

		optsJSON, _ := json.Marshal(options)
		newCorrect := normalizeCorrectAnswer(r.Type, r.Correct, options)

		_, err := db.Exec(
			"UPDATE questions SET options = ?, correct_answer = ? WHERE id = ?",
			string(optsJSON), newCorrect, r.ID,
		)
		if err != nil {
			log.Printf("[migration 000051] skip %s: %v", r.ID, err)
			continue
		}
		migrated++
	}

	log.Printf("[migration 000051] normalized %d questions", migrated)
	return nil
}

// normalizeCorrectAnswer membangun ulang correctAnswer sesuai kontrak tipe baru.
func normalizeCorrectAnswer(qType, legacyCorrect string, options []map[string]interface{}) string {
	legacyCorrect = strings.TrimSpace(legacyCorrect)

	switch qType {
	case "pg_multi":
		ids := []string{}
		for _, o := range options {
			if ic, ok := o["isCorrect"].(bool); ok && ic {
				if id, ok := o["id"].(string); ok {
					ids = append(ids, id)
				}
			}
		}
		if len(ids) == 0 {
			return ""
		}
		b, _ := json.Marshal(ids)
		return string(b)

	case "fill_blank":
		if legacyCorrect == "" {
			return ""
		}
		list := []string{}
		for _, p := range strings.Split(legacyCorrect, "|") {
			if t := strings.TrimSpace(p); t != "" {
				list = append(list, t)
			}
		}
		if len(list) == 0 {
			return ""
		}
		b, _ := json.Marshal(list)
		return string(b)

	default:
		// pg_single/true_false/matching/essay: pakai text jawaban benar.
		return legacyCorrect
	}
}
