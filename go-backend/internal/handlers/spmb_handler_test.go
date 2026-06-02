package handlers

import (
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
)

func TestNormalizeSPMBRegistrantPayloadAcceptsSnakeCaseFormFields(t *testing.T) {
	var reg models.SPMBRegistrant
	raw := map[string]interface{}{
		"full_name":          "Calon Siswa",
		"student_nik":        "321",
		"kk_number":          "654",
		"birth_place":        "Indramayu",
		"birth_date":         "2020-04-05",
		"distance_to_school": 4.75,
		"is_within_zone":     false,
		"address_street":     "Blok Dukuh",
		"address_rt":         "001",
		"address_rw":         "002",
		"address_village":    "Kenanga",
		"parent_phone":       "081234567890",
		"father_name":        "Ayah Siswa",
		"mother_name":        "Ibu Siswa",
		"has_kps_pkh":        true,
		"has_kip":            false,
	}

	normalizeSPMBRegistrantPayload(&reg, raw)

	if reg.FullName != "Calon Siswa" || reg.StudentNIK != "321" || reg.KKNumber != "654" {
		t.Fatalf("student identity was not normalized: %+v", reg)
	}
	if reg.BirthPlace != "Indramayu" || reg.BirthDate != "2020-04-05" {
		t.Fatalf("birth data was not normalized: %+v", reg)
	}
	if reg.DistanceKM != 4.75 {
		t.Fatalf("distance was not normalized: %v", reg.DistanceKM)
	}
	if reg.HomeAddress == "" || reg.AddressVillage != "Kenanga" {
		t.Fatalf("address was not normalized: %+v", reg)
	}
	if reg.ParentPhone != "081234567890" || reg.FatherName != "Ayah Siswa" || reg.MotherName != "Ibu Siswa" {
		t.Fatalf("parent data was not normalized: %+v", reg)
	}
	if !reg.HasKPS || reg.HasKIP {
		t.Fatalf("assistance flags were not normalized: hasKPS=%v hasKIP=%v", reg.HasKPS, reg.HasKIP)
	}
}
