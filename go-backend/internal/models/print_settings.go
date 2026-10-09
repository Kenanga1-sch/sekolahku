package models

// PrintSettings adalah pengaturan cetak per modul laporan.
type PrintSettings struct {
	Module         string  `json:"module"`
	MarginTopMm    float64 `json:"marginTopMm"`
	MarginBottomMm float64 `json:"marginBottomMm"`
	MarginLeftMm   float64 `json:"marginLeftMm"`
	MarginRightMm  float64 `json:"marginRightMm"`
	RepeatHeader   bool    `json:"repeatHeader"`
	KeepRows       int     `json:"keepRows"`
	UpdatedAt      int64   `json:"updatedAt"`
}

// DefaultPrintSettings dipakai bila modul belum punya baris pengaturan.
func DefaultPrintSettings(module string) PrintSettings {
	return PrintSettings{
		Module:         module,
		MarginTopMm:    10,
		MarginBottomMm: 10,
		MarginLeftMm:   10,
		MarginRightMm:  10,
	}
}
