package handlers

import (
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
)

func ptr(s string) *string { return &s }

func TestValidateEmployeeIdentityNumbers(t *testing.T) {
	cases := []struct {
		name    string
		req     models.CreateEmployeeRequest
		wantErr bool
	}{
		{"kosong semua — boleh", models.CreateEmployeeRequest{}, false},
		{"NIP 18 digit valid", models.CreateEmployeeRequest{NIP: ptr("196805121988031002")}, false},
		{"NIP 17 digit — salah", models.CreateEmployeeRequest{NIP: ptr("19680512198803100")}, true},
		{"NIP ada huruf — salah", models.CreateEmployeeRequest{NIP: ptr("1968O5121988031002")}, true},
		{"NUPTK 16 digit valid", models.CreateEmployeeRequest{NUPTK: ptr("1234567890123456")}, false},
		{"NUPTK 15 digit — salah", models.CreateEmployeeRequest{NUPTK: ptr("123456789012345")}, true},
		{"NIK 16 digit valid", models.CreateEmployeeRequest{NIK: ptr("1601020101800001")}, false},
		{"NIK 16 digit dengan spasi — boleh (dibersihkan)", models.CreateEmployeeRequest{NIK: ptr("1601 0201 0180 0001")}, false},
		{"NIK 10 digit — salah", models.CreateEmployeeRequest{NIK: ptr("1601020180")}, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			msg := validateEmployeeIdentityNumbers(tc.req)
			if tc.wantErr && msg == "" {
				t.Fatal("harus ditolak, tapi lolos")
			}
			if !tc.wantErr && msg != "" {
				t.Fatalf("harus lolos, tapi ditolak: %s", msg)
			}
		})
	}
}
