package models

type ReportTemplate struct {
	ID          int64  `json:"id" db:"id"`
	Code        string `json:"code" db:"code"`
	Name        string `json:"name" db:"name"`
	Category    string `json:"category" db:"category"`
	Module      string `json:"module" db:"module"`
	Description string `json:"description" db:"description"`
	PaperSize   string `json:"paperSize" db:"paper_size"`
	Orientation string `json:"orientation" db:"orientation"`
	LayoutJSON  string `json:"layoutJson" db:"layout_json"`
	IsDefault   bool   `json:"isDefault" db:"is_default"`
	CreatedAt   int64  `json:"createdAt" db:"created_at"`
	UpdatedAt   int64  `json:"updatedAt" db:"updated_at"`
}

type CreateReportTemplateRequest struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Module      string `json:"module"`
	Description string `json:"description"`
	PaperSize   string `json:"paperSize"`
	Orientation string `json:"orientation"`
	LayoutJSON  string `json:"layoutJson"`
	IsDefault   bool   `json:"isDefault"`
}

type UpdateReportTemplateRequest struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	Module      string `json:"module"`
	Description string `json:"description"`
	PaperSize   string `json:"paperSize"`
	Orientation string `json:"orientation"`
	LayoutJSON  string `json:"layoutJson"`
	IsDefault   bool   `json:"isDefault"`
}
