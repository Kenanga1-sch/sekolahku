package repository

import (
	"database/sql"
	"errors"
	"strings"
)

// PersonIdentity adalah hasil resolusi satu kode scan menjadi orang nyata —
// siswa ATAU GTK. Dipakai semua modul ber-basis scan (perpustakaan, tabungan,
// presensi) supaya kartu GTK dikenali sama seperti kartu siswa.
type PersonIdentity struct {
	Kind       string // "student" | "staff"
	StudentID  string // bila Kind == "student"
	EmployeeID string // bila Kind == "staff"
	UserID     string // staff: akun ter-link (boleh kosong bila belum dibuat)
	Name       string
	ClassName  string // student saja
	Category   string // staff: guru/kepsek/staff/support
	QrCode     string
	IsActive   bool
}

// ResolvePersonByCode mengubah satu kode hasil scan (QR/NISN/NIS/id untuk
// siswa; qr_code/NIP/NUPTK/id untuk GTK) menjadi identitas orang. Urutan:
// siswa dulu (kode siswa yang ambigu tetap prioritas siswa), baru GTK.
// Mengembalikan sql.ErrNoRows bila tidak dikenali.
func ResolvePersonByCode(db *sql.DB, code string) (*PersonIdentity, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, sql.ErrNoRows
	}

	// 1) Siswa — multi-cocok sama seperti scanner lama.
	var sid, sName, sClass, sQr sql.NullString
	var sActive int
	err := db.QueryRow(`
		SELECT id, full_name, COALESCE(class_name, ''), COALESCE(qr_code, ''),
		       CASE WHEN (status = 'active' OR status = 'aktif' OR is_active = 1) THEN 1 ELSE 0 END
		FROM students
		WHERE id = ? OR qr_code = ? OR nisn = ? OR nis = ?
		LIMIT 1
	`, code, code, code, code).Scan(&sid, &sName, &sClass, &sQr, &sActive)
	if err == nil && sid.Valid {
		return &PersonIdentity{
			Kind:      "student",
			StudentID: sid.String,
			Name:      sName.String,
			ClassName: sClass.String,
			QrCode:    sQr.String,
			IsActive:  sActive == 1,
		}, nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	// 2) GTK — qr_code (GTK-…) / NIP / NUPTK / id. employee_details tidak punya
	// kolom status; keberadaan baris = dianggap aktif (siap discan).
	var eid, eName, eQr, eCat, eUser sql.NullString
	err = db.QueryRow(`
		SELECT ed.id, COALESCE(ed.name, ''), COALESCE(ed.qr_code, ''),
		       COALESCE(ed.category, ''), COALESCE(ed.user_id, '')
		FROM employee_details ed
		WHERE ed.qr_code = ? OR ed.nip = ? OR ed.nuptk = ? OR ed.id = ?
		LIMIT 1
	`, code, code, code, code).Scan(&eid, &eName, &eQr, &eCat, &eUser)
	if err == nil && eid.Valid {
		return &PersonIdentity{
			Kind:       "staff",
			EmployeeID: eid.String,
			UserID:     eUser.String,
			Name:       eName.String,
			Category:   eCat.String,
			QrCode:     eQr.String,
			IsActive:   true,
		}, nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	return nil, sql.ErrNoRows
}
