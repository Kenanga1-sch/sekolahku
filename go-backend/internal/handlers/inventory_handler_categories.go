package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/shared"
)

// ============ Kategori Inventaris (CRUD) ============
//
// Kategori terkelola sejak migrasi 000085. Sebelumnya kategori hanya konstanta
// di frontend, sehingga admin tak bisa menambah/mengubahnya tanpa deploy.
// Membaca kategori terbuka untuk semua pengguna modul; menulis dikunci admin
// di level rute (lihat routes.go).

func (h *InventoryHandler) GetCategories(c echo.Context) error {
	kind := c.QueryParam("kind")
	categories, err := h.Repo.ListCategories(kind)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"items":   categories,
		"data":    categories,
	})
}

// buildCategoryPayload memvalidasi payload kategori menjadi model.
func buildCategoryPayload(p inventoryCategoryPayload) (models.InventoryCategory, error) {
	name := strings.TrimSpace(p.Name)
	if name == "" {
		return models.InventoryCategory{}, errCategoryNameRequired
	}
	kind := strings.ToUpper(strings.TrimSpace(p.Kind))
	if kind == "" {
		kind = "ASSET"
	}
	if !models.ValidInventoryCategoryKinds[kind] {
		return models.InventoryCategory{}, errCategoryKindInvalid
	}
	return models.InventoryCategory{
		Name:       name,
		CodePrefix: normalizeStringPtr(p.CodePrefix),
		Kind:       kind,
		SortOrder:  p.SortOrder,
	}, nil
}

type categoryValidationError string

func (e categoryValidationError) Error() string { return string(e) }

const (
	errCategoryNameRequired categoryValidationError = "Nama kategori wajib diisi"
	errCategoryKindInvalid  categoryValidationError = "Jenis kategori tidak valid"
)

func (h *InventoryHandler) CreateCategory(c echo.Context) error {
	var payload inventoryCategoryPayload
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	cat, err := buildCategoryPayload(payload)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	created, err := h.Repo.CreateCategory(cat)
	if err != nil {
		if err.Error() == "Nama kategori sudah dipakai" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "item": created})
}

func (h *InventoryHandler) UpdateCategory(c echo.Context) error {
	id := c.Param("id")
	var payload inventoryCategoryPayload
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	cat, err := buildCategoryPayload(payload)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	updated, err := h.Repo.UpdateCategory(id, cat)
	if err != nil {
		if err.Error() == "Nama kategori sudah dipakai" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return inventoryError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "item": updated})
}

func (h *InventoryHandler) DeleteCategory(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteCategory(id); err != nil {
		return inventoryError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}

// ============ Preview kode inventaris otomatis ============

// GetNextCode mengembalikan kode berikutnya untuk ditampilkan di form.
// Hanya preview; nomor final ditetapkan saat simpan.
func (h *InventoryHandler) GetNextCode(c echo.Context) error {
	kind := c.QueryParam("kind")
	if kind == "" {
		kind = "ASSET"
	}
	category := c.QueryParam("category")
	year, _ := strconv.Atoi(c.QueryParam("year"))
	if year < 1 {
		year = 0 // biar repo memakai tahun berjalan
	}
	code, err := h.Repo.PreviewNextCode(kind, category, year)
	if err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "code": code})
}
