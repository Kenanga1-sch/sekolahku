package models

import (
	"os"
	"strings"
)

type AIProvider struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	ProviderType  string `json:"providerType"`  // "gemini", "openai", "openrouter", "9router", "custom"
	BaseURL       string `json:"baseUrl"`       // Base API Endpoint
	ModelName     string `json:"modelName"`     // Default model name
	APIKeyEnvVar  string `json:"apiKeyEnvVar"`  // e.g. "GEMINI_API_KEY", "NINEROUTER_API_KEY"
	APIKeyValue   string `json:"apiKeyValue"`   // Direct API Key (masked on JSON list if set)
	IsEnabled     bool   `json:"isEnabled"`
	Priority      int    `json:"priority"`
	CreatedAt     int64  `json:"createdAt"`
	UpdatedAt     int64  `json:"updatedAt"`
}

func (p *AIProvider) ResolveAPIKey() string {
	if strings.TrimSpace(p.APIKeyValue) != "" {
		return strings.TrimSpace(p.APIKeyValue)
	}
	if strings.TrimSpace(p.APIKeyEnvVar) != "" {
		return strings.TrimSpace(os.Getenv(p.APIKeyEnvVar))
	}
	return ""
}

type AIProviderRequest struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	ProviderType string `json:"providerType"`
	BaseURL      string `json:"baseUrl"`
	ModelName    string `json:"modelName"`
	APIKeyEnvVar string `json:"apiKeyEnvVar"`
	APIKeyValue  string `json:"apiKeyValue"`
	IsEnabled    bool   `json:"isEnabled"`
	Priority     int    `json:"priority"`
}
