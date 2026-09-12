package handlers

import "testing"

func TestStatementMonthRange(t *testing.T) {
	tests := []struct {
		name    string
		month   string
		start   string
		end     string
		wantErr bool
	}{
		{"bulan penuh 31 hari", "2026-01", "2026-01-01", "2026-01-31", false},
		{"februari kabisat", "2024-02", "2024-02-01", "2024-02-29", false},
		{"desember ganti tahun", "2026-12", "2026-12-01", "2026-12-31", false},
		{"spasi diabaikan", " 2026-03 ", "2026-03-01", "2026-03-31", false},
		{"kosong jatuh ke bulan berjalan", "", "2000-01-01", "2100-12-31", false},
		{"format salah ditolak", "2026/01", "", "", true},
		{"bulan 13 ditolak", "2026-13", "", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start, end, err := statementMonthRange(tt.month)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err=%v wantErr=%v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if tt.month == "" {
				if start < tt.start || end > tt.end || start > end {
					t.Fatalf("bulan berjalan tidak wajar: %s..%s", start, end)
				}
				return
			}
			if start != tt.start || end != tt.end {
				t.Fatalf("range=%s..%s want=%s..%s", start, end, tt.start, tt.end)
			}
		})
	}
}
