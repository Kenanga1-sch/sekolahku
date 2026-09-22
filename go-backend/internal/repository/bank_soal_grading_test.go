package repository

import "testing"

func TestGradeAnswer(t *testing.T) {
	tests := []struct {
		name      string
		qType     string
		correct   string
		student   string
		wantMatch bool
	}{
		// pg_single: text comparison, case-insensitive.
		{"pg_single benar", "pg_single", "Jakarta", "Jakarta", true},
		{"pg_single beda huruf", "pg_single", "Jakarta", "jakarta", true},
		{"pg_single spasi", "pg_single", "Jakarta", "  Jakarta  ", true},
		{"pg_single salah", "pg_single", "Jakarta", "Bandung", false},
		{"pg_single kosong", "pg_single", "Jakarta", "", false},

		// pg_multi: teks (bukan ID), himpunan, urutan bebas, case-insensitive.
		{"pg_multi tepat", "pg_multi", `["Jakarta","Bandung"]`, `["Jakarta","Bandung"]`, true},
		{"pg_multi urutan beda", "pg_multi", `["Jakarta","Bandung"]`, `["Bandung","Jakarta"]`, true},
		{"pg_multi beda huruf", "pg_multi", `["Jakarta","Bandung"]`, `["jakarta","bandung"]`, true},
		{"pg_multi spasi", "pg_multi", `["Jakarta","Bandung"]`, `[" Jakarta ", "Bandung"]`, true},
		{"pg_multi kurang satu", "pg_multi", `["Jakarta","Bandung"]`, `["Jakarta"]`, false},
		{"pg_multi kelebihan", "pg_multi", `["Jakarta"]`, `["Jakarta","Bandung"]`, false},
		{"pg_multi salah", "pg_multi", `["Jakarta","Bandung"]`, `["Surabaya","Medan"]`, false},
		// Regresi: correctAnswer disimpan sebagai ID lama -> tidak match teks siswa.
		{"pg_multi id lama tidak match teks", "pg_multi", `["1","3"]`, `["Jakarta","Bandung"]`, false},

		// true_false.
		{"true_false benar", "true_false", "Benar", "Benar", true},
		{"true_false huruf", "true_false", "Benar", "benar", true},
		{"true_false salah", "true_false", "Benar", "Salah", false},

		// fill_blank: salah satu alternatif diterima.
		{"fill_blank tepat", "fill_blank", `["Jakarta","DKI Jakarta"]`, "Jakarta", true},
		{"fill_blank alternatif", "fill_blank", `["Jakarta","DKI Jakarta"]`, "dki jakarta", true},
		{"fill_blank salah", "fill_blank", `["Jakarta","DKI Jakarta"]`, "Bandung", false},

		// matching / pair_match: map leftId -> rightId.
		{"pair_match tepat", "pair_match", `{"1":"a","2":"b"}`, `{"1":"a","2":"b"}`, true},
		{"pair_match beda isi", "pair_match", `{"1":"a","2":"b"}`, `{"1":"b","2":"a"}`, false},
		{"pair_match kurang", "pair_match", `{"1":"a","2":"b"}`, `{"1":"a"}`, false},

		// essay: auto-grade selalu false (manual).
		{"essay manual", "essay", "", "jawaban apapun", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := gradeAnswer(tt.qType, tt.correct, tt.student)
			if got != tt.wantMatch {
				t.Errorf("gradeAnswer(%q, %q, %q) = %v, want %v",
					tt.qType, tt.correct, tt.student, got, tt.wantMatch)
			}
		})
	}
}

func TestStringSetEqualFold(t *testing.T) {
	tests := []struct {
		name string
		a, b []string
		want bool
	}{
		{"sama persis", []string{"a", "b"}, []string{"a", "b"}, true},
		{"urutan beda", []string{"a", "b"}, []string{"b", "a"}, true},
		{"huruf beda", []string{"A", "B"}, []string{"a", "b"}, true},
		{"spasi", []string{" a ", "b"}, []string{"a", "b "}, true},
		{"panjang beda", []string{"a"}, []string{"a", "b"}, false},
		{"isi beda", []string{"a", "b"}, []string{"a", "c"}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := stringSetEqualFold(tt.a, tt.b); got != tt.want {
				t.Errorf("stringSetEqualFold(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}
