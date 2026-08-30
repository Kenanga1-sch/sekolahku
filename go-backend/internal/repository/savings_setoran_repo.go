package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// GetSetoranList returns paginated list of settlements
func (r *SavingsRepository) GetSetoranList(status, guruID string, page, perPage int) ([]models.TabunganSetoran, int, error) {
	if page < 1 { page = 1 }
	if perPage < 1 || perPage > 100 { perPage = 20 }
	offset := (page - 1) * perPage

	where := "1=1"
	var args []interface{}
	if status != "" {
		where += " AND s.status = ?"
		args = append(args, status)
	}
	if guruID != "" {
		where += " AND s.guru_id = ?"
		args = append(args, guruID)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_setoran s WHERE "+where, args...).Scan(&total)

	listArgs := append(args, perPage, offset)
	query := `
		SELECT s.id, s.guru_id, s.bendahara_id, s.tipe, s.total_nominal, s.nominal_fisik, s.selisih, s.status, s.catatan, s.created_at,
		       g.name as g_name, b.name as b_name
		FROM tabungan_setoran s
		JOIN users g ON s.guru_id = g.id
		LEFT JOIN users b ON s.bendahara_id = b.id
		WHERE ` + where + ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil { return nil, 0, err }
	defer rows.Close()

	var results []models.TabunganSetoran
	for rows.Next() {
		var s models.TabunganSetoran
		var bId, cat, gName, bName sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&s.ID, &s.GuruID, &bId, &s.Tipe, &s.TotalNominal, &s.NominalFisik, &s.Selisih, &s.Status, &cat, &crAt, &gName, &bName)
		if err != nil { return nil, 0, err }
		if bId.Valid { s.BendaharaID = &bId.String }
		if cat.Valid { s.Catatan = &cat.String }
		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		s.Guru = &models.User{Name: Ptr(gName.String)}
		results = append(results, s)
	}
	if results == nil { results = []models.TabunganSetoran{} }
	return results, total, nil
}

// CreateSetoran creates a new settlement request
func (r *SavingsRepository) CreateSetoran(req models.CreateSetoranRequest) error {
	req.GuruID = strings.TrimSpace(req.GuruID)
	if req.GuruID == "" { return errors.New("Petugas/guru wajib diisi") }

	tx, err := r.DB.Begin()
	if err != nil { return err }
	defer tx.Rollback()

	rows, err := tx.Query(`
		SELECT id, tipe, nominal FROM tabungan_transaksi 
		WHERE user_id = ? AND setoran_id IS NULL AND status = 'collected'
	`, req.GuruID)
	if err != nil { return err }

	var txIds []string
	total := 0
	for rows.Next() {
		var id, t string
		var n int
		if err := rows.Scan(&id, &t, &n); err != nil { rows.Close(); return err }
		txIds = append(txIds, id)
		if t == "setor" { total += n } else { total -= n }
	}
	rows.Close()

	if len(txIds) == 0 { return errors.New("Tidak ada transaksi untuk disetor") }

	sId := cuid2.Generate()
	now := UnixMilli()
	tipe := "setor_ke_bendahara"
	if total < 0 { tipe = "tarik_dari_bendahara"; total = -total }

	_, err = tx.Exec("INSERT INTO tabungan_setoran (id, guru_id, tipe, total_nominal, status, catatan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		sId, req.GuruID, tipe, total, "pending", req.Catatan, now, now)
	if err != nil { return err }

	for _, tid := range txIds {
		if _, err := tx.Exec("UPDATE tabungan_transaksi SET setoran_id = ?, updated_at = ? WHERE id = ?", sId, now, tid); err != nil { return err }
	}
	return tx.Commit()
}

// VerifySetoran approves/rejects a settlement with financial validations
func (r *SavingsRepository) VerifySetoran(req models.VerifySetoranRequest) error {
	if req.Status != "verified" && req.Status != "rejected" { return errors.New("Status verifikasi tidak valid") }
	if strings.TrimSpace(req.SetoranID) == "" || strings.TrimSpace(req.BendaharaID) == "" { return errors.New("Setoran dan bendahara wajib diisi") }

	tx, err := r.DB.Begin()
	if err != nil { return err }
	defer tx.Rollback()

	var total int
	var t, currentStatus string
	err = tx.QueryRow("SELECT total_nominal, tipe, status FROM tabungan_setoran WHERE id = ?", req.SetoranID).Scan(&total, &t, &currentStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) { return errors.New("Setoran tidak ditemukan") }
		return err
	}
	if currentStatus != "pending" { return errors.New("Setoran sudah diproses") }

	fisik := total
	if req.NominalFisik != nil { fisik = *req.NominalFisik }
	if fisik < 0 { return errors.New("Nominal fisik tidak valid") }
	selisih := total - fisik
	now := UnixMilli()

	if _, err := tx.Exec("UPDATE tabungan_setoran SET status = ?, bendahara_id = ?, nominal_fisik = ?, selisih = ?, catatan = ?, updated_at = ? WHERE id = ?",
		req.Status, req.BendaharaID, fisik, selisih, req.Catatan, now, req.SetoranID); err != nil { return err }

	if req.Status == "verified" {
		rows, err := tx.Query("SELECT id, siswa_id, tipe, nominal FROM tabungan_transaksi WHERE setoran_id = ?", req.SetoranID)
		if err != nil { return err }
		type txItem struct{ ID, SiswaID, Tipe string; Nominal int }
		var items []txItem
		for rows.Next() {
			var item txItem
			if err := rows.Scan(&item.ID, &item.SiswaID, &item.Tipe, &item.Nominal); err != nil { rows.Close(); return err }
			items = append(items, item)
		}
		rows.Close()

		netPerSiswa := make(map[string]int)
		for _, item := range items {
			if item.Tipe == "setor" { netPerSiswa[item.SiswaID] += item.Nominal } else { netPerSiswa[item.SiswaID] -= item.Nominal }
		}
		for sid, net := range netPerSiswa {
			if net < 0 {
				var saldo int
				tx.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE student_id = ?", sid).Scan(&saldo)
				if saldo+net < 0 {
					var nama string
					tx.QueryRow("SELECT full_name FROM students WHERE id = ?", sid).Scan(&nama)
					return errors.New("Saldo siswa " + nama + " tidak cukup untuk verifikasi penarikan")
				}
			}
		}

		for _, item := range items {
			if _, err := tx.Exec("UPDATE tabungan_transaksi SET status = 'verified', verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ?",
				req.BendaharaID, now, now, item.ID); err != nil { return err }
			if item.Tipe == "setor" {
				if _, err := tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir + ?, updated_at = ? WHERE student_id = ?",
					item.Nominal, now, item.SiswaID); err != nil { return err }
			} else {
				if _, err := tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir - ?, updated_at = ? WHERE student_id = ?",
					item.Nominal, now, item.SiswaID); err != nil { return err }
			}
		}

		var bId string
		tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&bId)
		if bId == "" {
			bId = cuid2.Generate()
			if _, err := tx.Exec("INSERT INTO tabungan_brankas (id, nama, tipe, saldo, updated_at) VALUES (?, 'Kas Utama', 'cash', 0, ?)", bId, now); err != nil { return err }
		}
		if t == "tarik_dari_bendahara" {
			var cashSaldo int
			tx.QueryRow("SELECT saldo FROM tabungan_brankas WHERE id = ?", bId).Scan(&cashSaldo)
			if cashSaldo < fisik { return errors.New("Saldo kas tidak mencukupi untuk penarikan") }
			if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo - ?, updated_at = ? WHERE id = ?", fisik, now, bId); err != nil { return err }
		} else {
			if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo + ?, updated_at = ? WHERE id = ?", fisik, now, bId); err != nil { return err }
		}
		if _, err := tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			cuid2.Generate(), t, fisik, req.BendaharaID, "Verifikasi setoran harian", now); err != nil { return err }
	}
	return tx.Commit()
}

// GetSetoranPending returns pending settlements
func (r *SavingsRepository) GetSetoranPending(guruID string) ([]models.TabunganSetoran, error) {
	query := `
		SELECT s.id, s.guru_id, s.bendahara_id, s.tipe, s.total_nominal, s.nominal_fisik, s.selisih, s.status, s.catatan, s.created_at,
		       g.name as g_name, b.name as b_name
		FROM tabungan_setoran s
		JOIN users g ON s.guru_id = g.id
		LEFT JOIN users b ON s.bendahara_id = b.id
		WHERE s.status = 'pending'
	`
	var args []interface{}
	if guruID != "" {
		query += " AND s.guru_id = ?"
		args = append(args, guruID)
	}
	query += " ORDER BY s.created_at DESC"
	rows, err := r.DB.Query(query, args...)
	if err != nil { return nil, err }
	defer rows.Close()

	var results []models.TabunganSetoran
	for rows.Next() {
		var s models.TabunganSetoran
		var bId, cat, gName, bName sql.NullString
		var crAt sql.NullInt64
		rows.Scan(&s.ID, &s.GuruID, &bId, &s.Tipe, &s.TotalNominal, &s.NominalFisik, &s.Selisih, &s.Status, &cat, &crAt, &gName, &bName)
		if bId.Valid { s.BendaharaID = &bId.String }
		if cat.Valid { s.Catatan = &cat.String }
		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		s.Guru = &models.User{Name: Ptr(gName.String)}
		results = append(results, s)
	}
	if results == nil { results = []models.TabunganSetoran{} }
	return results, nil
}

// GetSetoranByGuru returns settlement history for a guru
func (r *SavingsRepository) GetSetoranByGuru(guruID string) ([]models.TabunganSetoran, error) {
	rows, err := r.DB.Query(`
		SELECT s.id, s.guru_id, s.bendahara_id, s.tipe, s.total_nominal, s.nominal_fisik, s.selisih, s.status, s.catatan, s.created_at,
		       g.name as g_name, b.name as b_name
		FROM tabungan_setoran s
		JOIN users g ON s.guru_id = g.id
		LEFT JOIN users b ON s.bendahara_id = b.id
		WHERE s.guru_id = ? ORDER BY s.created_at DESC LIMIT 50
	`, guruID)
	if err != nil { return nil, err }
	defer rows.Close()

	var results []models.TabunganSetoran
	for rows.Next() {
		var s models.TabunganSetoran
		var bId, cat, gName, bName sql.NullString
		var crAt sql.NullInt64
		rows.Scan(&s.ID, &s.GuruID, &bId, &s.Tipe, &s.TotalNominal, &s.NominalFisik, &s.Selisih, &s.Status, &cat, &crAt, &gName, &bName)
		if bId.Valid { s.BendaharaID = &bId.String }
		if cat.Valid { s.Catatan = &cat.String }
		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		s.Guru = &models.User{Name: Ptr(gName.String)}
		results = append(results, s)
	}
	if results == nil { results = []models.TabunganSetoran{} }
	return results, nil
}

// GetSetoranDetail returns a single settlement with its transactions
func (r *SavingsRepository) GetSetoranDetail(id string) (*models.TabunganSetoranDetail, error) {
	var s models.TabunganSetoranDetail
	var bId, cat, gName, bName sql.NullString
	var crAt sql.NullInt64

	err := r.DB.QueryRow(`
		SELECT s.id, s.guru_id, s.bendahara_id, s.tipe, s.total_nominal, s.nominal_fisik, s.selisih, s.status, s.catatan, s.created_at,
		       g.name as g_name, b.name as b_name
		FROM tabungan_setoran s
		JOIN users g ON s.guru_id = g.id
		LEFT JOIN users b ON s.bendahara_id = b.id
		WHERE s.id = ?
	`, id).Scan(&s.ID, &s.GuruID, &bId, &s.Tipe, &s.TotalNominal, &s.NominalFisik, &s.Selisih, &s.Status, &cat, &crAt, &gName, &bName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) { return nil, nil }
		return nil, err
	}
	if bId.Valid { s.BendaharaID = &bId.String }
	if cat.Valid { s.Catatan = &cat.String }
	cTime := ToTime(crAt)
	s.CreatedAt = &cTime
	s.Guru = &models.User{Name: Ptr(gName.String)}
	if bName.Valid { s.BendaharaName = &bName.String }

	txRows, err := r.DB.Query(`
		SELECT t.id, t.siswa_id, t.tipe, t.nominal, t.catatan, st.full_name as s_nama
		FROM tabungan_transaksi t
		JOIN students st ON t.siswa_id = st.id
		WHERE t.setoran_id = ?
	`, id)
	if err == nil {
		defer txRows.Close()
		for txRows.Next() {
			var tx models.SetoranTransaction
			var cat2, sName sql.NullString
			txRows.Scan(&tx.ID, &tx.SiswaID, &tx.Tipe, &tx.Nominal, &cat2, &sName)
			if cat2.Valid { tx.Catatan = &cat2.String }
			if sName.Valid { tx.SiswaName = sName.String }
			s.Transactions = append(s.Transactions, tx)
		}
	}
	return &s, nil
}

// ResubmitSetoran resets a rejected settlement back to pending
func (r *SavingsRepository) ResubmitSetoran(id string, catatan string) error {
	_, err := r.DB.Exec("UPDATE tabungan_setoran SET status = 'pending', catatan = ?, updated_at = ? WHERE id = ?",
		catatan, UnixMilli(), id)
	return err
}
