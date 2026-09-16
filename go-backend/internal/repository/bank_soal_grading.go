package repository

import (
	"encoding/json"
	"strings"
)

// gradeAnswer menentukan benar/salah untuk satu soal berdasarkan tipe & jawaban.
// correctAnswer adalah JSON string (atau plain text) sesuai kontrak per tipe.
// studentAnswer adalah string jawaban dari frontend.
func gradeAnswer(questionType, correctAnswer, studentAnswer string) bool {
	if correctAnswer == "" || studentAnswer == "" {
		return false
	}
	student := strings.TrimSpace(studentAnswer)
	if student == "" {
		return false
	}

	switch questionType {
	case "pg_single":
		// correctAnswer = text dari 1 pilihan benar
		return strings.EqualFold(student, strings.TrimSpace(correctAnswer))

	case "pg_multi":
		// correctAnswer = JSON array id pilihan, mis. ["1","3"]
		var correctIDs []string
		if err := json.Unmarshal([]byte(correctAnswer), &correctIDs); err != nil {
			return false
		}
		var studentIDs []string
		if err := json.Unmarshal([]byte(student), &studentIDs); err != nil {
			return false
		}
		return stringSetEqual(correctIDs, studentIDs)

	case "true_false":
		return strings.EqualFold(student, strings.TrimSpace(correctAnswer))

	case "fill_blank":
		// correctAnswer = JSON array jawaban yang diterima
		var accepts []string
		if err := json.Unmarshal([]byte(correctAnswer), &accepts); err != nil {
			return false
		}
		for _, a := range accepts {
			if strings.EqualFold(student, strings.TrimSpace(a)) {
				return true
			}
		}
		return false

	case "matching", "pair_match":
		// correctAnswer = JSON object {"leftId": "rightId", ...}
		var correct map[string]string
		if err := json.Unmarshal([]byte(correctAnswer), &correct); err != nil {
			return false
		}
		var studentMap map[string]string
		if err := json.Unmarshal([]byte(student), &studentMap); err != nil {
			return false
		}
		if len(correct) != len(studentMap) {
			return false
		}
		for k, v := range correct {
			if studentMap[k] != v {
				return false
			}
		}
		return true

	case "essay":
		// Esai dinilai manual — otomatis dianggap belum benar (poin 0 sampai dikoreksi).
		return false

	default:
		return strings.EqualFold(student, correctAnswer)
	}
}

func stringSetEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	counts := map[string]int{}
	for _, v := range a {
		counts[v]++
	}
	for _, v := range b {
		counts[v]--
		if counts[v] < 0 {
			return false
		}
	}
	return true
}
