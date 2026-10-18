package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Aturan NIS (Nomor Induk Siswa):
//
//	NIS = YY1YY2 + GG + NNN   (9 karakter)
//
// YY1YY2 = pasangan tahun ajaran saat siswa masuk (mis. 2026/2027 -> "2627")
// GG     = tingkat/grade saat masuk (mis. kelas 1 -> "01")
// NNN    = nomor urut 3 digit, tidak pernah dipakai ulang
//
// Siswa baru kelas 1 diurutkan menurut nama (A -> 001). Siswa mutasi masuk
// memakai tahun+grade saat ia bergabung dan melanjutkan nomor urut tertinggi
// yang pernah dipakai oleh angkatan (cohort) tersebut.
//
// Nomor urut dicari dengan memindai semua NIS yang berbagi prefix angkatan
// (termasuk siswa yang sudah pindah / tidak naik kelas) sehingga nomor yang
// pernah terpakai tidak pernah dipakai ulang.

// NISQueryer cukup untuk operasi NIS: baca banyak baris + tulis. Dipenuhi oleh
// *sql.DB maupun *sql.Tx.
type NISQueryer interface {
	Query(query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(query string, args ...interface{}) *sql.Row
	Exec(query string, args ...interface{}) (sql.Result, error)
}

// NISAssignment adalah hasil penerbitan NIS untuk satu siswa.
type NISAssignment struct {
	StudentID string `json:"studentId"`
	FullName  string `json:"fullName"`
	NIS       string `json:"nis"`
}

// academicYearStartYear mengambil tahun pertama dari nama tahun ajaran,
// mis. "2026/2027" -> 2026, "2026" -> 2026.
func academicYearStartYear(academicYear string) (int, error) {
	academicYear = strings.TrimSpace(academicYear)
	if academicYear == "" {
		return 0, fmt.Errorf("tahun ajaran kosong")
	}
	first := academicYear
	if idx := strings.IndexAny(academicYear, "/-"); idx > 0 {
		first = academicYear[:idx]
	}
	year, err := strconv.Atoi(strings.TrimSpace(first))
	if err != nil || year < 1900 || year > 3000 {
		return 0, fmt.Errorf("tahun ajaran tidak valid: %q", academicYear)
	}
	return year, nil
}

// nisDestinationPrefix membentuk prefix YY1YY2+GG tujuan (mis. "262702").
func nisDestinationPrefix(academicYear string, grade int) (string, error) {
	if grade < 1 || grade > 12 {
		return "", fmt.Errorf("tingkat kelas tidak valid: %d", grade)
	}
	startYear, err := academicYearStartYear(academicYear)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%02d%02d%02d", startYear%100, (startYear+1)%100, grade), nil
}

// cohortPrefixes membangun daftar prefix angkatan untuk kelas tujuan.
// Angkatan yang sekarang duduk di tingkat `grade` pada tahun ajaran
// `academicYear` masuk sebagai kelas 1 pada tahun ajaran sebelumnya
// (grade-1). Prefix setiap tingkat di sepanjang perjalanan angkatan itulah
// yang dianggap satu ruang nomor urut.
func cohortPrefixes(academicYear string, grade int) ([]string, error) {
	startYear, err := academicYearStartYear(academicYear)
	if err != nil {
		return nil, err
	}
	entryYear := startYear - (grade - 1)
	prefixes := make([]string, 0, grade)
	for g := 1; g <= grade; g++ {
		ay := entryYear + (g - 1)
		prefixes = append(prefixes, fmt.Sprintf("%02d%02d%02d", ay%100, (ay+1)%100, g))
	}
	return prefixes, nil
}

// parseNISSequence mengambil nomor urut 3 digit terakhir dari sebuah NIS.
// Mengembalikan ok=false bila tidak dapat diparse.
func parseNISSequence(nis string) (int, bool) {
	nis = strings.TrimSpace(nis)
	if len(nis) < 3 {
		return 0, false
	}
	seq, err := strconv.Atoi(nis[len(nis)-3:])
	if err != nil || seq < 0 {
		return 0, false
	}
	return seq, true
}

// maxNISSequence memindai NIS angkatan (semua prefix cohort) plus seluruh
// anggota kelas saat ini, lalu mengembalikan nomor urut tertinggi yang pernah
// dipakai. Bila belum ada, hasilnya 0.
func maxNISSequence(q NISQueryer, prefixes []string, classID string) (int, error) {
	conditions := make([]string, 0, len(prefixes)+1)
	args := make([]interface{}, 0, len(prefixes)+1)
	for _, prefix := range prefixes {
		conditions = append(conditions, "nis LIKE ?")
		args = append(args, prefix+"%")
	}
	if strings.TrimSpace(classID) != "" {
		conditions = append(conditions, "class_id = ?")
		args = append(args, classID)
	}
	if len(conditions) == 0 {
		return 0, nil
	}

	query := "SELECT COALESCE(nis, '') FROM students WHERE (" + strings.Join(conditions, " OR ") + ")"
	rows, err := q.Query(query, args...)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	max := 0
	for rows.Next() {
		var nis string
		if err := rows.Scan(&nis); err != nil {
			return 0, err
		}
		if seq, ok := parseNISSequence(nis); ok && seq > max {
			max = seq
		}
	}
	return max, rows.Err()
}

func resolveClassAcademicYear(q NISQueryer, classID string) (string, int, error) {
	classID = strings.TrimSpace(classID)
	if classID == "" {
		return "", 0, fmt.Errorf("kelas wajib dipilih")
	}
	var academicYear sql.NullString
	var grade sql.NullInt64
	if err := q.QueryRow("SELECT academic_year, grade FROM student_classes WHERE id = ?", classID).Scan(&academicYear, &grade); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", 0, fmt.Errorf("kelas tidak ditemukan")
		}
		return "", 0, err
	}
	ay := ""
	if academicYear.Valid {
		ay = strings.TrimSpace(academicYear.String)
	}
	if ay == "" {
		ay = activeAcademicYear(q)
	}
	return ay, int(grade.Int64), nil
}

// activeAcademicYear mencari tahun ajaran aktif; dipakai sebagai fallback
// ketika master kelas belum menyimpan tahun ajaran.
func activeAcademicYear(q NISQueryer) string {
	var name string
	if err := q.QueryRow("SELECT name FROM academic_years WHERE is_active = 1 LIMIT 1").Scan(&name); err == nil && strings.TrimSpace(name) != "" {
		return strings.TrimSpace(name)
	}
	var fallback sql.NullString
	if err := q.QueryRow("SELECT current_academic_year FROM school_settings LIMIT 1").Scan(&fallback); err == nil && fallback.Valid && strings.TrimSpace(fallback.String) != "" {
		return strings.TrimSpace(fallback.String)
	}
	y := CurrentYearJakarta()
	if NowJakarta().Month() >= 7 {
		return fmt.Sprintf("%d/%d", y, y+1)
	}
	return fmt.Sprintf("%d/%d", y-1, y)
}

// NextNIS menghitung NIS berikutnya untuk seorang siswa yang masuk ke `classID`
// pada tingkat `grade` dan tahun ajaran `academicYear`.
func NextNIS(q NISQueryer, academicYear string, grade int, classID string) (string, error) {
	prefix, nextSeq, err := nextNISSequence(q, academicYear, grade, classID)
	if err != nil {
		return "", err
	}
	return prefix + fmt.Sprintf("%03d", nextSeq), nil
}

// nextNISSequence mengembalikan prefix tujuan dan nomor urut berikutnya.
func nextNISSequence(q NISQueryer, academicYear string, grade int, classID string) (string, int, error) {
	prefix, err := nisDestinationPrefix(academicYear, grade)
	if err != nil {
		return "", 0, err
	}
	prefixes, err := cohortPrefixes(academicYear, grade)
	if err != nil {
		return "", 0, err
	}
	max, err := maxNISSequence(q, prefixes, classID)
	if err != nil {
		return "", 0, err
	}
	next := max + 1
	if next > 999 {
		return "", 0, fmt.Errorf("nomor urut NIS untuk tingkat %d sudah penuh (999)", grade)
	}
	return prefix, next, nil
}

// PreviewNIS menghitung NIS berikutnya untuk sebuah kelas (tanpa menyimpan).
func PreviewNIS(q NISQueryer, classID string) (string, error) {
	academicYear, grade, err := resolveClassAcademicYear(q, classID)
	if err != nil {
		return "", err
	}
	return NextNIS(q, academicYear, grade, classID)
}

// IssueNISForClass menerbitkan NIS untuk SEMUA siswa di kelas yang belum
// memiliki NIS, diurutkan menurut nama (A -> nomor terkecil). NIS yang sudah
// ada tidak pernah ditimpa.
func IssueNISForClass(q NISQueryer, classID string) ([]NISAssignment, error) {
	classID = strings.TrimSpace(classID)
	academicYear, grade, err := resolveClassAcademicYear(q, classID)
	if err != nil {
		return nil, err
	}
	prefix, nextSeq, err := nextNISSequence(q, academicYear, grade, classID)
	if err != nil {
		return nil, err
	}

	rows, err := q.Query(`
		SELECT id, full_name FROM students
		WHERE class_id = ? AND (nis IS NULL OR TRIM(nis) = '')
		ORDER BY full_name COLLATE NOCASE ASC, id ASC
	`, classID)
	if err != nil {
		return nil, err
	}
	type pending struct {
		id   string
		name string
	}
	var list []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.name); err != nil {
			rows.Close()
			return nil, err
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	assignments := make([]NISAssignment, 0, len(list))
	for _, p := range list {
		if nextSeq > 999 {
			return nil, fmt.Errorf("nomor urut NIS untuk tingkat %d sudah penuh (999)", grade)
		}
		nis := prefix + fmt.Sprintf("%03d", nextSeq)
		res, err := q.Exec(`
			UPDATE students SET nis = ?, updated_at = ?
			WHERE id = ? AND (nis IS NULL OR TRIM(nis) = '')
		`, nis, time.Now().UnixMilli(), p.id)
		if err != nil {
			return nil, err
		}
		if affected, _ := res.RowsAffected(); affected == 0 {
			// Siswa sudah punya NIS (mis. diisi bersamaan) -> lewati, jangan
			// pakai nomor urut ini.
			continue
		}
		assignments = append(assignments, NISAssignment{StudentID: p.id, FullName: p.name, NIS: nis})
		nextSeq++
	}
	return assignments, nil
}

// NextNISForStudent menghitung NIS berikutnya untuk seorang siswa baru
// berdasarkan kelas yang dipilih. classID boleh kosong (maka error).
func (r *StudentRepository) NextNISForStudent(classID string) (string, error) {
	return PreviewNIS(r.DB, classID)
}

// IssueNISForClass menerbitkan NIS untuk seluruh siswa di kelas dalam satu
// transaksi.
func (r *StudentRepository) IssueNISForClass(classID string) ([]NISAssignment, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	assignments, err := IssueNISForClass(tx, classID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return assignments, nil
}
