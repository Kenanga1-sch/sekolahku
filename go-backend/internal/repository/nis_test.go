package repository

import (
	"database/sql"
	"fmt"
	"testing"

	_ "modernc.org/sqlite"
)

func setupNISTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	_, err = db.Exec(`
		CREATE TABLE student_classes (
			id TEXT PRIMARY KEY,
			name TEXT,
			grade INTEGER,
			academic_year TEXT
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			full_name TEXT,
			nis TEXT UNIQUE,
			class_id TEXT,
			updated_at INTEGER
		);
		CREATE TABLE academic_years (
			id TEXT PRIMARY KEY,
			name TEXT,
			is_active INTEGER DEFAULT 0
		);
		CREATE TABLE school_settings (
			id TEXT PRIMARY KEY,
			current_academic_year TEXT
		);
	`)
	if err != nil {
		t.Fatalf("schema: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func insertNISStudent(t *testing.T, db *sql.DB, id, name, nis, classID string) {
	t.Helper()
	var nisArg interface{}
	if nis != "" {
		nisArg = nis
	}
	var classArg interface{}
	if classID != "" {
		classArg = classID
	}
	if _, err := db.Exec(`INSERT INTO students (id, full_name, nis, class_id) VALUES (?, ?, ?, ?)`, id, name, nisArg, classArg); err != nil {
		t.Fatalf("insert student %s: %v", id, err)
	}
}

func TestNISDestinationPrefix(t *testing.T) {
	got, err := nisDestinationPrefix("2026/2027", 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "262702" {
		t.Fatalf("expected 262702, got %s", got)
	}
}

func TestCohortPrefixes(t *testing.T) {
	got, err := cohortPrefixes("2026/2027", 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"252601", "262702"}
	if len(got) != len(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("expected %v, got %v", want, got)
		}
	}
}

func TestNextNIS_EmptyClassStartsAt001(t *testing.T) {
	db := setupNISTestDB(t)
	if _, err := db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1', 'Kelas 1', 1, '2026/2027')`); err != nil {
		t.Fatal(err)
	}
	got, err := NextNIS(db, "2026/2027", 1, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if got != "262701001" {
		t.Fatalf("expected 262701001, got %s", got)
	}
}

func TestNextNIS_ContinuesExistingCohort(t *testing.T) {
	db := setupNISTestDB(t)
	if _, err := db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c2', 'Kelas 2', 2, '2026/2027')`); err != nil {
		t.Fatal(err)
	}
	// Angkatan yang kini di kelas 2 masuk saat kelas 1 di 2025/2026.
	for i, name := range []string{"ADHNAN", "ADRIAN", "AIRA"} {
		insertNISStudent(t, db, name, name, "25260100"+string(rune('1'+i)), "c2")
	}
	got, err := NextNIS(db, "2026/2027", 2, "c2")
	if err != nil {
		t.Fatal(err)
	}
	if got != "262702004" {
		t.Fatalf("expected 262702004, got %s", got)
	}
}

func TestNextNIS_MutationExample(t *testing.T) {
	db := setupNISTestDB(t)
	if _, err := db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c2', 'Kelas 2', 2, '2026/2027')`); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 28; i++ {
		nis := "252601" + pad3(i)
		insertNISStudent(t, db, nis, "Siswa "+nis, nis, "c2")
	}
	got, err := NextNIS(db, "2026/2027", 2, "c2")
	if err != nil {
		t.Fatal(err)
	}
	if got != "262702029" {
		t.Fatalf("expected 262702029, got %s", got)
	}
}

func TestNextNIS_DoesNotReuseNumberAfterStudentLeaves(t *testing.T) {
	db := setupNISTestDB(t)
	if _, err := db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c2', 'Kelas 2', 2, '2026/2027')`); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 28; i++ {
		nis := "252601" + pad3(i)
		insertNISStudent(t, db, nis, "Siswa "+nis, nis, "c2")
	}
	// Siswa pemegang 029 pindah: class_id dikosongkan, NIS tetap tersimpan.
	insertNISStudent(t, db, "gone", "Siswa Pindah", "252601029", "")

	got, err := NextNIS(db, "2026/2027", 2, "c2")
	if err != nil {
		t.Fatal(err)
	}
	if got != "262702030" {
		t.Fatalf("expected 262702030 (029 tidak boleh dipakai ulang), got %s", got)
	}
}

func TestIssueNISForClass_OrderedByName(t *testing.T) {
	db := setupNISTestDB(t)
	if _, err := db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1', 'Kelas 1', 1, '2026/2027')`); err != nil {
		t.Fatal(err)
	}
	insertNISStudent(t, db, "s3", "Cici", "", "c1")
	insertNISStudent(t, db, "s1", "Andi", "", "c1")
	insertNISStudent(t, db, "s2", "Budi", "", "c1")

	assignments, err := IssueNISForClass(db, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if len(assignments) != 3 {
		t.Fatalf("expected 3 assignments, got %d", len(assignments))
	}
	want := map[string]string{"s1": "262701001", "s2": "262701002", "s3": "262701003"}
	for _, a := range assignments {
		if want[a.StudentID] != a.NIS {
			t.Fatalf("student %s got %s, want %s", a.StudentID, a.NIS, want[a.StudentID])
		}
	}
}

func TestIssueNISForClass_SkipsExistingNIS(t *testing.T) {
	db := setupNISTestDB(t)
	if _, err := db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1', 'Kelas 1', 1, '2026/2027')`); err != nil {
		t.Fatal(err)
	}
	insertNISStudent(t, db, "s1", "Andi", "262701001", "c1")
	insertNISStudent(t, db, "s2", "Budi", "", "c1")
	insertNISStudent(t, db, "s3", "Cici", "", "c1")

	assignments, err := IssueNISForClass(db, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if len(assignments) != 2 {
		t.Fatalf("expected 2 assignments, got %d", len(assignments))
	}
	got := map[string]string{}
	for _, a := range assignments {
		got[a.StudentID] = a.NIS
	}
	if got["s2"] != "262701002" || got["s3"] != "262701003" {
		t.Fatalf("unexpected assignments: %#v", got)
	}

	// NIS lama tidak boleh berubah.
	var nis string
	if err := db.QueryRow(`SELECT nis FROM students WHERE id = 's1'`).Scan(&nis); err != nil {
		t.Fatal(err)
	}
	if nis != "262701001" {
		t.Fatalf("existing NIS changed to %s", nis)
	}
}

func TestPreviewNIS_UsesClassAcademicYear(t *testing.T) {
	db := setupNISTestDB(t)
	if _, err := db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1', 'Kelas 1', 1, '2026/2027')`); err != nil {
		t.Fatal(err)
	}
	got, err := PreviewNIS(db, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if got != "262701001" {
		t.Fatalf("expected 262701001, got %s", got)
	}
}

func TestNextNIS_InvalidAcademicYear(t *testing.T) {
	db := setupNISTestDB(t)
	if _, err := NextNIS(db, "", 1, "c1"); err == nil {
		t.Fatal("expected error for empty academic year")
	}
}

func pad3(n int) string {
	return fmt.Sprintf("%03d", n)
}
