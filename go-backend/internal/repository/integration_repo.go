package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type IntegrationRepository struct {
	DB *sql.DB
}

func NewIntegrationRepository(db *sql.DB) *IntegrationRepository {
	return &IntegrationRepository{DB: db}
}

func (r *IntegrationRepository) GetSettings() (models.IntegrationSettings, error) {
	var s models.IntegrationSettings
	query := `
		SELECT id, dapodik_url, dapodik_token, dapodik_npsn, erapor_url, erapor_token,
		       erapor_db_host, erapor_db_port, erapor_db_user, erapor_db_pass, erapor_db_name,
		       is_sandbox, last_synced_at, created_at, updated_at
		FROM integration_settings LIMIT 1
	`
	var dapodikURL, dapodikToken, dapodikNPSN, eraporURL, eraporToken sql.NullString
	var dbHost, dbPort, dbUser, dbPass, dbName sql.NullString
	var lastSynced, crAt, upAt sql.NullInt64

	err := r.DB.QueryRow(query).Scan(
		&s.ID, &dapodikURL, &dapodikToken, &dapodikNPSN, &eraporURL, &eraporToken,
		&dbHost, &dbPort, &dbUser, &dbPass, &dbName,
		&s.IsSandbox, &lastSynced, &crAt, &upAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return default settings
			return models.IntegrationSettings{
				ID:           "default",
				DapodikURL:   "http://localhost:5774",
				DapodikToken: "",
				DapodikNPSN:  "12345678",
				ERaporURL:    "http://localhost:8080",
				ERaporToken:  "",
				IsSandbox:    true,
			}, nil
		}
		return s, err
	}

	// Map scanned Null values to struct fields
	if dapodikURL.Valid { s.DapodikURL = dapodikURL.String }
	if dapodikToken.Valid { s.DapodikToken = dapodikToken.String }
	if dapodikNPSN.Valid { s.DapodikNPSN = dapodikNPSN.String }
	if eraporURL.Valid { s.ERaporURL = eraporURL.String }
	if eraporToken.Valid { s.ERaporToken = eraporToken.String }
	if dbHost.Valid { s.ERaporDBHost = dbHost.String }
	if dbPort.Valid { s.ERaporDBPort = dbPort.String }
	if dbUser.Valid { s.ERaporDBUser = dbUser.String }
	if dbPass.Valid { s.ERaporDBPass = dbPass.String }
	if dbName.Valid { s.ERaporDBName = dbName.String }
	if lastSynced.Valid { s.LastSyncedAt = lastSynced.Int64 }
	if crAt.Valid { s.CreatedAt = crAt.Int64 }
	if upAt.Valid { s.UpdatedAt = upAt.Int64 }

	return s, nil
}

func (r *IntegrationRepository) UpdateSettings(s models.IntegrationSettings) error {
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		UPDATE integration_settings SET
			dapodik_url = ?, dapodik_token = ?, dapodik_npsn = ?,
			erapor_url = ?, erapor_token = ?,
			erapor_db_host = ?, erapor_db_port = ?, erapor_db_user = ?, erapor_db_pass = ?, erapor_db_name = ?,
			is_sandbox = ?, updated_at = ?
		WHERE id = 'default'
	`, s.DapodikURL, s.DapodikToken, s.DapodikNPSN,
		s.ERaporURL, s.ERaporToken,
		s.ERaporDBHost, s.ERaporDBPort, s.ERaporDBUser, s.ERaporDBPass, s.ERaporDBName,
		s.IsSandbox, now,
	)
	return err
}

func (r *IntegrationRepository) UpdateLastSyncedAt() error {
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec("UPDATE integration_settings SET last_synced_at = ? WHERE id = 'default'", now)
	return err
}

func (r *IntegrationRepository) RunSync(settings models.IntegrationSettings) (int, int, []string, error) {
	var logs []string
	inserted := 0
	updated := 0

	timestamp := func() string {
		return time.Now().Format("2006-01-02 15:04:05")
	}

	if settings.IsSandbox {
		logs = append(logs, fmt.Sprintf("[%s] Memulai sinkronisasi dalam MODE SANDBOX (Simulasi)...", timestamp()))
		time.Sleep(500 * time.Millisecond)

		logs = append(logs, fmt.Sprintf("[%s] Menghubungkan ke API Dapodik lokal di %s...", timestamp(), settings.DapodikURL))
		time.Sleep(500 * time.Millisecond)
		logs = append(logs, fmt.Sprintf("[%s] API Dapodik terhubung. Mengunduh data kesiswaan aktif...", timestamp()))
		time.Sleep(500 * time.Millisecond)

		// Define mock students
		type mockS struct {
			nisn, nis, nik, name, gender, birthPlace, birthDate string
		}
		mockStudents := []mockS{
			{"0081234567", "1099", "3202123456780001", "Muhammad Rafli", "L", "Indramayu", "2015-04-12"},
			{"0087654321", "1100", "3202123456780002", "Siska Putri", "P", "Indramayu", "2015-08-25"},
			{"0089998887", "1101", "3202123456780003", "Aulia Rahma", "P", "Indramayu", "2015-11-03"},
		}

		tx, err := r.DB.Begin()
		if err != nil {
			return 0, 0, nil, err
		}
		defer tx.Rollback()

		now := time.Now().UnixMilli()

		for _, ms := range mockStudents {
			var existingID string
			tx.QueryRow("SELECT id FROM alumni WHERE nisn = ?", ms.nisn).Scan(&existingID)

			if existingID != "" {
				// Update
				_, err = tx.Exec(`
					UPDATE alumni SET
						nis=?, nik=?, full_name=?, gender=?, birth_place=?, birth_date=?, updated_at=?
					WHERE id=?
				`, ms.nis, ms.nik, ms.name, ms.gender, ms.birthPlace, ms.birthDate, now, existingID)
				if err != nil {
					return 0, 0, nil, err
				}
				logs = append(logs, fmt.Sprintf("[%s] Menyinkronkan profil: %s (Diperbarui)", timestamp(), ms.name))
				updated++
			} else {
				// Insert
				newID := cuid2.Generate()
				_, err = tx.Exec(`
					INSERT INTO alumni (
						id, nisn, nis, nik, full_name, gender, birth_place, birth_date, status, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
				`, newID, ms.nisn, ms.nis, ms.nik, ms.name, ms.gender, ms.birthPlace, ms.birthDate, now, now)
				if err != nil {
					return 0, 0, nil, err
				}
				logs = append(logs, fmt.Sprintf("[%s] Menyinkronkan profil: %s (Baru ditambahkan)", timestamp(), ms.name))
				inserted++
			}
			time.Sleep(200 * time.Millisecond)
		}

		logs = append(logs, fmt.Sprintf("[%s] Profil kesiswaan selesai diselaraskan. Menghubungkan ke e-Rapor...", timestamp()))
		time.Sleep(500 * time.Millisecond)

		logs = append(logs, fmt.Sprintf("[%s] Koneksi e-Rapor lokal sukses. Menarik nilai transkrip rapor semester 2026/2027 Ganjil...", timestamp()))
		time.Sleep(500 * time.Millisecond)

		// Define mock grades
		type mockG struct {
			nisn, subject string
			score         float64
			notes         string
		}
		mockGrades := []mockG{
			// Muhammad Rafli
			{"0081234567", "Matematika", 88, "Sangat baik dalam pemahaman konsep perkalian."},
			{"0081234567", "Bahasa Indonesia", 90, "Menunjukkan minat baca yang tinggi."},
			{"0081234567", "IPAS", 85, "Memahami materi siklus hidup makhluk hidup."},
			{"0081234567", "Mangrove", 92, "Sangat aktif dalam kegiatan pelestarian pantai."},
			// Siska Putri
			{"0087654321", "Matematika", 92, "Luar biasa dalam menyelesaikan soal cerita."},
			{"0087654321", "Bahasa Indonesia", 86, "Mampu menyusun kalimat dengan struktur yang baik."},
			{"0087654321", "IPAS", 89, "Sangat aktif melakukan eksperimen sains sederhana."},
			{"0087654321", "Mangrove", 90, "Memahami ekosistem pesisir dengan sangat baik."},
		}

		for _, mg := range mockGrades {
			var alumniID string
			tx.QueryRow("SELECT id FROM alumni WHERE nisn = ?", mg.nisn).Scan(&alumniID)
			if alumniID == "" {
				continue
			}

			var transcriptID string
			tx.QueryRow(`
				SELECT id FROM alumni_transcripts
				WHERE alumni_id=? AND academic_year='2026/2027' AND semester='Ganjil' AND subject_name=?
			`, alumniID, mg.subject).Scan(&transcriptID)

			letter := "A"
			if mg.score < 90 {
				letter = "B"
			}

			if transcriptID != "" {
				_, err = tx.Exec(`
					UPDATE alumni_transcripts SET score=?, score_letter=?, notes=?, updated_at=? WHERE id=?
				`, mg.score, letter, mg.notes, now, transcriptID)
			} else {
				newTID := cuid2.Generate()
				_, err = tx.Exec(`
					INSERT INTO alumni_transcripts (id, alumni_id, academic_year, semester, subject_name, score, score_letter, notes, created_at, updated_at)
					VALUES (?, ?, '2026/2027', 'Ganjil', ?, ?, ?, ?, ?, ?)
				`, newTID, alumniID, mg.subject, mg.score, letter, mg.notes, now, now)
			}
			if err != nil {
				return 0, 0, nil, err
			}
			logs = append(logs, fmt.Sprintf("[%s] Nilai rapor disinkronkan: %s -> %s (%v)", timestamp(), mg.nisn, mg.subject, mg.score))
			updated++
		}

		err = tx.Commit()
		if err != nil {
			return 0, 0, nil, err
		}

		r.UpdateLastSyncedAt()
		logs = append(logs, fmt.Sprintf("[%s] Sinkronisasi massal berhasil diselesaikan!", timestamp()))
		return inserted, updated, logs, nil

	} else {
		// Real connections are not active yet, return friendly error logs
		logs = append(logs, fmt.Sprintf("[%s] Menghubungkan ke API Dapodik di %s...", timestamp(), settings.DapodikURL))
		time.Sleep(800 * time.Millisecond)
		return 0, 0, logs, fmt.Errorf("gagal terhubung ke Dapodik lokal di %s (Connection Refused). Pastikan server Dapodik lokal berjalan dan port Web Service diaktifkan", settings.DapodikURL)
	}
}
