package handlers

import (
	"encoding/json"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
)

func strPtr(s string) *string { return &s }

// TestBuildQuestionPayloadPgMulti memastikan correctAnswer untuk pg_multi
// disimpan sebagai array TEKS pilihan benar (bukan ID), agar konsisten dengan
// jawaban yang dikirim siswa dan grader.
func TestBuildQuestionPayloadPgMulti(t *testing.T) {
	options := `[{"id":"1","text":"Jakarta","isCorrect":true},{"id":"2","text":"Bandung","isCorrect":false},{"id":"3","text":"Surabaya","isCorrect":true}]`
	req := &models.CreateQuestionRequest{
		Type:    "pg_multi",
		Options: strPtr(options),
	}

	p := buildQuestionPayload(req)

	var texts []string
	if err := json.Unmarshal([]byte(p.CorrectAnswer), &texts); err != nil {
		t.Fatalf("correctAnswer bukan JSON array: %v (raw=%q)", err, p.CorrectAnswer)
	}
	want := map[string]bool{"Jakarta": true, "Surabaya": true}
	if len(texts) != 2 {
		t.Fatalf("jumlah jawaban benar = %d, want 2 (%v)", len(texts), texts)
	}
	for _, s := range texts {
		if !want[s] {
			t.Errorf("jawaban benar tak terduga: %q (harus teks, bukan ID)", s)
		}
	}
}

func TestBuildQuestionPayloadPgSingle(t *testing.T) {
	options := `[{"id":"1","text":"Jakarta","isCorrect":true},{"id":"2","text":"Bandung","isCorrect":false}]`
	req := &models.CreateQuestionRequest{Type: "pg_single", Options: strPtr(options)}

	p := buildQuestionPayload(req)
	if p.CorrectAnswer != "Jakarta" {
		t.Errorf("pg_single correctAnswer = %q, want %q", p.CorrectAnswer, "Jakarta")
	}
}

// TestBuildQuestionPayloadLegacyOptions memastikan format lama "A|B|C" tetap
// dinormalisasi menjadi JSON options.
func TestBuildQuestionPayloadLegacyOptions(t *testing.T) {
	req := &models.CreateQuestionRequest{
		Type:          "pg_single",
		Options:       strPtr("Jakarta|Bandung|Surabaya"),
		CorrectAnswer: strPtr("Bandung"),
	}

	p := buildQuestionPayload(req)

	var opts []models.QuestionOption
	if err := json.Unmarshal([]byte(p.Options), &opts); err != nil {
		t.Fatalf("options bukan JSON array: %v (raw=%q)", err, p.Options)
	}
	if len(opts) != 3 {
		t.Fatalf("jumlah opsi = %d, want 3", len(opts))
	}
	if !opts[1].IsCorrect || opts[1].Text != "Bandung" {
		t.Errorf("opsi benar salah: %+v", opts[1])
	}
	if p.CorrectAnswer != "Bandung" {
		t.Errorf("correctAnswer = %q, want Bandung", p.CorrectAnswer)
	}
}

func TestBuildQuestionPayloadFillBlank(t *testing.T) {
	req := &models.CreateQuestionRequest{
		Type:          "fill_blank",
		CorrectAnswer: strPtr("Jakarta|DKI Jakarta"),
	}
	p := buildQuestionPayload(req)

	var accepts []string
	if err := json.Unmarshal([]byte(p.CorrectAnswer), &accepts); err != nil {
		t.Fatalf("fill_blank correctAnswer bukan JSON array: %v", err)
	}
	if len(accepts) != 2 {
		t.Errorf("fill_blank accepts = %v, want 2 item", accepts)
	}
}
