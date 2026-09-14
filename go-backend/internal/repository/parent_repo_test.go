package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupParentTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	stmts := []string{
		`CREATE TABLE students (id TEXT PRIMARY KEY, full_name TEXT, nisn TEXT, class_id TEXT, class_name TEXT, photo TEXT, birth_date TEXT, status TEXT, is_active INTEGER DEFAULT 1)`,
		`CREATE TABLE tabungan_siswa (id TEXT PRIMARY KEY, student_id TEXT, saldo_terakhir INTEGER DEFAULT 0)`,
		`CREATE TABLE parent_students (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, student_id TEXT NOT NULL, relation TEXT DEFAULT 'orangtua', is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER, UNIQUE(user_id, student_id))`,
		`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, username TEXT)`,
		`CREATE TABLE leave_requests (id TEXT PRIMARY KEY, student_id TEXT, parent_user_id TEXT, type TEXT DEFAULT 'izin', start_date TEXT, end_date TEXT, reason TEXT, attachment_path TEXT, status TEXT DEFAULT 'pending', reviewed_by TEXT, reviewed_at INTEGER, review_note TEXT, created_at INTEGER, updated_at INTEGER)`,
		`INSERT INTO students (id, full_name, nisn, class_id, class_name, birth_date, status, is_active) VALUES ('st1','Ani Lestari','1234567890','c1','Kelas 1','2018-05-01','active',1)`,
		`INSERT INTO students (id, full_name, nisn, class_name, birth_date, status, is_active) VALUES ('st2','Budi Santoso','1234567891','Kelas 2','2017-03-02','active',1)`,
		`INSERT INTO tabungan_siswa (id, student_id, saldo_terakhir) VALUES ('ts1','st1', 75000)`,
		`INSERT INTO users (id, name, phone, username) VALUES ('pu1','Bapak Ani','081234567890','081234567890')`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec %q: %v", s, err)
		}
	}
	return db
}

func TestParentLinkDanChildren(t *testing.T) {
	db := setupParentTestDB(t)
	defer db.Close()
	repo := NewParentRepository(db)

	if err := repo.LinkParent("pu1", "st1", "ayah"); err != nil {
		t.Fatalf("link: %v", err)
	}
	// LinkParent idempoten (tidak menggandakan).
	if err := repo.LinkParent("pu1", "st1", "ayah"); err != nil {
		t.Fatalf("link2: %v", err)
	}
	ok, err := repo.IsParentOf("pu1", "st1")
	if err != nil || !ok {
		t.Fatalf("IsParentOf harus true: %v %v", ok, err)
	}
	notParent, _ := repo.IsParentOf("pu1", "st2")
	if notParent {
		t.Fatal("bukan ortu st2")
	}

	children, err := repo.GetChildrenByUser("pu1")
	if err != nil || len(children) != 1 {
		t.Fatalf("children: %d %v", len(children), err)
	}
	c := children[0]
	if c.FullName != "Ani Lestari" || c.ClassName != "Kelas 1" || c.Balance != 75000 || c.Relation != "ayah" {
		t.Fatalf("data anak salah: %+v", c)
	}

	// Unlink menonaktifkan.
	if err := repo.UnlinkParent("pu1", "st1"); err != nil {
		t.Fatal(err)
	}
	ok, _ = repo.IsParentOf("pu1", "st1")
	if ok {
		t.Fatal("setelah unlink tidak boleh jadi ortu aktif")
	}
	children, _ = repo.GetChildrenByUser("pu1")
	if len(children) != 0 {
		t.Fatal("anak harus kosong setelah unlink")
	}
}

func TestParentFindStudentDanPhone(t *testing.T) {
	db := setupParentTestDB(t)
	defer db.Close()
	repo := NewParentRepository(db)

	id, name, err := repo.FindStudentForRegistration("1234567890", "2018-05-01")
	if err != nil || id != "st1" || name != "Ani Lestari" {
		t.Fatalf("verifikasi siswa: %q %q %v", id, name, err)
	}
	// Tanggal lahir salah -> tidak ketemu (tanpa error).
	id, _, err = repo.FindStudentForRegistration("1234567890", "2018-01-01")
	if err != nil || id != "" {
		t.Fatalf("tanggal salah harus kosong: %q %v", id, err)
	}
	taken, _ := repo.PhoneTaken("081234567890")
	if !taken {
		t.Fatal("nomor terdaftar harus terdeteksi")
	}
	taken, _ = repo.PhoneTaken("089999999999")
	if taken {
		t.Fatal("nomor bebas tidak boleh terdeteksi")
	}
}

func TestParentLeaveFlow(t *testing.T) {
	db := setupParentTestDB(t)
	defer db.Close()
	repo := NewParentRepository(db)

	if err := repo.LinkParent("pu1", "st1", "ayah"); err != nil {
		t.Fatal(err)
	}
	id, err := repo.CreateLeave(models.LeaveRequest{
		StudentID: "st1", ParentUserID: "pu1", Type: "sakit",
		StartDate: "2026-09-14", EndDate: "2026-09-15", Reason: "demam tinggi",
	})
	if err != nil {
		t.Fatalf("create leave: %v", err)
	}

	list, _, err := repo.GetLeaveByParent("pu1", 20, 0)
	if err != nil || len(list) != 1 {
		t.Fatalf("leaves: %d %v", len(list), err)
	}
	if list[0].Status != "pending" || list[0].StudentName != "Ani Lestari" {
		t.Fatalf("leave salah: %+v", list[0])
	}

	if err := repo.UpdateLeaveStatus(id, "approved", "adm1", "semoga lekas sembang"); err != nil {
		t.Fatal(err)
	}
	lr, err := repo.GetLeaveByID(id)
	if err != nil || lr == nil || lr.Status != "approved" || lr.ReviewedBy == nil {
		t.Fatalf("review gagal: %+v %v", lr, err)
	}

	// Daftar untuk guru/admin.
	all, err := repo.ListLeaveRequests("approved", "Kelas 1")
	if err != nil || len(all) != 1 {
		t.Fatalf("list approved: %d %v", len(all), err)
	}
	none, _ := repo.ListLeaveRequests("pending", "")
	if len(none) != 0 {
		t.Fatal("tidak boleh ada pending")
	}

	// Fan-out user ortu.
	ids, _ := repo.GetParentUserIDs("st1")
	if len(ids) != 1 || ids[0] != "pu1" {
		t.Fatalf("parent ids: %v", ids)
	}
}
