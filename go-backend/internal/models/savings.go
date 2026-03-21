package models

import "time"

// TabunganSiswa represents the student's savings account
type TabunganSiswa struct {
	ID            string     `json:"id"`
	StudentID     *string    `json:"studentId"`
	NISN          string     `json:"nisn"`
	Nama          string     `json:"nama"`
	KelasID       string     `json:"kelasId"`
	SaldoTerakhir int        `json:"saldoTerakhir"`
	IsActive      bool       `json:"isActive"`
	CreatedAt     *time.Time `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt"`
}

// TabunganTransaksi represents a deposit or withdrawal
type TabunganTransaksi struct {
	ID        string     `json:"id"`
	SiswaID   string     `json:"siswaId"`
	UserID    string     `json:"userId"`
	SetoranID *string    `json:"setoranId"`
	Tipe      string     `json:"tipe"` // "setor", "tarik"
	Nominal   int        `json:"nominal"`
	Status    string     `json:"status"` // "pending", "collected", "verified", "rejected"
	Catatan   *string    `json:"catatan"`
	CreatedAt *time.Time `json:"createdAt"`
	UpdatedAt *time.Time `json:"updatedAt"`
}

type CreateTransaksiRequest struct {
	SiswaID   string  `json:"siswaId"`
	Tipe      string  `json:"tipe"`    
	Nominal   int     `json:"nominal"`
	Catatan   *string `json:"catatan"`
	UserID    string  `json:"userId"`
}

// TabunganSetoran represents a batch settlement
type TabunganSetoran struct {
	ID           string     `json:"id"`
	GuruID       string     `json:"guruId"`
	BendaharaID  *string    `json:"bendaharaId"`
	Tipe         string     `json:"tipe"` // "setor_ke_bendahara", "tarik_dari_bendahara"
	TotalNominal int        `json:"totalNominal"`
	NominalFisik *int       `json:"nominalFisik"`
	Selisih      int        `json:"selisih"`
	Status       string     `json:"status"` // "pending", "verified", "rejected"
	Catatan      *string    `json:"catatan"`
	CreatedAt    *time.Time `json:"createdAt"`
	UpdatedAt    *time.Time `json:"updatedAt"`
}

type CreateSetoranRequest struct {
	GuruID  string  `json:"guruId"`
	Catatan *string `json:"catatan"`
}

type VerifySetoranRequest struct {
	SetoranID    string  `json:"setoranId"`
	BendaharaID  string  `json:"bendaharaId"`
	Status       string  `json:"status"` // "verified", "rejected"
	NominalFisik *int    `json:"nominalFisik"`
	Catatan      *string `json:"catatan"`
}
