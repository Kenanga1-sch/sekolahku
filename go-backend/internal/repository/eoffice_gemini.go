package repository

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type GeminiLetterExtractResult struct {
	OriginalNumber     string `json:"originalNumber"`
	Sender             string `json:"sender"`
	Subject            string `json:"subject"`
	DateOfLetter       string `json:"dateOfLetter"`
	ClassificationCode string `json:"classificationCode"`
	Notes              string `json:"notes"`
}

func (r *EOfficeRepository) AnalyzeIncomingLetterWithAI(fileBytes []byte, mimeType string, apiKey string) (*GeminiLetterExtractResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	base64Data := base64.StdEncoding.EncodeToString(fileBytes)

	prompt := `Anda adalah asisten AI kearsipan (E-Arsip) Sekolahku. Tugas Anda adalah menganalisis dokumen surat masuk (PDF atau gambar scan) yang dilampirkan dan mengekstrak informasi penting berikut ke dalam format JSON yang ditentukan:
1. originalNumber: Nomor surat resmi yang tertera pada kop surat atau awal surat (bukan nomor agenda sekolah kita). Jika tidak ada nomor surat yang tertera, kosongkan atau isi "-".
2. sender: Instansi, lembaga, organisasi, atau nama perorangan pengirim surat.
3. subject: Perihal atau hal pokok isi surat. Buat perihal yang ringkas dan jelas jika di surat perihalnya terlalu panjang.
4. dateOfLetter: Tanggal pembuatan surat dalam format YYYY-MM-DD. Cari tanggal yang tertera dekat pengirim atau bagian tanda tangan surat. Jika tidak ditemukan, default ke hari ini atau kosongkan.
5. classificationCode: Kode klasifikasi kearsipan surat dinas jika tertera, biasanya berupa angka desimal (seperti 421.1, 400.3, 055, dsb.).
6. notes: Ringkasan singkat atau catatan tambahan mengenai isi surat tersebut (1-2 kalimat).`

	reqBody := geminiRequestBody{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{
						InlineData: &geminiInlineData{
							MimeType: mimeType,
							Data:     base64Data,
						},
					},
					{
						Text: prompt,
					},
				},
			},
		},
		GenerationConfig: geminiGenConfig{
			ResponseMimeType: "application/json",
			ResponseSchema: &geminiSchema{
				Type: "OBJECT",
				Properties: map[string]*geminiSchemaProperty{
					"originalNumber": {
						Type:        "STRING",
						Description: "Nomor surat resmi yang tertera di surat asli",
					},
					"sender": {
						Type:        "STRING",
						Description: "Nama instansi pengirim surat",
					},
					"subject": {
						Type:        "STRING",
						Description: "Perihal/ringkasan isi surat",
					},
					"dateOfLetter": {
						Type:        "STRING",
						Description: "Tanggal surat dalam format YYYY-MM-DD",
					},
					"classificationCode": {
						Type:        "STRING",
						Description: "Kode klasifikasi surat dinas jika ada",
					},
					"notes": {
						Type:        "STRING",
						Description: "Catatan atau ringkasan isi surat",
					},
				},
				Required: []string{"originalNumber", "sender", "subject", "dateOfLetter"},
			},
		},
	}

	payloadBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request failed: %w", err)
	}

	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("create HTTP request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request execution failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errorPayload map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errorPayload)
		return nil, fmt.Errorf("Gemini API error (status %d): %v", resp.StatusCode, errorPayload)
	}

	type candidate struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	}
	type responsePayload struct {
		Candidates []candidate `json:"candidates"`
	}

	var resPayload responsePayload
	if err := json.NewDecoder(resp.Body).Decode(&resPayload); err != nil {
		return nil, fmt.Errorf("decode Gemini response failed: %w", err)
	}

	if len(resPayload.Candidates) == 0 || len(resPayload.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response candidate from Gemini")
	}

	responseText := resPayload.Candidates[0].Content.Parts[0].Text

	var result GeminiLetterExtractResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		return nil, fmt.Errorf("failed to parse Gemini output JSON: %w (raw output: %s)", err, responseText)
	}

	return &result, nil
}
