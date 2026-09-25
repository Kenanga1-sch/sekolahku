package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type GeminiClassifyResult struct {
	Category    string   `json:"category"`
	Shelf       string   `json:"shelf"`
	Reason      string   `json:"reason"`
	Description string   `json:"description"`
	Subjects    []string `json:"subjects"`
}

type geminiSchemaProperty struct {
	Type        string        `json:"type"`
	Enum        []string      `json:"enum,omitempty"`
	Description string        `json:"description,omitempty"`
	Items       *geminiSchema `json:"items,omitempty"`
}

type geminiSchema struct {
	Type       string                           `json:"type"`
	Properties map[string]*geminiSchemaProperty `json:"properties,omitempty"`
	Required   []string                         `json:"required,omitempty"`
}

type geminiGenConfig struct {
	ResponseMimeType string        `json:"responseMimeType"`
	ResponseSchema   *geminiSchema `json:"responseSchema"`
	Temperature      float64       `json:"temperature"`
	TopP             float64       `json:"topP"`
}

type geminiInlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"` // base64
}

type geminiPart struct {
	Text       string            `json:"text,omitempty"`
	InlineData *geminiInlineData `json:"inlineData,omitempty"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiRequestBody struct {
	Contents         []geminiContent `json:"contents"`
	GenerationConfig geminiGenConfig `json:"generationConfig"`
}

// ClassifyBookWithAI performs deterministic book classification with failover support across database-configured AI providers
func (r *LibraryRepository) ClassifyBookWithAI(title, author, description string, subjects []string, apiKey string) (*GeminiClassifyResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	authorText := author
	if strings.TrimSpace(authorText) == "" {
		authorText = "(Penulis Tidak Diisi)"
	}

	prompt := fmt.Sprintf(`Anda adalah asisten pustakawan AI untuk aplikasi Sekolahku. Tugas Anda adalah mengklasifikasikan buku ke dalam kategori Dewey Decimal Classification (DDC) yang disederhanakan dan menyarankan lokasi rak fisik yang tepat.

Gunakan informasi buku berikut untuk melakukan analisis:
Judul: %s
Penulis: %s
Deskripsi Sebelumnya: %s
Subjek Sebelumnya: %v

Petunjuk Klasifikasi DDC & Rak Fisik:
- 000_COMPUTER -> Ilmu Komputer, Informasi, Ensiklopedia umum, Perpustakaan (Rak: RAK-000)
- 100_PHILOSOPHY -> Filsafat, Psikologi, Etika, Logika, Pengembangan diri, Motivasi (Rak: RAK-100)
- 200_RELIGION -> Agama, Teologi, Aqidah, Fikih, Tafsir, Al-Qur'an, Alkitab, Sejarah Agama (Rak: RAK-200)
- 300_SOCIAL -> Ilmu Sosial, Politik, Ekonomi, Hukum, Pendidikan, Pemerintahan, Sosiologi (Rak: RAK-300)
- 400_LANGUAGE -> Bahasa, Tata Bahasa, Kamus, Kosakata, Pembelajaran Bahasa (Rak: RAK-400 atau RAK-REF)
- 500_SCIENCE -> Sains, Matematika, Fisika, Kimia, Biologi, Astronomi, Lingkungan (Rak: RAK-500)
- 600_TECHNOLOGY -> Teknologi, Teknik, Kedokteran, Kesehatan, Pertanian, Gizi, Boga (Rak: RAK-600)
- 700_ART -> Seni, Musik, Olahraga, Arsitektur, Desain, Fotografi, Hobi, Film (Rak: RAK-700)
- 800_LITERATURE -> Kesusastraan, Novel, Cerpen, Puisi, Fiksi, Drama, Dongeng (Rak: RAK-800)
- 900_HISTORY -> Sejarah, Geografi, Atlas, Peta, Biografi Tokoh Sejarah, Perjalanan (Rak: RAK-900)

Aturan Tambahan:
- Berikan deskripsi/sinopsis singkat buku dalam bahasa Indonesia (sekitar 2-3 kalimat) jika deskripsi sebelumnya kosong atau kurang lengkap.
- Tentukan kategori DDC dan Rak secara presisi dan konsisten.
- Tulis alasan klasifikasi (reason) yang ringkas dalam bahasa Indonesia.
- Kembalikan daftar kata kunci/subjek yang relevan.`, title, authorText, description, subjects)

	providerRepo := NewAIProviderRepository(r.DB)
	dbProviders, err := providerRepo.GetEnabledProviders()
	if err == nil && len(dbProviders) > 0 {
		for _, p := range dbProviders {
			key := p.ResolveAPIKey()
			if key == "" {
				continue
			}
			if p.ProviderType == "gemini" {
				if res, gErr := classifyWithGemini(ctx, prompt, key); gErr == nil && res != nil {
					return res, nil
				}
			} else {
				// OpenAI, 9Router, OpenRouter, Custom OpenAI-compatible
				baseURL := p.BaseURL
				if baseURL == "" {
					baseURL = "https://api.openai.com/v1"
				}
				modelName := p.ModelName
				if modelName == "" {
					modelName = "gpt-4o-mini"
				}
				if res, oErr := classifyWithOpenAICompatibleCustom(ctx, prompt, key, baseURL, modelName); oErr == nil && res != nil {
					return res, nil
				}
			}
		}
	}

	// Fallback to default Gemini API if available
	if apiKey != "" {
		if res, gErr := classifyWithGemini(ctx, prompt, apiKey); gErr == nil && res != nil {
			return res, nil
		}
	}
	return nil, fmt.Errorf("semua AI Provider yang dikonfigurasi gagal dipanggil")
}

func classifyWithGemini(ctx context.Context, prompt, apiKey string) (*GeminiClassifyResult, error) {

	reqBody := geminiRequestBody{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: prompt},
				},
			},
		},
		GenerationConfig: geminiGenConfig{
			Temperature:      0.0,
			TopP:             0.1,
			ResponseMimeType: "application/json",
			ResponseSchema: &geminiSchema{
				Type: "OBJECT",
				Properties: map[string]*geminiSchemaProperty{
					"category": {
						Type: "STRING",
						Enum: []string{"000_COMPUTER", "100_PHILOSOPHY", "200_RELIGION", "300_SOCIAL", "400_LANGUAGE", "500_SCIENCE", "600_TECHNOLOGY", "700_ART", "800_LITERATURE", "900_HISTORY", "UNSORTED"},
					},
					"shelf": {
						Type: "STRING",
						Enum: []string{"RAK-000", "RAK-100", "RAK-200", "RAK-300", "RAK-400", "RAK-500", "RAK-600", "RAK-700", "RAK-800", "RAK-900", "RAK-REF", "RAK-NEW"},
					},
					"reason": {
						Type: "STRING",
					},
					"description": {
						Type: "STRING",
					},
					"subjects": {
						Type: "ARRAY",
						Items: &geminiSchema{
							Type: "STRING",
						},
					},
				},
				Required: []string{"category", "shelf", "reason", "description"},
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

	client := &http.Client{Timeout: 8 * time.Second}
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

	// Parse Response from Gemini
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

	// The response text is a structured JSON string as requested by the responseSchema
	var result GeminiClassifyResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		return nil, fmt.Errorf("failed to parse Gemini output JSON: %w (raw output: %s)", err, responseText)
	}

	return &result, nil
}

func classifyWithOpenAICompatible(ctx context.Context, prompt, apiKey string) (*GeminiClassifyResult, error) {
	baseURL := firstNonEmpty(os.Getenv("AI_BASE_URL"), os.Getenv("OPENAI_BASE_URL"), "https://api.openai.com/v1")
	modelName := firstNonEmpty(os.Getenv("AI_MODEL_NAME"), os.Getenv("OPENAI_MODEL_NAME"), "gpt-4o-mini")
	return classifyWithOpenAICompatibleCustom(ctx, prompt, apiKey, baseURL, modelName)
}

func classifyWithOpenAICompatibleCustom(ctx context.Context, prompt, apiKey, baseURL, modelName string) (*GeminiClassifyResult, error) {
	endpoint := strings.TrimRight(baseURL, "/") + "/chat/completions"

	systemMsg := "Anda adalah pustakawan profesional. Balas HANYA dengan JSON valid tanpa format markdown codeblock ```json. Format JSON harus mengandung field: category (salah satu: 000_COMPUTER, 100_PHILOSOPHY, 200_RELIGION, 300_SOCIAL, 400_LANGUAGE, 500_SCIENCE, 600_TECHNOLOGY, 700_ART, 800_LITERATURE, 900_HISTORY, UNSORTED), shelf (salah satu: RAK-000, RAK-100, RAK-200, RAK-300, RAK-400, RAK-500, RAK-600, RAK-700, RAK-800, RAK-900, RAK-REF, RAK-NEW), reason (string), description (string), subjects (array string)."

	reqBody := map[string]interface{}{
		"model": modelName,
		"messages": []map[string]string{
			{"role": "system", "content": systemMsg},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.0,
		"response_format": map[string]string{"type": "json_object"},
	}

	payloadBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errObj map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errObj)
		return nil, fmt.Errorf("AI Provider error (%d): %v", resp.StatusCode, errObj)
	}

	var resPayload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&resPayload); err != nil {
		return nil, err
	}

	if len(resPayload.Choices) == 0 {
		return nil, fmt.Errorf("empty AI choices response")
	}

	rawText := strings.TrimSpace(resPayload.Choices[0].Message.Content)
	rawText = strings.TrimPrefix(rawText, "```json")
	rawText = strings.TrimPrefix(rawText, "```")
	rawText = strings.TrimSuffix(rawText, "```")
	rawText = strings.TrimSpace(rawText)

	var result GeminiClassifyResult
	if err := json.Unmarshal([]byte(rawText), &result); err != nil {
		return nil, fmt.Errorf("failed unmarshaling AI JSON response: %w", err)
	}

	return &result, nil
}
