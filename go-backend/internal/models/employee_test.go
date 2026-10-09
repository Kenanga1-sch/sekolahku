package models

import "testing"

func TestFullNameWithDegree(t *testing.T) {
	deg := "S.Pd."
	empty := ""
	blank := "   "

	if got := FullNameWithDegree("Badrudin", &deg); got != "Badrudin, S.Pd." {
		t.Fatalf("expected 'Badrudin, S.Pd.', got %q", got)
	}
	if got := FullNameWithDegree("Badrudin", nil); got != "Badrudin" {
		t.Fatalf("nil degree → name only, got %q", got)
	}
	if got := FullNameWithDegree("Badrudin", &empty); got != "Badrudin" {
		t.Fatalf("empty degree → name only, got %q", got)
	}
	if got := FullNameWithDegree("  Badrudin  ", &blank); got != "Badrudin" {
		t.Fatalf("whitespace ditrim, got %q", got)
	}
	// Nama kosong + gelar ada → hanya gelar (bukan ", S.Pd.").
	if got := FullNameWithDegree("", &deg); got != "S.Pd." {
		t.Fatalf("empty name → degree only, got %q", got)
	}
	if got := FullNameWithDegree("", nil); got != "" {
		t.Fatalf("both empty → empty, got %q", got)
	}
}

func TestEmployeeApplyFullName(t *testing.T) {
	deg := "S.Pd.SD."
	e := Employee{Name: "Rusmaningsih", Degree: &deg}
	e.ApplyFullName()
	if e.FullName == nil || *e.FullName != "Rusmaningsih, S.Pd.SD." {
		t.Fatalf("FullName tidak digabung: %#v", e.FullName)
	}
	// Name tetap tanpa gelar (gabar hanya di FullName — hindari gelar ganda
	// di konsumen yang menggabungkan sendiri).
	if e.Name != "Rusmaningsih" {
		t.Fatalf("Name tidak boleh berubah, got %q", e.Name)
	}
}
