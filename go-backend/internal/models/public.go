package models

type PublicHomepageData struct {
	Success      bool                `json:"success"`
	Settings     *SchoolSettings     `json:"settings"`
	News         []Announcement      `json:"news"`
	ActivePeriod *SPMBPeriod         `json:"activePeriod"`
	Stats        PublicStats         `json:"stats"`
}

type PublicStats struct {
	StudentCount int `json:"studentCount"`
}

type PublicStaff struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	IsActive bool   `json:"isActive"`
	Category string `json:"category"`
	Degree   string `json:"degree"`
	Position string `json:"position"`
	PhotoURL string `json:"photoUrl"`
	Quote    string `json:"quote"`
}
