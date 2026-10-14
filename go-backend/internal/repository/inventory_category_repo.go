package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// ============================================================
// Kategori inventaris (migrasi 000085)
//
// Sebelumnya kategori hanya konstanta di frontend, sehingga admin tidak bisa
// menambah/mengubahnya. Kategori ini juga pembawa code_prefix yang dipakai
// penomoran kode inventaris otomatis (lihat InventoryCodeGenerator).
// ============================================================

// kodeKategoriFallback adalah prefix bila kategori tidak ditemukan atau
// code_prefix-nya kosong. Diri-main dari nama kategori bila memungkinkan.
const kodeKategoriFallback = "BRG"

// ListCategories mengembalikan daftar kategori, difilter menurut kind.
// kind boleh "", "ASSET", "ITEM", atau "BOTH"; kind "ASSET" dan "ITEM" juga
// memuat kategori "BOTH" karena kategori itu berlaku untuk keduanya.
func (r *InventoryRepository) ListCategories(kind string) ([]models.InventoryCategory, error) {
	query := `
		SELECT id, name, code_prefix, kind, COALESCE(sort_order, 0), created_at, updated_at
		FROM inventory_categories
		WHERE deleted_at IS NULL
	`
	var args []interface{}
	kind = strings.ToUpper(strings.TrimSpace(kind))
	if kind != "" {
		query += " AND (kind = ? OR kind = 'BOTH')"
		args = append(args, kind)
	}
	query += " ORDER BY sort_order ASC, name ASC"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]models.InventoryCategory, 0)
	for rows.Next() {
		var c models.InventoryCategory
		var prefix sql.NullString
		var crAt, upAt sql.NullInt64
		if err := rows.Scan(&c.ID, &c.Name, &prefix, &c.Kind, &c.SortOrder, &crAt, &upAt); err != nil {
			return nil, err
		}
		if prefix.Valid {
			c.CodePrefix = &prefix.String
		}
		if crAt.Valid {
			t := time.UnixMilli(crAt.Int64)
			c.CreatedAt = &t
		}
		if upAt.Valid {
			t := time.UnixMilli(upAt.Int64)
			c.UpdatedAt = &t
		}
		categories = append(categories, c)
	}
	return categories, rows.Err()
}

// GetCategoryByID mengambil satu kategori. Mengembalikan ErrInventoryNotFound
// bila tidak ada, agar handler memetakan ke 404.
func (r *InventoryRepository) GetCategoryByID(id string) (*models.InventoryCategory, error) {
	var c models.InventoryCategory
	var prefix sql.NullString
	var crAt, upAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT id, name, code_prefix, kind, COALESCE(sort_order, 0), created_at, updated_at
		FROM inventory_categories
		WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&c.ID, &c.Name, &prefix, &c.Kind, &c.SortOrder, &crAt, &upAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInventoryNotFound
		}
		return nil, err
	}
	if prefix.Valid {
		c.CodePrefix = &prefix.String
	}
	if crAt.Valid {
		t := time.UnixMilli(crAt.Int64)
		c.CreatedAt = &t
	}
	if upAt.Valid {
		t := time.UnixMilli(upAt.Int64)
		c.UpdatedAt = &t
	}
	return &c, nil
}

// CreateCategory menyimpan kategori baru. Nama dan kind divalidasi di handler;
// repo hanya mencegah duplikasi nama (case-insensitive) dalam kind yang sama.
func (r *InventoryRepository) CreateCategory(c models.InventoryCategory) (*models.InventoryCategory, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	var exists int
	if err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM inventory_categories
		WHERE deleted_at IS NULL AND LOWER(name) = LOWER(?) AND (kind = ? OR kind = 'BOTH' OR ? = 'BOTH')
	`, c.Name, c.Kind, c.Kind).Scan(&exists); err != nil {
		return nil, err
	}
	if exists > 0 {
		return nil, newInventoryBusinessError("Nama kategori sudah dipakai")
	}

	prefix := strings.ToUpper(strings.TrimSpace(ptrStringOr(c.CodePrefix, "")))
	var prefixArg interface{}
	if prefix == "" {
		prefixArg = nil
	} else {
		prefixArg = prefix
	}

	if _, err := r.DB.Exec(`
		INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, strings.TrimSpace(c.Name), prefixArg, strings.ToUpper(strings.TrimSpace(c.Kind)), c.SortOrder, now, now); err != nil {
		return nil, err
	}
	r.logInventoryAudit("CREATE", "CATEGORY", id, []map[string]interface{}{
		{"field": "name", "oldValue": nil, "newValue": c.Name},
		{"field": "kind", "oldValue": nil, "newValue": c.Kind},
	}, nil)
	return r.GetCategoryByID(id)
}

// UpdateCategory mengubah kategori. code_prefix yang diubah tidak menggeser
// kode inventaris yang sudah terbit — kode final saat dibuat.
func (r *InventoryRepository) UpdateCategory(id string, c models.InventoryCategory) (*models.InventoryCategory, error) {
	now := time.Now().UnixMilli()

	var exists int
	if err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM inventory_categories
		WHERE deleted_at IS NULL AND id != ? AND LOWER(name) = LOWER(?) AND (kind = ? OR kind = 'BOTH' OR ? = 'BOTH')
	`, id, c.Name, c.Kind, c.Kind).Scan(&exists); err != nil {
		return nil, err
	}
	if exists > 0 {
		return nil, newInventoryBusinessError("Nama kategori sudah dipakai")
	}

	prefix := strings.ToUpper(strings.TrimSpace(ptrStringOr(c.CodePrefix, "")))
	var prefixArg interface{}
	if prefix == "" {
		prefixArg = nil
	} else {
		prefixArg = prefix
	}

	result, err := r.DB.Exec(`
		UPDATE inventory_categories
		SET name = ?, code_prefix = ?, kind = ?, sort_order = ?, updated_at = ?
		WHERE id = ? AND deleted_at IS NULL
	`, strings.TrimSpace(c.Name), prefixArg, strings.ToUpper(strings.TrimSpace(c.Kind)), c.SortOrder, now, id)
	if err != nil {
		return nil, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return nil, ErrInventoryNotFound
	}
	r.logInventoryAudit("UPDATE", "CATEGORY", id, []map[string]interface{}{
		{"field": "name", "oldValue": nil, "newValue": c.Name},
	}, nil)
	return r.GetCategoryByID(id)
}

// DeleteCategory melakukan soft delete. Kategori yang sudah dipakai aset/barang
// tetap bisa dihapus: kolom category pada inventory_assets/items menyimpan
// NAMA kategori (bukan id), sehingga data lama tetak terbaca walau kategori
// induknya dihapus.
func (r *InventoryRepository) DeleteCategory(id string) error {
	result, err := r.DB.Exec(`
		UPDATE inventory_categories SET deleted_at = ?, updated_at = ?
		WHERE id = ? AND deleted_at IS NULL
	`, UnixMilli(), UnixMilli(), id)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return ErrInventoryNotFound
	}
	r.logInventoryAudit("DELETE", "CATEGORY", id, []map[string]interface{}{
		{"field": "id", "oldValue": id, "newValue": nil},
	}, nil)
	return nil
}

// ptrStringOr mengembalikan nilai *string, atau fallback bila nil.
func ptrStringOr(p *string, fallback string) string {
	if p == nil {
		return fallback
	}
	return *p
}

// ============================================================
// Kode inventaris otomatis
//
// Format: INV/{PREFIX}-{TAHUN}-{URUT} contoh INV/BK-2026-01.
//
// - PREFIX berasal dari code_prefix kategori (mis. "BK" untuk Buku); bila
//   kosong/kategori tak ditemukan dipakai fallback.
// - URUT dihitung per prefix+seksen (kolom 'kind' dari kategori, atau
//   perbandingan kategori untuk barang) dalam tahun berjalan, lalu reset
//   ke 1 saat tahun berganti. Minimal 2 digit, melebar bila perlu (100+).
// - Kode final saat aset/barang dibuat; tidak di-generate ulang saat edit.
//
// Penomoran dilakukan dalam transaksi yang sama dengan INSERT aset/barang
// agar dua petugas yang menyimpan bersamaan tidak dapat mendapat nomor sama.
// Pertarungan dicegah ekstra dengan loop retry bila INSERT tersangkut
// pelanggaran unique (race tipis antara cek dan insert).
// ============================================================

// kodeCounterRow menjelaskan satu baris hitungan untuk penomoran.
//
// inventory_assets/inventory_items tidak punya kolom category_id, sehingga
// pengelompokan dipakai berdasarkan prefix yang dipakai oleh kode-kode yang
// sudah terbit. Cara ini membuat kode tetap unik meski kategori berganti nama.
type kodeCounterRow struct {
	prefix string
	year   int
	seq    int
}

// nextInventoryCode merangkai kode berikutnya dan mengembalikan (kode, seq).
//
// table menentukan tabel sumber ("inventory_assets" atau "inventory_items"),
// sedangkan group menentukan kelompok penomoran: nama kategori (dari
// inventory_categories.code_prefix) atau "ITEM" bila kategori tidak
// dikenali. Setiap kelompok punya urutannya sendiri per tahun.
func (r *InventoryRepository) nextInventoryCode(tx *sql.Tx, table, prefix string, year int) (string, int, error) {
	return nextInventoryCodeWith(tx, table, prefix, year)
}

// categoryPrefixTx membaca code_prefix kategori memakai koneksi transaksi yang
// diberikan. Penting: di lingkungan dengan max 1 koneksi (test), memakai r.DB
// saat transaksi masih terbuka akan menggantung selamanya.
func categoryPrefixTx(q queryRower, name, kind string) (string, bool) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", false
	}
	var prefix sql.NullString
	kind = strings.ToUpper(strings.TrimSpace(kind))
	err := q.QueryRow(`
		SELECT code_prefix FROM inventory_categories
		WHERE deleted_at IS NULL AND LOWER(name) = LOWER(?)
		  AND (kind = ? OR kind = 'BOTH' OR ? = '')
	`, name, kind, kind).Scan(&prefix)
	if err != nil || !prefix.Valid || strings.TrimSpace(prefix.String) == "" {
		return "", false
	}
	return strings.ToUpper(strings.TrimSpace(prefix.String)), true
}

// nextInventoryCodeWith adalah inti penomoran; dipisah agar PreviewNextCode
// (yang tidak butuh transaksi) memakai perhitungan yang sama persis.
func nextInventoryCodeWith(q queryer, table, prefix string, year int) (string, int, error) {
	prefix = strings.ToUpper(strings.TrimSpace(prefix))
	if prefix == "" {
		prefix = kodeKategoriFallback
	}

	// Hitung urutan dengan LIKE: kode-kode yang sudah terbit formatnya
	// INV/{PREFIX}-{YY}-{NN}, jadi cocokkan prefiks dan tahun tepat.
	pattern := fmt.Sprintf("INV/%s-%02d-%%", prefix, year%100)
	var seq int
	if err := q.QueryRow(
		fmt.Sprintf(`
			SELECT COUNT(*) FROM %s
			WHERE deleted_at IS NULL
			  AND code IS NOT NULL
			  AND UPPER(code) LIKE ?
		`, table),
		pattern,
	).Scan(&seq); err != nil {
		return "", 0, err
	}
	seq++

	return fmt.Sprintf("INV/%s-%02d-%02d", prefix, year%100, seq), seq, nil
}

// queryer menyatukan *sql.Tx dan *sql.DB untuk helper penomoran.
type queryer interface {
	QueryRow(query string, args ...interface{}) *sql.Row
}

// queryRower sama dengan queryer; dipisah agar niatnya jelas pada pemanggil
// yang mungkin memakai transaksi.
type queryRower = queryer

// PreviewNextCode mengembalikan kode berikutnya untuk ditampilkan di form
// tanpa menyimpan apa pun. kind "ASSET" atau "ITEM" menentukan tabel sumber.
// Nilai ini hanya perkiraan — nomor final ditetapkan saat simpan (dalam
// transaksi), karena bisa berubah bila ada penyimpanan bersamaan.
func (r *InventoryRepository) PreviewNextCode(kind, category string, year int) (string, error) {
	kind = strings.ToUpper(strings.TrimSpace(kind))
	table := "inventory_assets"
	if kind == "ITEM" {
		table = "inventory_items"
	}
	if year <= 0 {
		year = time.Now().Year()
	}
	prefix, ok := r.GetCategoryPrefixByName(category, kind)
	if !ok {
		prefix = kodeKategoriFallback
	}
	code, _, err := nextInventoryCodeWith(r.DB, table, prefix, year)
	return code, err
}

// ============================================================
// Rantai helper untuk mendapatkan code_prefix dari nama kategori.
// Dipakai form (preview) maupun repo (penomoran).
// ============================================================

// GetCategoryPrefixByName mencari code_prefix berdasarkan nama kategori.
// Mengembalikan ("", false) bila tidak cocok, sehingga pemanggil pakai fallback.
func (r *InventoryRepository) GetCategoryPrefixByName(name string, kind string) (string, bool) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", false
	}
	var prefix sql.NullString
	kind = strings.ToUpper(strings.TrimSpace(kind))
	err := r.DB.QueryRow(`
		SELECT code_prefix FROM inventory_categories
		WHERE deleted_at IS NULL AND LOWER(name) = LOWER(?)
		  AND (kind = ? OR kind = 'BOTH' OR ? = '')
	`, name, kind, kind).Scan(&prefix)
	if err != nil || !prefix.Valid || strings.TrimSpace(prefix.String) == "" {
		return "", false
	}
	return strings.ToUpper(strings.TrimSpace(prefix.String)), true
}
