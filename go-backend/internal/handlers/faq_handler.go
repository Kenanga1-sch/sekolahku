package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type FAQHandler struct {
	Repo *repository.FAQRepository
}

func NewFAQHandler(repo *repository.FAQRepository) *FAQHandler {
	return &FAQHandler{Repo: repo}
}

func (h *FAQHandler) GetPublicFAQs(c echo.Context) error {
	faqs, err := h.Repo.GetPublicFAQs()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengambil data FAQ",
		})
	}

	// Group by category
	type CategoryGroup struct {
		ID        string       `json:"id"`
		Title     string       `json:"title"`
		Questions []interface{} `json:"questions"`
	}

	groups := make(map[string]*CategoryGroup)
	categoryTitles := map[string]string{
		"spmb":     "Pendaftaran SPMB",
		"akademik": "Akademik & Kurikulum",
		"biaya":    "Biaya & Pembayaran",
		"lokasi":   "Lokasi & Kontak",
	}

	for _, f := range faqs {
		if _, ok := groups[f.Category]; !ok {
			title := f.Category
			if t, ok := categoryTitles[f.Category]; ok {
				title = t
			}
			groups[f.Category] = &CategoryGroup{
				ID:    f.Category,
				Title: title,
			}
		}
		groups[f.Category].Questions = append(groups[f.Category].Questions, map[string]string{
			"q": f.Question,
			"a": f.Answer,
		})
	}

	// Convert map to slice in order of categoryTitles keys if possible, or just slice
	var result []*CategoryGroup
	order := []string{"spmb", "akademik", "biaya", "lokasi"}
	for _, cat := range order {
		if g, ok := groups[cat]; ok {
			result = append(result, g)
		}
	}
	
	// Add other categories not in order
	for cat, g := range groups {
		found := false
		for _, o := range order {
			if cat == o { found = true; break }
		}
		if !found {
			result = append(result, g)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

func (h *FAQHandler) CreateFAQ(c echo.Context) error {
	var req models.CreateFAQRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	id, err := h.Repo.CreateFAQ(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "id": id})
}

func (h *FAQHandler) ListFAQsAdmin(c echo.Context) error {
	faqs, err := h.Repo.GetPublicFAQs() // Use GetPublicFAQs for now or a dedicated admin list
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": faqs})
}

func (h *FAQHandler) UpdateFAQ(c echo.Context) error {
	id := c.Param("id")
	var req models.UpdateFAQRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if err := h.Repo.UpdateFAQ(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *FAQHandler) DeleteFAQ(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteFAQ(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
