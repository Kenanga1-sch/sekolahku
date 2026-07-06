package models

// IntegrationSettings represents connection details for Dapodik and e-Rapor
type IntegrationSettings struct {
	ID           string `json:"id"`
	DapodikURL   string `json:"dapodikUrl"`
	DapodikToken string `json:"dapodikToken"`
	DapodikNPSN  string `json:"dapodikNpsn"`
	ERaporURL    string `json:"eraporUrl"`
	ERaporToken  string `json:"eraporToken"`
	ERaporDBHost string `json:"eraporDbHost"`
	ERaporDBPort string `json:"eraporDbPort"`
	ERaporDBUser string `json:"eraporDbUser"`
	ERaporDBPass string `json:"eraporDbPass"`
	ERaporDBName string `json:"eraporDbName"`
	IsSandbox    bool   `json:"isSandbox"`
	LastSyncedAt int64  `json:"lastSyncedAt"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}
