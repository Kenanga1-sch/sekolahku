package repository

import "strings"

// attendanceRequiredStatuses adalah status kepegawaian yang WAJIB presensi:
// seluruh non-ASN (GTT/GTY/Honorer/PTT) plus Pembina Ekskul. PNS & PPPK
// (ASN) dikecualikan.
var attendanceRequiredStatuses = map[string]bool{
	"gtt":                   true,
	"gty":                   true,
	"ptt":                   true,
	"honorer":               true,
	"guru tidak tetap":      true,
	"guru tetap yayasan":    true,
	"pegawai tidak tetap":   true,
	"pembina ekskul":        true,
	"pembina ekstrakurikuler": true,
}

// IsAttendanceRequired melaporkan apakah status kepegawaian wajib presensi.
// Normalisasi case-insensitive + trim (nilai lama tak konsisten).
func IsAttendanceRequired(employmentStatus string) bool {
	return attendanceRequiredStatuses[strings.ToLower(strings.TrimSpace(employmentStatus))]
}

// CanonicalEmploymentStatus menyeragamkan ejaan status kepegawaian sebelum
// disimpan. "P3K" adalah ejaan populer untuk PPPK; data baru selalu disimpan
// sebagai "PPPK" agar label, filter, dan statistik konsisten. Migrasi 000094
// menyeragamkan baris lama.
func CanonicalEmploymentStatus(employmentStatus string) string {
	trimmed := strings.TrimSpace(employmentStatus)
	if strings.EqualFold(trimmed, "p3k") {
		return "PPPK"
	}
	return trimmed
}

// AttendanceRequiredStatuses mengembalikan daftar status (kanonik) yang wajib
// presensi — dipakai frontend untuk menampilkan pilihan.
func AttendanceRequiredStatuses() []string {
	return []string{"GTT", "GTY", "Honorer", "PTT", "Pembina Ekskul"}
}
