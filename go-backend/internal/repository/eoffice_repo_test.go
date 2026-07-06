package repository

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupEOfficeTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		PRAGMA foreign_keys = ON;

		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT,
			email TEXT,
			role TEXT,
			full_name TEXT
		);

		CREATE TABLE klasifikasi_surat (
			code TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			is_active INTEGER DEFAULT 1
		);

		CREATE TABLE generated_letters (
			id TEXT PRIMARY KEY,
			letter_number TEXT,
			classification_code TEXT,
			sequence_number INTEGER,
			recipient TEXT,
			template_id TEXT,
			created_at INTEGER
		);

		CREATE TABLE letter_templates (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			category TEXT,
			content TEXT,
			file_path TEXT,
			type TEXT,
			paper_size TEXT,
			orientation TEXT,
			is_active INTEGER DEFAULT 1,
			classification_code TEXT,
			letter_number_format TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);

		CREATE TABLE school_settings (
			id TEXT PRIMARY KEY,
			school_name TEXT,
			last_letter_number INTEGER DEFAULT 0,
			letter_number_format TEXT,
			updated_at INTEGER
		);

		CREATE TABLE surat_keluar (
			id TEXT PRIMARY KEY,
			mail_number TEXT NOT NULL UNIQUE,
			recipient TEXT NOT NULL,
			subject TEXT NOT NULL,
			date_of_letter TEXT NOT NULL,
			classification_code TEXT,
			file_path TEXT,
			final_file_path TEXT,
			status TEXT DEFAULT 'Draft' NOT NULL,
			agenda_number TEXT,
			verified_by TEXT,
			verified_at INTEGER,
			digital_signature TEXT,
			revision_note TEXT,
			template_id TEXT,
			created_by TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			FOREIGN KEY (classification_code) REFERENCES klasifikasi_surat(code),
			FOREIGN KEY (created_by) REFERENCES users(id)
		);

		CREATE TABLE surat_masuk (
			id TEXT PRIMARY KEY,
			agenda_number TEXT NOT NULL UNIQUE,
			original_number TEXT NOT NULL,
			sender TEXT NOT NULL,
			subject TEXT NOT NULL,
			date_of_letter TEXT NOT NULL,
			received_at INTEGER NOT NULL,
			classification_code TEXT,
			file_path TEXT NOT NULL,
			status TEXT DEFAULT 'Menunggu Disposisi' NOT NULL,
			notes TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			FOREIGN KEY (classification_code) REFERENCES klasifikasi_surat(code)
		);

		CREATE TABLE disposisi (
			id TEXT PRIMARY KEY,
			surat_masuk_id TEXT NOT NULL,
			from_user_id TEXT NOT NULL,
			to_user_id TEXT NOT NULL,
			instruction TEXT NOT NULL,
			deadline TEXT,
			is_completed BOOLEAN DEFAULT 0 NOT NULL,
			completed_at INTEGER,
			completed_note TEXT,
			created_at INTEGER,
			FOREIGN KEY (surat_masuk_id) REFERENCES surat_masuk(id),
			FOREIGN KEY (from_user_id) REFERENCES users(id),
			FOREIGN KEY (to_user_id) REFERENCES users(id)
		);

		INSERT INTO users (id, name, email, role, full_name) VALUES
			('u-admin', 'Admin', 'admin@sekolah.sch.id', 'ADMIN', 'Admin Sekolah'),
			('u-staff', 'Staff', 'staff@sekolah.sch.id', 'STAFF', 'Staff TU');

		INSERT INTO klasifikasi_surat (code, name, description, is_active)
		VALUES ('421', 'Kurikulum', 'Administrasi kurikulum', 1);

		INSERT INTO school_settings (id, school_name, last_letter_number, letter_number_format, updated_at)
		VALUES ('settings-1', 'SDN 1 Kenanga', 41, '421/{nomor}/SDN1-KNG/{bulan}/{tahun}', 0);
	`)
	if err != nil {
		t.Fatalf("failed to create e-office schema: %v", err)
	}

	return db
}

func TestEOfficeRepositoryTemplateVariablesAndUpdate(t *testing.T) {
	db := setupEOfficeTestDB(t)
	defer db.Close()
	repo := NewEOfficeRepository(db)

	content := `<p>{{siswa_nama}} {{ tanggal_surat }} {{siswa_nama}}</p>`
	templateID, err := repo.CreateLetterTemplate(models.LetterTemplate{
		Name:      "Surat Keterangan",
		Category:  "STUDENT",
		Type:      "EDITOR",
		Content:   &content,
		PaperSize: "A4",
	})
	if err != nil {
		t.Fatalf("CreateLetterTemplate returned error: %v", err)
	}

	variables, err := repo.GetTemplateVariables(templateID)
	if err != nil {
		t.Fatalf("GetTemplateVariables returned error: %v", err)
	}
	if len(variables) != 2 || variables[0] != "siswa_nama" || variables[1] != "tanggal_surat" {
		t.Fatalf("unexpected variables: %#v", variables)
	}

	updatedContent := `["guru_nama","nomor_surat_otomatis"]`
	if err := repo.UpdateLetterTemplate(templateID, models.LetterTemplate{
		Name:    "Surat GTK",
		Content: &updatedContent,
	}); err != nil {
		t.Fatalf("UpdateLetterTemplate returned error: %v", err)
	}

	updated, err := repo.GetLetterTemplateByID(templateID)
	if err != nil {
		t.Fatalf("GetLetterTemplateByID returned error: %v", err)
	}
	if updated.Name != "Surat GTK" || updated.Category != "STUDENT" {
		t.Fatalf("expected update to preserve unspecified fields, got name=%s category=%s", updated.Name, updated.Category)
	}

	variables, err = repo.GetTemplateVariables(templateID)
	if err != nil {
		t.Fatalf("GetTemplateVariables after update returned error: %v", err)
	}
	if len(variables) != 2 || variables[0] != "guru_nama" || variables[1] != "nomor_surat_otomatis" {
		t.Fatalf("unexpected JSON variables: %#v", variables)
	}
}

func TestEOfficeRepositoryGeneralLetterNumbering(t *testing.T) {
	db := setupEOfficeTestDB(t)
	defer db.Close()
	repo := NewEOfficeRepository(db)

	next, err := repo.CalculateNextLetterSequence(models.NumberingRequest{})
	if err != nil {
		t.Fatalf("CalculateNextLetterSequence returned error: %v", err)
	}
	if next != 42 {
		t.Fatalf("expected next sequence 42, got %d", next)
	}

	recipient := "Komite Sekolah"
	if err := repo.IncrementLetterSequence(models.IncrementRequest{
		LetterNumber:   "421/042/SDN1-KNG/V/2026",
		SequenceNumber: 42,
		Recipient:      &recipient,
	}); err != nil {
		t.Fatalf("IncrementLetterSequence returned error: %v", err)
	}

	next, err = repo.CalculateNextLetterSequence(models.NumberingRequest{})
	if err != nil {
		t.Fatalf("CalculateNextLetterSequence after increment returned error: %v", err)
	}
	if next != 43 {
		t.Fatalf("expected next sequence 43, got %d", next)
	}
}

func strPtr(value string) *string {
	return &value
}

func TestEOfficeRepositoryIncomingDispositionFlow(t *testing.T) {
	db := setupEOfficeTestDB(t)
	defer db.Close()
	repo := NewEOfficeRepository(db)

	receivedAt := time.Date(2026, time.May, 26, 9, 0, 0, 0, time.UTC)
	suratID, err := repo.CreateSuratMasuk(models.SuratMasuk{
		OriginalNumber:     "123/UND/V/2026",
		Sender:             "Dinas Pendidikan",
		Subject:            "Undangan rapat",
		DateOfLetter:       "2026-05-25",
		ReceivedAt:         &receivedAt,
		ClassificationCode: strPtr("421"),
		FilePath:           "/uploads/arsip/surat-masuk/test.pdf",
	})
	if err != nil {
		t.Fatalf("CreateSuratMasuk returned error: %v", err)
	}

	letter, err := repo.GetSuratMasukByID(suratID)
	if err != nil {
		t.Fatalf("GetSuratMasukByID returned error: %v", err)
	}
	if letter.AgendaNumber != "SM-2026-0001" {
		t.Fatalf("expected generated agenda SM-2026-0001, got %s", letter.AgendaNumber)
	}
	if len(letter.Dispositions) != 0 {
		t.Fatalf("expected no dispositions initially, got %d", len(letter.Dispositions))
	}

	if _, err := repo.CreateDisposisi(models.Disposisi{
		SuratMasukID: suratID,
		FromUserID:   "u-admin",
		ToUserID:     "u-staff",
		Instruction:  "Mohon tindak lanjuti",
	}); err != nil {
		t.Fatalf("CreateDisposisi returned error: %v", err)
	}

	letter, err = repo.GetSuratMasukByID(suratID)
	if err != nil {
		t.Fatalf("GetSuratMasukByID after disposition returned error: %v", err)
	}
	if letter.Status != "Terdisposisi" {
		t.Fatalf("expected status Terdisposisi, got %s", letter.Status)
	}
	if len(letter.Dispositions) != 1 {
		t.Fatalf("expected one disposition, got %d", len(letter.Dispositions))
	}
	if letter.Dispositions[0].FromUser == nil || letter.Dispositions[0].FromUser.FullName == nil || *letter.Dispositions[0].FromUser.FullName != "Admin Sekolah" {
		t.Fatalf("expected disposition sender user to be populated")
	}
}

func TestEOfficeRepositoryOutgoingArchiveFlow(t *testing.T) {
	db := setupEOfficeTestDB(t)
	defer db.Close()
	repo := NewEOfficeRepository(db)

	suratID, mailNumber, err := repo.CreateSuratKeluar(models.SuratKeluar{
		Recipient:          "Komite Sekolah",
		Subject:            "Pemberitahuan kegiatan",
		DateOfLetter:       "2026-05-26",
		ClassificationCode: strPtr("421"),
		CreatedBy:          strPtr("u-admin"),
	})
	if err != nil {
		t.Fatalf("CreateSuratKeluar returned error: %v", err)
	}
	if !strings.HasPrefix(mailNumber, "421/001/SDN1-KNG/V/2026") {
		t.Fatalf("unexpected generated mail number: %s", mailNumber)
	}

	letter, err := repo.GetSuratKeluarByID(suratID)
	if err != nil {
		t.Fatalf("GetSuratKeluarByID returned error: %v", err)
	}
	if letter.Creator == nil || letter.Creator.FullName == nil || *letter.Creator.FullName != "Admin Sekolah" {
		t.Fatalf("expected creator to be populated")
	}

	if err := repo.UpdateSuratKeluarFinalFile(suratID, "/uploads/arsip/surat-keluar/final.pdf"); err != nil {
		t.Fatalf("UpdateSuratKeluarFinalFile returned error: %v", err)
	}

	letter, err = repo.GetSuratKeluarByID(suratID)
	if err != nil {
		t.Fatalf("GetSuratKeluarByID after final upload returned error: %v", err)
	}
	if letter.Status != "Arsip" {
		t.Fatalf("expected status Arsip, got %s", letter.Status)
	}
	if letter.FinalFilePath == nil || *letter.FinalFilePath != "/uploads/arsip/surat-keluar/final.pdf" {
		t.Fatalf("expected final PDF path to be stored")
	}
}

func TestExtractSequenceNumber(t *testing.T) {
	tests := []struct {
		mailNumber string
		classCode  string
		expected   int
	}{
		{"400.3.5/50-SD", "400.3.5", 50},
		{"400.3.5/050-SD", "400.3.5", 50},
		{"055/400.3.5.02/SDN1-KNG/VI/2026", "400.3.5.02", 55},
		{"421/050/SDN1-KNG/VI/2026", "421", 50},
		{"50/055-SD", "055", 50},
		{"055/50-SD", "055", 50},
		{"055.2/50-SD", "055.2", 50},
		{"", "400.3.5", 1},
		{"InvalidFormat", "400.3.5", 1},
	}

	for _, tc := range tests {
		t.Run(tc.mailNumber+"_with_"+tc.classCode, func(t *testing.T) {
			res := extractSequenceNumber(tc.mailNumber, tc.classCode)
			if res != tc.expected {
				t.Errorf("extractSequenceNumber(%q, %q) = %d; want %d", tc.mailNumber, tc.classCode, res, tc.expected)
			}
		})
	}
}

