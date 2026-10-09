package models

import "time"

// TabunganGTK adalah rekening tabungan milik GTK (guru & tenaga kependidikan) —
// terpisah dari tabungan_siswa. Sengaja ringkas: saldo + setor/tarik + rekap,
// tanpa brankas/hutang/kelas/treasurer milik modul siswa.
type TabunganGTK struct {
	ID            string     `json:"id"`
	EmployeeID    string     `json:"employeeId"`
	Nama          string     `json:"nama"`
	Kategori      string     `json:"kategori"`
	QRCode        string     `json:"qrCode"`
	SaldoTerakhir int        `json:"saldoTerakhir"`
	CreatedAt     *time.Time `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt"`
}

// TabunganGTKTransaksi mencatat setor/tarik rekening GTK. Status langsung
// "posted" (tanpa antrean verifikasi bendahara — GTK mengelola sendiri).
type TabunganGTKTransaksi struct {
	ID        string     `json:"id"`
	GtkID     string     `json:"gtkId"`
	UserID    string     `json:"userId"`
	Tipe      string     `json:"tipe"` // "setor" | "tarik"
	Nominal   int        `json:"nominal"`
	Status    string     `json:"status"`
	Catatan   *string    `json:"catatan"`
	CreatedAt *time.Time `json:"createdAt"`
}

type CreateGtkTransaksiRequest struct {
	EmployeeID string  `json:"employeeId"`
	Code       string  `json:"code"` // alternatif: QR/NIP di-scan
	Tipe       string  `json:"tipe"`
	Nominal    int     `json:"nominal"`
	Catatan    *string `json:"catatan"`
	UserID     string  `json:"userId"`
}
