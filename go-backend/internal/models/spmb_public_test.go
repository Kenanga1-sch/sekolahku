package models

import "testing"

// NIK yang ditampilkan di halaman verifikasi publik harus disamarkan:
// 4 digit awal + 4 digit akhir, sisanya tertutup.
func TestMaskPublicNIK(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"3201234567890123", "3201********0123"},
		{"1234567890", "1234**7890"},
		{"12345678", "12345678"},
		{"123", "123"},
		{"", ""},
		{"  3201234567890123  ", "3201********0123"},
	}
	for _, c := range cases {
		got := MaskPublicNIK(c.in)
		if got != c.want {
			t.Fatalf("MaskPublicNIK(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// DTO publik harus membawa data nyata (NIK disamarkan + waktu verifikasi),
// bukan dikosongkan atau dimock di frontend.
func TestToPublicRegistrantStatusCarriesRealData(t *testing.T) {
	reg := SPMBRegistrant{
		ID:                 "reg-1",
		RegistrationNumber: "SPMB-2026-0001",
		FullName:           "Calon Siswa",
		StudentNIK:         "3201234567890123",
		Status:             "verified",
		PeriodID:           "period-1",
		CreatedAt:          1700000000000,
		VerifiedAt:         1700000600000,
	}
	dto := reg.ToPublicRegistrantStatus()
	if dto.StudentNIKMasked != "3201********0123" {
		t.Fatalf("NIK harus disamarkan, got %q", dto.StudentNIKMasked)
	}
	if dto.StudentNIKMasked == reg.StudentNIK {
		t.Fatalf("NIK utuh tidak boleh keluar ke publik")
	}
	if dto.VerifiedAt != 1700000600000 {
		t.Fatalf("verifiedAt harus waktu verifikasi asli, got %d", dto.VerifiedAt)
	}
	if dto.CreatedAt != 1700000000000 {
		t.Fatalf("createdAt salah: %d", dto.CreatedAt)
	}
	if dto.RegistrationNumber != "SPMB-2026-0001" || dto.FullName != "Calon Siswa" {
		t.Fatalf("data dasar hilang: %+v", dto)
	}
}

