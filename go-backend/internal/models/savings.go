package models

import "time"

// TabunganKelas represents a class in the savings system
type TabunganKelas struct {
	ID        string     `json:"id"`
	Nama      string     `json:"nama"`
	WaliKelas *string    `json:"waliKelas"`
	CreatedAt *time.Time `json:"createdAt"`
}

// TabunganSiswa represents the student's savings account
type TabunganSiswa struct {
	ID            string         `json:"id"`
	StudentID     *string        `json:"studentId"`
	NISN          string         `json:"nisn"`
	Nama          string         `json:"nama"`
	KelasID       string         `json:"kelasId"`
	Kelas         *TabunganKelas `json:"kelas,omitempty"`
	SaldoTerakhir int            `json:"saldoTerakhir"`
	QRCode        string         `json:"qrCode"`
	Foto          *string        `json:"foto"`
	IsActive      bool           `json:"isActive"`
	CreatedAt     *time.Time     `json:"createdAt"`
	UpdatedAt     *time.Time     `json:"updatedAt"`
}

// TabunganTransaksi represents a deposit or withdrawal
type TabunganTransaksi struct {
	ID         string         `json:"id"`
	SiswaID    string         `json:"siswaId"`
	Siswa      *TabunganSiswa `json:"siswa,omitempty"`
	UserID     string         `json:"userId"`
	User       *User          `json:"user,omitempty"`
	SetoranID  *string        `json:"setoranId"`
	Tipe       string         `json:"tipe"` // "setor", "tarik"
	Nominal    int            `json:"nominal"`
	Status     string         `json:"status"` // "pending", "collected", "verified", "rejected"
	Catatan    *string        `json:"catatan"`
	VerifiedBy *string        `json:"verifiedBy"`
	CreatedAt  *time.Time     `json:"createdAt"`
	UpdatedAt  *time.Time     `json:"updatedAt"`
}

type CreateTransaksiRequest struct {
	SiswaID string  `json:"siswaId"`
	Tipe    string  `json:"tipe"`
	Type    string  `json:"type"`
	Nominal int     `json:"nominal"`
	Catatan *string `json:"catatan"`
	UserID  string  `json:"userId"`
}

type CreateSiswaRequest struct {
	NISN    string  `json:"nisn"`
	Nama    string  `json:"nama"`
	KelasID string  `json:"kelasId"`
	QRCode  *string `json:"qrCode"`
}

// TabunganSetoran represents a batch settlement
type TabunganSetoran struct {
	ID           string     `json:"id"`
	GuruID       string     `json:"guruId"`
	Guru         *User      `json:"guru,omitempty"`
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

// Brankas
type TabunganBrankas struct {
	ID        string     `json:"id"`
	Nama      string     `json:"nama"`
	Tipe      string     `json:"tipe"` // cash, bank
	Saldo     int        `json:"saldo"`
	PicID     *string    `json:"picId"`
	Pic       *User      `json:"pic,omitempty"`
	UpdatedAt *time.Time `json:"updatedAt"`
}

type TabunganBrankasTransaksi struct {
	ID        string     `json:"id"`
	Tipe      string     `json:"tipe"`
	Nominal   int        `json:"nominal"`
	UserID    *string    `json:"userId"`
	User      *User      `json:"user,omitempty"`
	Catatan   *string    `json:"catatan"`
	CreatedAt *time.Time `json:"createdAt"`
}

type TransferBrankasRequest struct {
	FromID  string  `json:"fromId"`
	ToID    string  `json:"toId"`
	Tipe    string  `json:"tipe"`
	Nominal int     `json:"nominal"`
	Amount  int     `json:"amount"`
	UserID  string  `json:"userId"`
	Catatan *string `json:"catatan"`
}

// Hutang
type TabunganHutang struct {
	ID             string         `json:"id"`
	SiswaID        string         `json:"siswaId"`
	Siswa          *TabunganSiswa `json:"siswa,omitempty"`
	NamaBarang     string         `json:"namaBarang"`
	Kategori       string         `json:"kategori"`
	Nominal        int            `json:"nominal"`
	Jumlah         int            `json:"jumlah"`
	Terbayar       int            `json:"terbayar"`
	DicatatOleh    string         `json:"dicatatOleh"`
	Status         string         `json:"status"` // aktif, lunas, cicilan, batal
	TanggalLunas   *time.Time     `json:"tanggalLunas"`
	DilunaskanDari *string        `json:"dilunaskanDari"` // saldo_tabungan, tunai
	CreatedAt      *time.Time     `json:"createdAt"`
}

type TabunganHutangPembayaran struct {
	ID          string     `json:"id"`
	HutangID    string     `json:"hutangId"`
	Nominal     int        `json:"nominal"`
	Metode      string     `json:"metode"` // cash, tabungan
	TransaksiID *string    `json:"transaksiId"`
	DicatatOleh string     `json:"dicatatOleh"`
	CreatedAt   *time.Time `json:"createdAt"`
}

type PayHutangRequest struct {
	Amount int `json:"amount"`
}

// CreateBrankasRequest represents request to create/update a vault
type CreateBrankasRequest struct {
	Nama  string  `json:"nama"`
	Tipe  string  `json:"tipe"`
	Saldo int     `json:"saldo"`
	PicID *string `json:"picId"`
}

// TabunganSetoranDetail includes the settlement with its transactions
type TabunganSetoranDetail struct {
	ID            string               `json:"id"`
	GuruID        string               `json:"guruId"`
	Guru          *User                `json:"guru,omitempty"`
	BendaharaID   *string              `json:"bendaharaId"`
	BendaharaName *string              `json:"bendaharaName"`
	Tipe          string               `json:"tipe"`
	TotalNominal  int                  `json:"totalNominal"`
	NominalFisik  *int                 `json:"nominalFisik"`
	Selisih       int                  `json:"selisih"`
	Status        string               `json:"status"`
	Catatan       *string              `json:"catatan"`
	CreatedAt     *time.Time           `json:"createdAt"`
	Transactions  []SetoranTransaction `json:"transactions"`
}

// SetoranTransaction is a single transaction within a setoran batch
type SetoranTransaction struct {
	ID        string  `json:"id"`
	SiswaID   string  `json:"siswaId"`
	SiswaName string  `json:"siswaName"`
	Tipe      string  `json:"tipe"`
	Nominal   int     `json:"nominal"`
	Catatan   *string `json:"catatan"`
}

type TopSaverItem struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Kelas string `json:"kelas"`
	Saldo int    `json:"saldo"`
}

type RecentTransactionItem struct {
	ID        string `json:"id"`
	Tipe      string `json:"type"`
	Nominal   int    `json:"nominal"`
	SiswaName string `json:"siswaName"`
	KelasName string `json:"kelasName"`
	Time      string `json:"time"`
}

type TransactionTrendItem struct {
	Date  string `json:"date"`
	Setor int    `json:"setor"`
	Tarik int    `json:"tarik"`
}

type SaldoByKelasItem struct {
	Name  string `json:"name"`
	Value int    `json:"value"`
	Color string `json:"color"`
}

type FinalReportSiswa struct {
	Nama  string `json:"nama"`
	NISN  string `json:"nisn"`
	Kelas string `json:"kelas"`
	Saldo int    `json:"saldo"`
}

type FinalReportTransaction struct {
	Tipe    string `json:"tipe"`
	Nominal int    `json:"nominal"`
	Catatan string `json:"catatan,omitempty"`
	Tanggal string `json:"tanggal,omitempty"`
}

type FinalReport struct {
	Siswa        FinalReportSiswa        `json:"siswa"`
	Transactions []FinalReportTransaction `json:"transactions"`
	TotalSetor   int                     `json:"totalSetor"`
	TotalTarik   int                     `json:"totalTarik"`
	SaldoAkhir   int                     `json:"saldoAkhir"`
}

type StatementItem struct {
	ID        string `json:"id"`
	Tipe      string `json:"tipe"`
	Nominal   int    `json:"nominal"`
	Status    string `json:"status"`
	Catatan   string `json:"catatan,omitempty"`
	Tanggal   string `json:"tanggal,omitempty"`
	NamaSiswa string `json:"namaSiswa,omitempty"`
}

type UpdateHutangRequest struct {
	NamaBarang string `json:"namaBarang"`
	Nominal    int    `json:"nominal"`
	Jumlah     int    `json:"jumlah"`
}

type SavingsStats struct {
	TotalSiswa          int `json:"totalSiswa"`
	TotalSaldo          int `json:"totalSaldo"`
	PendingTransactions int `json:"pendingTransactions"`
	TodayTransactions   int `json:"todayTransactions"`
	TodayDeposit        int `json:"todayDeposit"`
	TodayWithdraw       int `json:"todayWithdraw"`
	TotalSaldoSiswa     int `json:"totalSaldoSiswa"`
	TotalBrankas        int `json:"totalBrankas"`
	TotalPiutang        int `json:"totalPiutang"`
	PendingSetoran      int `json:"pendingSetoran"`
}
