package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
)

/**
 * SafeTime convert sql.NullInt64 (Unix milliseconds) to *time.Time.
 * We standardize on Milliseconds for high precision and consistency with JS.
 */
func SafeTime(ni sql.NullInt64) *time.Time {
	if !ni.Valid || ni.Int64 == 0 {
		return nil
	}
	
	val := ni.Int64
	
	// Heuristic: if value > 20,000,000,000, it's definitely milliseconds.
	// Year 2033 in seconds is ~2e9.
	if val > 20000000000 {
		t := time.Unix(val/1000, (val%1000)*1000000).UTC()
		return &t
	}
	
	// Fallback for legacy seconds
	t := time.Unix(val, 0).UTC()
	return &t
}

/**
 * UnixMilli returns current time in Unix Milliseconds.
 * Use this for all new 'created_at' and 'updated_at' fields.
 */
func UnixMilli() int64 {
	return time.Now().UnixMilli()
}

/**
 * NullTime is a helper for scanning NullTimes from SQLite which might be stored as int64.
 * Use Scan into sql.NullInt64, then use this to get time.Time.
 */
func ToTime(ni sql.NullInt64) time.Time {
	ptr := SafeTime(ni)
	if ptr == nil {
		return time.Time{}
	}
	return *ptr
}

// Ptr returns a pointer to the value passed in.
func Ptr[T any](v T) *T {
	return &v
}

// AutoSyncStudentToSavingsAndLibrary ensures a student has a savings account and library membership,
// and updates their class assignments if they change.
func AutoSyncStudentToSavingsAndLibrary(db *sql.DB, studentID string) error {
	studentID = strings.TrimSpace(studentID)
	if studentID == "" {
		return nil
	}

	var name, nisn, className, qrCode string
	var isActive int
	var status string
	err := db.QueryRow(`
		SELECT full_name, COALESCE(nisn, ''), COALESCE(class_name, ''), 
		       CASE WHEN qr_code IS NOT NULL AND TRIM(qr_code) != '' THEN qr_code ELSE id END,
		       is_active, COALESCE(status, '')
		FROM students WHERE id = ?
	`, studentID).Scan(&name, &nisn, &className, &qrCode, &isActive, &status)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}

	// Only sync if student is active
	isStudentActive := isActive == 1 || status == "active" || status == "aktif"
	if !isStudentActive {
		// Deactivate their savings and library member accounts
		_, _ = db.Exec("UPDATE library_members SET is_active = 0 WHERE student_id = ?", studentID)
		_, _ = db.Exec("UPDATE tabungan_siswa SET is_active = 0 WHERE student_id = ?", studentID)
		return nil
	}

	now := time.Now().UnixMilli()

	// === 1. SYNC LIBRARY MEMBER ===
	var libMemberID string
	err = db.QueryRow("SELECT id FROM library_members WHERE student_id = ?", studentID).Scan(&libMemberID)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	if libMemberID == "" {
		// Insert new library member
		libMemberID = cuid2.Generate()
		_, err = db.Exec(`
			INSERT INTO library_members (id, student_id, name, class_name, qr_code, max_borrow_limit, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 3, 1, ?, ?)
		`, libMemberID, studentID, name, className, qrCode, now, now)
		if err != nil {
			return err
		}
	} else {
		// Update existing library member profile (in case class/name changes)
		_, err = db.Exec(`
			UPDATE library_members
			SET name = ?, class_name = ?, qr_code = ?, is_active = 1, updated_at = ?
			WHERE student_id = ?
		`, name, className, qrCode, now, studentID)
		if err != nil {
			return err
		}
	}

	// === 2. SYNC SAVINGS ACCOUNT ===
	var savingsSiswaID string
	err = db.QueryRow("SELECT id FROM tabungan_siswa WHERE student_id = ?", studentID).Scan(&savingsSiswaID)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	// Find or create matching tabungan_kelas ID by class name
	var tabunganKelasID string
	if className != "" {
		err = db.QueryRow("SELECT id FROM tabungan_kelas WHERE nama = ?", className).Scan(&tabunganKelasID)
		if err != nil && err != sql.ErrNoRows {
			return err
		}

		if tabunganKelasID == "" {
			tabunganKelasID = cuid2.Generate()
			_, err = db.Exec(`
				INSERT INTO tabungan_kelas (id, nama, wali_kelas, created_at, updated_at)
				VALUES (?, ?, '', ?, ?)
			`, tabunganKelasID, className, now, now)
			if err != nil {
				return err
			}
		}
	}

	if savingsSiswaID == "" {
		// Insert new savings record
		savingsSiswaID = cuid2.Generate()
		savingsQR := "TAB-" + savingsSiswaID
		if qrCode != "" {
			savingsQR = qrCode
		}
		
		_, err = db.Exec(`
			INSERT INTO tabungan_siswa (id, student_id, nisn, nama, kelas_id, saldo_terakhir, qr_code, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?)
		`, savingsSiswaID, studentID, nisn, name, tabunganKelasID, savingsQR, now, now)
		if err != nil {
			return err
		}
	} else {
		// Update existing savings profile
		if tabunganKelasID != "" {
			_, err = db.Exec(`
				UPDATE tabungan_siswa
				SET nisn = ?, nama = ?, kelas_id = ?, qr_code = ?, is_active = 1, updated_at = ?
				WHERE student_id = ?
			`, nisn, name, tabunganKelasID, qrCode, now, studentID)
			if err != nil {
				return err
			}
		} else {
			_, err = db.Exec(`
				UPDATE tabungan_siswa
				SET nisn = ?, nama = ?, qr_code = ?, is_active = 1, updated_at = ?
				WHERE student_id = ?
			`, nisn, name, qrCode, now, studentID)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// Queryer interface defines database operations required for clearance checks.
type Queryer interface {
	QueryRow(query string, args ...interface{}) *sql.Row
}

// CheckStudentClearance checks if the student has any outstanding library loans, unpaid fines, remaining savings balance, or unpaid savings debt.
// Returns clear (bool), reason (string), and error.
func CheckStudentClearance(db Queryer, studentID string) (bool, string, error) {
	studentID = strings.TrimSpace(studentID)
	if studentID == "" {
		return true, "", nil
	}

	// 1. Check library loans (unreturned books)
	var activeLoans int
	err := db.QueryRow(`
		SELECT COUNT(*) 
		FROM library_loans l
		JOIN library_members m ON l.member_id = m.id
		WHERE m.student_id = ? AND l.is_returned = 0
	`, studentID).Scan(&activeLoans)
	if err != nil && !strings.Contains(err.Error(), "no such table") {
		return false, "", err
	}
	if err == nil && activeLoans > 0 {
		return false, fmt.Sprintf("masih meminjam %d buku di perpustakaan", activeLoans), nil
	}

	// 2. Check library unpaid fines
	var unpaidFines int
	err = db.QueryRow(`
		SELECT COUNT(*) 
		FROM library_loans l
		JOIN library_members m ON l.member_id = m.id
		WHERE m.student_id = ? AND l.fine_amount > 0 AND l.fine_paid = 0
	`, studentID).Scan(&unpaidFines)
	if err != nil && !strings.Contains(err.Error(), "no such table") {
		return false, "", err
	}
	if err == nil && unpaidFines > 0 {
		return false, fmt.Sprintf("masih memiliki %d denda perpustakaan yang belum lunas", unpaidFines), nil
	}

	// 3. Check savings account
	var savingsID string
	var balance int
	err = db.QueryRow(`
		SELECT id, saldo_terakhir 
		FROM tabungan_siswa 
		WHERE student_id = ?
	`, studentID).Scan(&savingsID, &balance)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || strings.Contains(err.Error(), "no such table") {
			// No savings account means no balance and no debt
			return true, "", nil
		}
		return false, "", err
	}

	if balance > 0 {
		return false, fmt.Sprintf("masih memiliki saldo tabungan sebesar Rp%d yang belum diambil", balance), nil
	}

	// 4. Check savings debt (hutang)
	var activeDebt int
	err = db.QueryRow(`
		SELECT COUNT(*) 
		FROM tabungan_hutang 
		WHERE siswa_id = ? AND status = 'aktif'
	`, savingsID).Scan(&activeDebt)
	if err != nil && !strings.Contains(err.Error(), "no such table") {
		return false, "", err
	}
	if err == nil && activeDebt > 0 {
		return false, fmt.Sprintf("masih memiliki %d transaksi pinjaman/hutang tabungan aktif", activeDebt), nil
	}

	return true, "", nil
}

// AutoSyncStudentToBukuInduk ensures a student has a record in the alumni (Buku Induk) table.
func AutoSyncStudentToBukuInduk(db *sql.DB, studentID string) error {
	studentID = strings.TrimSpace(studentID)
	if studentID == "" {
		return nil
	}

	var fullName string
	var nik, nisn, nis, gender, bp, bd, rel, addr, pn, fn, fnik, mn, mnik, gn, gnik, gjob, pp, cn, cid, photo, status, kip sql.NullString
	var isActive int
	var enrolledAt sql.NullInt64

	err := db.QueryRow(`
		SELECT id, nik, nisn, nis, full_name, gender, birth_place, birth_date, religion, address,
		       parent_name, father_name, father_nik, mother_name, mother_nik,
		       guardian_name, guardian_nik, guardian_job, parent_phone, class_name, class_id,
		       status, photo, is_active, enrolled_at, kip
		FROM students WHERE id = ?
	`, studentID).Scan(
		&studentID, &nik, &nisn, &nis, &fullName, &gender, &bp, &bd, &rel, &addr,
		&pn, &fn, &fnik, &mn, &mnik, &gn, &gnik, &gjob, &pp, &cn, &cid,
		&status, &photo, &isActive, &enrolledAt, &kip,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}

	// Map status
	st := strings.ToLower(strings.TrimSpace(status.String))
	mappedStatus := "active"
	if st == "graduated" || st == "lulus" {
		mappedStatus = "graduated"
	} else if st == "transferred" || st == "mutasi_keluar" || st == "pindah" {
		mappedStatus = "transferred"
	} else if st == "dropped" || st == "keluar" || st == "do" {
		mappedStatus = "dropped"
	} else if isActive == 0 {
		mappedStatus = "dropped"
	}

	// Compute enrolled year from enrolled_at
	var enrolledYear string
	if enrolledAt.Valid && enrolledAt.Int64 > 0 {
		t := time.UnixMilli(enrolledAt.Int64)
		enrolledYear = fmt.Sprintf("%d", t.Year())
	}

	// Check if student already exists in alumni table
	var alumniID string
	err = db.QueryRow("SELECT id FROM alumni WHERE student_id = ?", studentID).Scan(&alumniID)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	now := time.Now().UnixMilli()

	// Get previous_school from spmb_registrants
	var prevSch sql.NullString
	db.QueryRow(`SELECT previous_school FROM spmb_registrants WHERE registration_number = ? OR student_nik = ? LIMIT 1`,
		nis.String, nik.String).Scan(&prevSch)

	if alumniID == "" {
		// Insert
		alumniID = cuid2.Generate()
		
		gradYear := ""
		if mappedStatus == "graduated" {
			gradYear = fmt.Sprintf("%d", time.Now().Year())
		}
		
		_, err = db.Exec(`
			INSERT INTO alumni (
				id, student_id, nisn, nis, full_name, gender, birth_place, birth_date,
				graduation_year, graduation_date, final_class, photo, parent_name, parent_phone,
				current_address, current_phone, current_email, next_school, notes,
				nik, religion, address, enrolled_year, previous_school,
				father_name, father_nik, father_education, father_job,
				mother_name, mother_nik, mother_education, mother_job,
				guardian_name, guardian_nik, guardian_relation, guardian_job, guardian_phone,
				sibling_count, child_order, height, weight, blood_type, medical_notes, special_needs,
				current_occupation, current_institution, last_education_level, final_grade_avg,
				status, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, alumniID, studentID,
			optionalString(nisn), optionalString(nis), fullName,
			optionalString(gender), optionalString(bp), optionalString(bd),
			gradYear, nil, optionalString(cn), optionalString(photo),
			optionalString(pn), optionalString(pp), optionalString(addr), nil, nil, nil, nil,
			optionalString(nik), optionalString(rel), optionalString(addr), optionalString(sql.NullString{String: enrolledYear, Valid: enrolledYear != ""}),
			optionalString(prevSch),
			optionalString(fn), optionalString(fnik), nil, nil,
			optionalString(mn), optionalString(mnik), nil, nil,
			optionalString(gn), optionalString(gnik), nil, nil, nil,
			0, 0, 0, 0, nil, nil, nil,
			nil, nil, nil, nil,
			mappedStatus, now, now,
		)
		if err != nil {
			return err
		}
	} else {
		updateClass := cn.String
		var existingFinalClass sql.NullString
		var existingGradYear sql.NullString
		db.QueryRow("SELECT final_class, graduation_year FROM alumni WHERE student_id = ?", studentID).Scan(&existingFinalClass, &existingGradYear)
		
		if mappedStatus != "active" {
			if existingFinalClass.Valid && existingFinalClass.String != "" {
				updateClass = existingFinalClass.String
			}
		}
		
		updateGradYear := existingGradYear.String
		if mappedStatus == "graduated" && (updateGradYear == "" || !existingGradYear.Valid) {
			updateGradYear = fmt.Sprintf("%d", time.Now().Year())
		}

		// Update (only update core personal details, not graduation / post-grad details unless empty)
		_, err = db.Exec(`
			UPDATE alumni SET
				nisn=?, nis=?, full_name=?, gender=?, birth_place=?, birth_date=?,
				final_class=?, graduation_year=?, photo=?, parent_name=?, parent_phone=?, address=?,
				nik=?, religion=?, enrolled_year=?, previous_school=?,
				father_name=?, father_nik=?, mother_name=?, mother_nik=?,
				guardian_name=?, guardian_nik=?, guardian_job=?, status=?, updated_at=?
			WHERE student_id=?
		`, optionalString(nisn), optionalString(nis), fullName, optionalString(gender), optionalString(bp), optionalString(bd),
			optionalString(sql.NullString{String: updateClass, Valid: updateClass != ""}), 
			optionalString(sql.NullString{String: updateGradYear, Valid: updateGradYear != ""}), 
			optionalString(photo), optionalString(pn), optionalString(pp), optionalString(addr),
			optionalString(nik), optionalString(rel), optionalString(sql.NullString{String: enrolledYear, Valid: enrolledYear != ""}), optionalString(prevSch),
			optionalString(fn), optionalString(fnik), optionalString(mn), optionalString(mnik),
			optionalString(gn), optionalString(gnik), optionalString(gjob), mappedStatus, now, studentID)
		if err != nil {
			return err
		}
	}

	return nil
}

