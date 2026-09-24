package repository

import (
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
)

// TestNilifyEmptyStrings memverifikasi bahwa string kosong / hanya spasi pada
// field *string dinormalkan menjadi nil. Ini kunci agar COALESCE(?, col) pada
// UPDATE alumni benar-benar mempertahankan nilai lama (tidak tertimpa "").
func TestNilifyEmptyStrings(t *testing.T) {
	empty := ""
	spaces := "   "
	value := " Bandung "
	name := ""

	a := models.Alumni{
		FullName:       "Siswa",
		BirthPlace:     &empty,     // "" -> nil
		Address:        &spaces,    // "   " -> nil
		ParentName:     &value,     // " Bandung " -> dipertahankan (non-kosong)
		FatherName:     &name,      // "" -> nil
		SiblingKandung: 2,          // int, bukan pointer -> tak terpengaruh
	}

	nilifyEmptyStrings(&a)

	if a.BirthPlace != nil {
		t.Fatalf("expected empty BirthPlace -> nil, got %#v", a.BirthPlace)
	}
	if a.Address != nil {
		t.Fatalf("expected whitespace Address -> nil, got %#v", a.Address)
	}
	if a.FatherName != nil {
		t.Fatalf("expected empty FatherName -> nil, got %#v", a.FatherName)
	}
	if a.ParentName == nil || *a.ParentName != " Bandung " {
		t.Fatalf("non-empty ParentName must be preserved, got %#v", a.ParentName)
	}
	if a.SiblingKandung != 2 {
		t.Fatalf("int field must be untouched, got %d", a.SiblingKandung)
	}
}
