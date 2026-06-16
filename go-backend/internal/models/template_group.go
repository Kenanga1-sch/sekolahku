package models

import "time"

type LetterTemplateGroup struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description *string      `json:"description"`
	CreatedAt   *time.Time   `json:"createdAt"`
	UpdatedAt   *time.Time   `json:"updatedAt"`
	Items       []LetterTemplateGroupItem `json:"items,omitempty"`
}

type LetterTemplateGroupItem struct {
	GroupID    string          `json:"groupId"`
	TemplateID string          `json:"templateId"`
	Template   *LetterTemplate `json:"template,omitempty"`
}

type LetterTemplateGroupResponse struct {
	Data []LetterTemplateGroup `json:"data"`
}

type BatchGenerateGroupRequest struct {
	GroupID            string            `json:"groupId"`
	Recipient          string            `json:"recipient"`
	ManualVars         map[string]string `json:"manualVars"`
	ClassificationCode *string           `json:"classificationCode"`
	LetterNumber       string            `json:"letterNumber"` // Base number
	NextSequence       int               `json:"nextSequence"` // Starting sequence
}
