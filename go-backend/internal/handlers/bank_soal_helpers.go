package handlers

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/sekolahku/go-backend/internal/models"
)

// questionPayload adalah hasil normalisasi request soal sebelum masuk DB.
type questionPayload struct {
	Options       string // JSON string of []QuestionOption
	CorrectAnswer string // JSON string (atau plain text) sesuai tipe
}

// buildQuestionPayload menormalisasi options & correctAnswer dari request frontend.
//
// Frontend baru mengirim:
//   - options: JSON string dari []{id,text,isCorrect}
//   - correctAnswer: bisa kosong (dihitung dari options) atau diisi manual
//     (true_false / matching / fill_blank).
//
// Frontend lama (legacy) mengirim:
//   - options: "A|B|C|D"
//   - correctAnswer: text jawaban benar
//
// Output disesuaikan per tipe:
//   - pg_single     -> correctAnswer = text pilihan benar
//   - pg_multi      -> correctAnswer = JSON ["1","3"] (id pilihan benar)
//   - true_false    -> correctAnswer = "Benar"/"Salah"
//   - fill_blank    -> correctAnswer = JSON ["jawaban1","jawaban2"]
//   - matching      -> correctAnswer = JSON {"leftId":"rightId"}
//   - essay         -> correctAnswer = "" (grading manual)
func buildQuestionPayload(req *models.CreateQuestionRequest) questionPayload {
	var options []models.QuestionOption
	rawOpts := ""
	if req.Options != nil {
		rawOpts = strings.TrimSpace(*req.Options)
	}

	if rawOpts != "" {
		if err := json.Unmarshal([]byte(rawOpts), &options); err != nil {
			// Legacy format: "A|B|C|D"
			legacyCorrect := ""
			if req.CorrectAnswer != nil {
				legacyCorrect = strings.TrimSpace(*req.CorrectAnswer)
			}
			parts := strings.Split(rawOpts, "|")
			for i, p := range parts {
				isCorrect := false
				if legacyCorrect != "" && strings.EqualFold(strings.TrimSpace(p), legacyCorrect) {
					isCorrect = true
				}
				options = append(options, models.QuestionOption{
					ID:        fmt.Sprintf("%d", i+1),
					Text:      strings.TrimSpace(p),
					IsCorrect: isCorrect,
				})
			}
		}
	}

	optsJSON, _ := json.Marshal(options)

	var correct string
	switch req.Type {
	case "pg_single":
		for _, o := range options {
			if o.IsCorrect {
				correct = o.Text
				break
			}
		}
	case "pg_multi":
		ids := []string{}
		for _, o := range options {
			if o.IsCorrect {
				ids = append(ids, o.ID)
			}
		}
		if len(ids) > 0 {
			b, _ := json.Marshal(ids)
			correct = string(b)
		}
	case "true_false":
		if req.CorrectAnswer != nil {
			correct = strings.TrimSpace(*req.CorrectAnswer)
		}
	case "fill_blank":
		if req.CorrectAnswer != nil && strings.TrimSpace(*req.CorrectAnswer) != "" {
			list := []string{}
			for _, p := range strings.Split(*req.CorrectAnswer, "|") {
				if t := strings.TrimSpace(p); t != "" {
					list = append(list, t)
				}
			}
			if len(list) > 0 {
				b, _ := json.Marshal(list)
				correct = string(b)
			}
		}
	case "matching", "pair_match":
		if req.CorrectAnswer != nil {
			correct = strings.TrimSpace(*req.CorrectAnswer)
		}
	case "essay":
		// tidak ada correctAnswer otomatis
	}

	return questionPayload{
		Options:       string(optsJSON),
		CorrectAnswer: correct,
	}
}
