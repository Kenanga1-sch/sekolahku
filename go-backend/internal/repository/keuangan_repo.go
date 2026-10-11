package repository

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// FinanceRepository menangani modul Keuangan (buku besar generik multi-unit).
// Berdiri sendiri: tidak menyentuh brankas/tabungan.
type FinanceRepository struct {
	DB *sql.DB
}

func NewFinanceRepository(db *sql.DB) *FinanceRepository {
	return &FinanceRepository{DB: db}
}

// ---------- Unit Usaha ----------

const unitSelect = `SELECT id, code, name, type, COALESCE(description,''), COALESCE(icon,''), COALESCE(color,''),
	COALESCE(is_active,1), COALESCE(sort_order,0), COALESCE(created_at,0), COALESCE(updated_at,0)
	FROM finance_units`

func (r *FinanceRepository) ListUnits(includeInactive bool) ([]models.FinanceUnit, error) {
	q := unitSelect
	if !includeInactive {
		q += " WHERE is_active = 1"
	}
	q += " ORDER BY sort_order, name"

	rows, err := r.DB.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.FinanceUnit{}
	for rows.Next() {
		u, err := scanUnit(rows)
		if err != nil {
			continue
		}
		out = append(out, u)
	}
	return out, nil
}

func (r *FinanceRepository) GetUnitByID(id string) (*models.FinanceUnit, error) {
	row := r.DB.QueryRow(unitSelect+" WHERE id = ?", id)
	u, err := scanUnit(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *FinanceRepository) GetUnitByCode(code string) (*models.FinanceUnit, error) {
	row := r.DB.QueryRow(unitSelect+" WHERE code = ?", code)
	u, err := scanUnit(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *FinanceRepository) CreateUnit(req models.CreateFinanceUnitRequest, actorID, actorName string) (*models.FinanceUnit, error) {
	code := slugify(req.Code)
	if code == "" {
		code = slugify(req.Name)
	}
	name := strings.TrimSpace(req.Name)
	if code == "" || name == "" {
		return nil, errors.New("kode dan nama unit wajib diisi")
	}
	typ := strings.TrimSpace(req.Type)
	if typ == "" {
		typ = "generic"
	}
	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = "wallet"
	}
	active := 1
	if req.IsActive != nil && !*req.IsActive {
		active = 0
	}
	id := cuid2.Generate()
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO finance_units (id, code, name, type, description, icon, color, is_active, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, code, name, typ, strings.TrimSpace(req.Description), icon, strings.TrimSpace(req.Color), active, req.SortOrder, now, now)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, errors.New("kode unit sudah dipakai")
		}
		return nil, err
	}
	u, err := r.GetUnitByID(id)
	if err != nil {
		return nil, err
	}
	_, _ = r.writeAudit("unit", id, "create", actorID, actorName, "", mustJSON(u))
	return u, nil
}

func (r *FinanceRepository) UpdateUnit(id string, req models.CreateFinanceUnitRequest, actorID, actorName string) error {
	before, _ := r.GetUnitByID(id)
	if before == nil {
		return sql.ErrNoRows
	}
	code := slugify(req.Code)
	if code == "" {
		code = slugify(req.Name)
	}
	typ := strings.TrimSpace(req.Type)
	if typ == "" {
		typ = "generic"
	}
	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = "wallet"
	}
	active := 1
	if req.IsActive != nil {
		if !*req.IsActive {
			active = 0
		}
	} else if !before.IsActive {
		active = 0
	}
	_, err := r.DB.Exec(`
		UPDATE finance_units
		SET code = ?, name = ?, type = ?, description = ?, icon = ?, color = ?, is_active = ?, sort_order = ?, updated_at = ?
		WHERE id = ?
	`, code, strings.TrimSpace(req.Name), typ, strings.TrimSpace(req.Description), icon, strings.TrimSpace(req.Color), active, req.SortOrder, UnixMilli(), id)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return errors.New("kode unit sudah dipakai")
		}
		return err
	}
	after, _ := r.GetUnitByID(id)
	_, _ = r.writeAudit("unit", id, "update", actorID, actorName, mustJSON(before), mustJSON(after))
	return nil
}

func (r *FinanceRepository) DeleteUnit(id string, actorID, actorName string) error {
	before, _ := r.GetUnitByID(id)
	if before == nil {
		return nil
	}
	if _, err := r.DB.Exec(`DELETE FROM finance_units WHERE id = ?`, id); err != nil {
		return err
	}
	_, _ = r.writeAudit("unit", id, "delete", actorID, actorName, mustJSON(before), "")
	return nil
}

func scanUnit(row rowScanner) (models.FinanceUnit, error) {
	var u models.FinanceUnit
	var active int
	var ca, ua sql.NullInt64
	if err := row.Scan(&u.ID, &u.Code, &u.Name, &u.Type, &u.Description, &u.Icon, &u.Color, &active, &u.SortOrder, &ca, &ua); err != nil {
		return u, err
	}
	u.IsActive = active == 1
	u.CreatedAt = msToTime(ca)
	u.UpdatedAt = msToTime(ua)
	return u, nil
}

// ---------- Kategori ----------

const categorySelect = `SELECT c.id, c.unit_id, COALESCE(u.name,''), c.name, c.direction,
	COALESCE(c.is_active,1), COALESCE(c.sort_order,0), COALESCE(c.created_at,0), COALESCE(c.updated_at,0)
	FROM finance_categories c LEFT JOIN finance_units u ON u.id = c.unit_id`

func (r *FinanceRepository) ListCategories(unitID string, includeInactive bool) ([]models.FinanceCategory, error) {
	clauses := []string{"1=1"}
	args := []interface{}{}
	if strings.TrimSpace(unitID) != "" {
		clauses = append(clauses, "c.unit_id = ?")
		args = append(args, unitID)
	}
	if !includeInactive {
		clauses = append(clauses, "c.is_active = 1")
	}
	q := categorySelect + " WHERE " + strings.Join(clauses, " AND ") + " ORDER BY c.sort_order, c.name"
	rows, err := r.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.FinanceCategory{}
	for rows.Next() {
		c, err := scanCategory(rows)
		if err != nil {
			continue
		}
		out = append(out, c)
	}
	return out, nil
}

func (r *FinanceRepository) GetCategoryByID(id string) (*models.FinanceCategory, error) {
	row := r.DB.QueryRow(categorySelect+" WHERE c.id = ?", id)
	c, err := scanCategory(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *FinanceRepository) CreateCategory(req models.CreateFinanceCategoryRequest, actorID, actorName string) (*models.FinanceCategory, error) {
	unitID := strings.TrimSpace(req.UnitID)
	name := strings.TrimSpace(req.Name)
	if unitID == "" || name == "" {
		return nil, errors.New("unit dan nama kategori wajib diisi")
	}
	dir := "in"
	if req.Direction == "out" {
		dir = "out"
	}
	active := 1
	if req.IsActive != nil && !*req.IsActive {
		active = 0
	}
	id := cuid2.Generate()
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO finance_categories (id, unit_id, name, direction, is_active, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, unitID, name, dir, active, req.SortOrder, now, now)
	if err != nil {
		return nil, err
	}
	cat, err := r.GetCategoryByID(id)
	if err != nil {
		return nil, err
	}
	_, _ = r.writeAudit("category", id, "create", actorID, actorName, "", mustJSON(cat))
	return cat, nil
}

func (r *FinanceRepository) UpdateCategory(id string, req models.CreateFinanceCategoryRequest, actorID, actorName string) error {
	before, _ := r.GetCategoryByID(id)
	if before == nil {
		return sql.ErrNoRows
	}
	dir := "in"
	if req.Direction == "out" {
		dir = "out"
	}
	active := 1
	if req.IsActive != nil {
		if !*req.IsActive {
			active = 0
		}
	} else if !before.IsActive {
		active = 0
	}
	_, err := r.DB.Exec(`
		UPDATE finance_categories SET name = ?, direction = ?, is_active = ?, sort_order = ?, updated_at = ?
		WHERE id = ?
	`, strings.TrimSpace(req.Name), dir, active, req.SortOrder, UnixMilli(), id)
	if err != nil {
		return err
	}
	after, _ := r.GetCategoryByID(id)
	_, _ = r.writeAudit("category", id, "update", actorID, actorName, mustJSON(before), mustJSON(after))
	return nil
}

func (r *FinanceRepository) DeleteCategory(id string, actorID, actorName string) error {
	before, _ := r.GetCategoryByID(id)
	if before == nil {
		return nil
	}
	if _, err := r.DB.Exec(`DELETE FROM finance_categories WHERE id = ?`, id); err != nil {
		return err
	}
	_, _ = r.writeAudit("category", id, "delete", actorID, actorName, mustJSON(before), "")
	return nil
}

func scanCategory(row rowScanner) (models.FinanceCategory, error) {
	var c models.FinanceCategory
	var active int
	var ca, ua sql.NullInt64
	if err := row.Scan(&c.ID, &c.UnitID, &c.UnitName, &c.Name, &c.Direction, &active, &c.SortOrder, &ca, &ua); err != nil {
		return c, err
	}
	c.IsActive = active == 1
	c.CreatedAt = msToTime(ca)
	c.UpdatedAt = msToTime(ua)
	return c, nil
}

// ---------- Transaksi ----------

const txSelect = `SELECT t.id, t.unit_id, COALESCE(u.name,''), t.category_id, COALESCE(c.name,''),
	t.direction, t.amount, COALESCE(t.description,''), COALESCE(t.tx_date,0), COALESCE(t.party,''),
	t.quantity, t.unit_price, COALESCE(t.reference,''), COALESCE(t.metadata,''),
	t.created_by, COALESCE(t.created_by_name,''), COALESCE(t.created_at,0), COALESCE(t.updated_at,0)
	FROM finance_transactions t
	LEFT JOIN finance_units u ON u.id = t.unit_id
	LEFT JOIN finance_categories c ON c.id = t.category_id`

// FinanceTransactionFilter menyaring daftar transaksi.
type FinanceTransactionFilter struct {
	UnitID     string
	CategoryID string
	Direction  string
	DateFrom   int64 // epoch ms, inklusif
	DateTo     int64 // epoch ms, eksklusif
	Search     string
	Limit      int
	Offset     int
}

func (r *FinanceRepository) ListTransactions(f FinanceTransactionFilter) ([]models.FinanceTransaction, error) {
	clauses := []string{"1=1"}
	args := []interface{}{}
	if strings.TrimSpace(f.UnitID) != "" {
		clauses = append(clauses, "t.unit_id = ?")
		args = append(args, f.UnitID)
	}
	if strings.TrimSpace(f.CategoryID) != "" {
		clauses = append(clauses, "t.category_id = ?")
		args = append(args, f.CategoryID)
	}
	if f.Direction == "in" || f.Direction == "out" {
		clauses = append(clauses, "t.direction = ?")
		args = append(args, f.Direction)
	}
	if f.DateFrom > 0 {
		clauses = append(clauses, "t.tx_date >= ?")
		args = append(args, f.DateFrom)
	}
	if f.DateTo > 0 {
		clauses = append(clauses, "t.tx_date < ?")
		args = append(args, f.DateTo)
	}
	if s := strings.TrimSpace(f.Search); s != "" {
		clauses = append(clauses, "(t.description LIKE ? OR t.party LIKE ? OR t.reference LIKE ?)")
		like := "%" + s + "%"
		args = append(args, like, like, like)
	}
	limit := f.Limit
	if limit < 1 || limit > 1000 {
		limit = 200
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}
	q := txSelect + " WHERE " + strings.Join(clauses, " AND ") + " ORDER BY t.tx_date DESC, t.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.FinanceTransaction{}
	for rows.Next() {
		t, err := scanTransaction(rows)
		if err != nil {
			continue
		}
		out = append(out, t)
	}
	return out, nil
}

func (r *FinanceRepository) CountTransactions(f FinanceTransactionFilter) (int, error) {
	clauses := []string{"1=1"}
	args := []interface{}{}
	if strings.TrimSpace(f.UnitID) != "" {
		clauses = append(clauses, "unit_id = ?")
		args = append(args, f.UnitID)
	}
	if strings.TrimSpace(f.CategoryID) != "" {
		clauses = append(clauses, "category_id = ?")
		args = append(args, f.CategoryID)
	}
	if f.Direction == "in" || f.Direction == "out" {
		clauses = append(clauses, "direction = ?")
		args = append(args, f.Direction)
	}
	if f.DateFrom > 0 {
		clauses = append(clauses, "tx_date >= ?")
		args = append(args, f.DateFrom)
	}
	if f.DateTo > 0 {
		clauses = append(clauses, "tx_date < ?")
		args = append(args, f.DateTo)
	}
	if s := strings.TrimSpace(f.Search); s != "" {
		clauses = append(clauses, "(description LIKE ? OR party LIKE ? OR reference LIKE ?)")
		like := "%" + s + "%"
		args = append(args, like, like, like)
	}
	var n int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM finance_transactions WHERE "+strings.Join(clauses, " AND "), args...).Scan(&n)
	return n, err
}

func (r *FinanceRepository) GetTransactionByID(id string) (*models.FinanceTransaction, error) {
	row := r.DB.QueryRow(txSelect+" WHERE t.id = ?", id)
	t, err := scanTransaction(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

// txDateValue mengubah string tanggal (epoch-ms atau RFC3339) → epoch ms. 0 = sekarang.
func txDateValue(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return UnixMilli()
	}
	// Coba epoch-ms numerik.
	if n, err := strconv.ParseInt(s, 10, 64); err == nil && n > 0 {
		return n
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.UnixMilli()
	}
	return UnixMilli()
}

func (r *FinanceRepository) CreateTransaction(req models.CreateFinanceTransactionRequest, actorID, actorName string) (*models.FinanceTransaction, error) {
	unitID := strings.TrimSpace(req.UnitID)
	if unitID == "" {
		return nil, errors.New("unit wajib dipilih")
	}
	if req.Amount <= 0 {
		return nil, errors.New("jumlah harus lebih dari 0")
	}
	dir := "in"
	if req.Direction == "out" {
		dir = "out"
	}
	var catID interface{}
	if cid := strings.TrimSpace(req.CategoryID); cid != "" {
		catID = cid
	}
	var qty interface{}
	if req.Quantity != nil && *req.Quantity != 0 {
		qty = *req.Quantity
	}
	var unitPrice interface{}
	if req.UnitPrice != nil && *req.UnitPrice != 0 {
		unitPrice = *req.UnitPrice
	}
	var actor interface{}
	if strings.TrimSpace(actorID) != "" {
		actor = actorID
	}

	id := cuid2.Generate()
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO finance_transactions
			(id, unit_id, category_id, direction, amount, description, tx_date, party,
			 quantity, unit_price, reference, metadata, created_by, created_by_name, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, unitID, catID, dir, req.Amount, strings.TrimSpace(req.Description), txDateValue(req.TxDate),
		strings.TrimSpace(req.Party), qty, unitPrice, strings.TrimSpace(req.Reference),
		strings.TrimSpace(req.Metadata), actor, strings.TrimSpace(actorName), now, now)
	if err != nil {
		return nil, err
	}
	t, err := r.GetTransactionByID(id)
	if err != nil {
		return nil, err
	}
	_, _ = r.writeAudit("transaction", id, "create", actorID, actorName, "", mustJSON(t))
	return t, nil
}

func (r *FinanceRepository) UpdateTransaction(id string, req models.CreateFinanceTransactionRequest, actorID, actorName string) error {
	before, _ := r.GetTransactionByID(id)
	if before == nil {
		return sql.ErrNoRows
	}
	if req.Amount <= 0 {
		return errors.New("jumlah harus lebih dari 0")
	}
	dir := "in"
	if req.Direction == "out" {
		dir = "out"
	}
	var catID interface{}
	if cid := strings.TrimSpace(req.CategoryID); cid != "" {
		catID = cid
	}
	var qty interface{}
	if req.Quantity != nil && *req.Quantity != 0 {
		qty = *req.Quantity
	}
	var unitPrice interface{}
	if req.UnitPrice != nil && *req.UnitPrice != 0 {
		unitPrice = *req.UnitPrice
	}
	unitID := strings.TrimSpace(req.UnitID)
	if unitID == "" {
		unitID = before.UnitID
	}
	_, err := r.DB.Exec(`
		UPDATE finance_transactions
		SET unit_id = ?, category_id = ?, direction = ?, amount = ?, description = ?, tx_date = ?, party = ?,
		    quantity = ?, unit_price = ?, reference = ?, metadata = ?, updated_at = ?
		WHERE id = ?
	`, unitID, catID, dir, req.Amount, strings.TrimSpace(req.Description), txDateValue(req.TxDate),
		strings.TrimSpace(req.Party), qty, unitPrice, strings.TrimSpace(req.Reference),
		strings.TrimSpace(req.Metadata), UnixMilli(), id)
	if err != nil {
		return err
	}
	after, _ := r.GetTransactionByID(id)
	_, _ = r.writeAudit("transaction", id, "update", actorID, actorName, mustJSON(before), mustJSON(after))
	return nil
}

func (r *FinanceRepository) DeleteTransaction(id string, actorID, actorName string) error {
	before, _ := r.GetTransactionByID(id)
	if before == nil {
		return nil
	}
	if _, err := r.DB.Exec(`DELETE FROM finance_transactions WHERE id = ?`, id); err != nil {
		return err
	}
	_, _ = r.writeAudit("transaction", id, "delete", actorID, actorName, mustJSON(before), "")
	return nil
}

func scanTransaction(row rowScanner) (models.FinanceTransaction, error) {
	var t models.FinanceTransaction
	var catID, createdBy sql.NullString
	var qty sql.NullFloat64
	var unitPrice sql.NullInt64
	var txDate, ca, ua sql.NullInt64
	if err := row.Scan(&t.ID, &t.UnitID, &t.UnitName, &catID, &t.CategoryName, &t.Direction, &t.Amount,
		&t.Description, &txDate, &t.Party, &qty, &unitPrice, &t.Reference, &t.Metadata,
		&createdBy, &t.CreatedByName, &ca, &ua); err != nil {
		return t, err
	}
	if catID.Valid && catID.String != "" {
		t.CategoryID = &catID.String
	}
	if createdBy.Valid && createdBy.String != "" {
		t.CreatedBy = &createdBy.String
	}
	if qty.Valid {
		v := qty.Float64
		t.Quantity = &v
	}
	if unitPrice.Valid {
		v := int(unitPrice.Int64)
		t.UnitPrice = &v
	}
	t.TxDate = msToTime(txDate)
	t.CreatedAt = msToTime(ca)
	t.UpdatedAt = msToTime(ua)
	return t, nil
}

// ---------- Ringkasan & Rekap ----------

func (r *FinanceRepository) SummaryByUnit(unitID string) (*models.FinanceSummary, error) {
	unit, err := r.GetUnitByID(unitID)
	if err != nil {
		return nil, err
	}
	if unit == nil {
		return nil, nil
	}
	s := &models.FinanceSummary{UnitID: unit.ID, UnitName: unit.Name, UnitCode: unit.Code}
	rows, err := r.DB.Query(`
		SELECT direction, COALESCE(SUM(amount),0), COUNT(*)
		FROM finance_transactions WHERE unit_id = ? GROUP BY direction
	`, unitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var dir string
		var total, count int
		if err := rows.Scan(&dir, &total, &count); err != nil {
			continue
		}
		if dir == "in" {
			s.TotalIn = total
		} else {
			s.TotalOut = total
		}
		s.TxCount += count
	}
	s.Balance = s.TotalIn - s.TotalOut
	return s, nil
}

func (r *FinanceRepository) SummaryAllUnits() ([]models.FinanceSummary, error) {
	units, err := r.ListUnits(true)
	if err != nil {
		return nil, err
	}
	out := []models.FinanceSummary{}
	for _, u := range units {
		s, err := r.SummaryByUnit(u.ID)
		if err != nil || s == nil {
			continue
		}
		out = append(out, *s)
	}
	return out, nil
}

func (r *FinanceRepository) RecapByCategory(unitID string, dateFrom, dateTo int64) ([]models.FinanceCategoryRecap, error) {
	clauses := []string{"t.unit_id = ?"}
	args := []interface{}{unitID}
	if dateFrom > 0 {
		clauses = append(clauses, "t.tx_date >= ?")
		args = append(args, dateFrom)
	}
	if dateTo > 0 {
		clauses = append(clauses, "t.tx_date < ?")
		args = append(args, dateTo)
	}
	q := `SELECT COALESCE(t.category_id,''), COALESCE(c.name,'(Tanpa Kategori)'), t.direction,
		COALESCE(SUM(t.amount),0), COUNT(*)
		FROM finance_transactions t
		LEFT JOIN finance_categories c ON c.id = t.category_id
		WHERE ` + strings.Join(clauses, " AND ") + `
		GROUP BY t.category_id, t.direction ORDER BY 4 DESC`
	rows, err := r.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.FinanceCategoryRecap{}
	for rows.Next() {
		var c models.FinanceCategoryRecap
		if err := rows.Scan(&c.CategoryID, &c.Name, &c.Direction, &c.Total, &c.TxCount); err != nil {
			continue
		}
		out = append(out, c)
	}
	return out, nil
}

func (r *FinanceRepository) RecapMonthly(unitID string, limit int) ([]models.FinanceMonthlyRecap, error) {
	clauses := []string{"1=1"}
	args := []interface{}{}
	if strings.TrimSpace(unitID) != "" {
		clauses = append(clauses, "unit_id = ?")
		args = append(args, unitID)
	}
	if limit < 1 || limit > 120 {
		limit = 24
	}
	// tx_date disimpan dalam epoch ms → bagi 1000 untuk unixepoch().
	q := `SELECT strftime('%Y-%m', tx_date/1000, 'unixepoch') AS period,
		direction, COALESCE(SUM(amount),0), COUNT(*)
		FROM finance_transactions
		WHERE ` + strings.Join(clauses, " AND ") + `
		GROUP BY period, direction ORDER BY period DESC`
	rows, err := r.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byPeriod := map[string]*models.FinanceMonthlyRecap{}
	order := []string{}
	for rows.Next() {
		var period, dir string
		var total, count int
		if err := rows.Scan(&period, &dir, &total, &count); err != nil {
			continue
		}
		m, ok := byPeriod[period]
		if !ok {
			m = &models.FinanceMonthlyRecap{Period: period}
			byPeriod[period] = m
			order = append(order, period)
		}
		if dir == "in" {
			m.TotalIn = total
		} else {
			m.TotalOut = total
		}
		m.TxCount += count
	}
	out := []models.FinanceMonthlyRecap{}
	for _, p := range order {
		if len(out) >= limit {
			break
		}
		m := byPeriod[p]
		m.Net = m.TotalIn - m.TotalOut
		out = append(out, *m)
	}
	return out, nil
}

func (r *FinanceRepository) ListAuditLog(limit int) ([]models.FinanceAuditLog, error) {
	if limit < 1 || limit > 500 {
		limit = 100
	}
	rows, err := r.DB.Query(`
		SELECT id, entity, entity_id, action, actor_id, COALESCE(actor_name,''),
		       COALESCE(before,''), COALESCE(after,''), COALESCE(created_at,0)
		FROM finance_audit_log ORDER BY created_at DESC LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.FinanceAuditLog{}
	for rows.Next() {
		var a models.FinanceAuditLog
		var actorID sql.NullString
		var ca sql.NullInt64
		if err := rows.Scan(&a.ID, &a.Entity, &a.EntityID, &a.Action, &actorID, &a.ActorName, &a.Before, &a.After, &ca); err != nil {
			continue
		}
		if actorID.Valid && actorID.String != "" {
			a.ActorID = &actorID.String
		}
		a.CreatedAt = msToTime(ca)
		out = append(out, a)
	}
	return out, nil
}

func (r *FinanceRepository) writeAudit(entity, entityID, action, actorID, actorName, before, after string) (string, error) {
	id := cuid2.Generate()
	var actor interface{}
	if strings.TrimSpace(actorID) != "" {
		actor = actorID
	}
	_, err := r.DB.Exec(`
		INSERT INTO finance_audit_log (id, entity, entity_id, action, actor_id, actor_name, before, after, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, entity, entityID, action, actor, strings.TrimSpace(actorName), before, after, UnixMilli())
	return id, err
}

// ---------- Helpers ----------

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	lastDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		case r == ' ' || r == '-' || r == '_':
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}

func mustJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}
