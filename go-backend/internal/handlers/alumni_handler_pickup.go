package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/shared"
)

func (h *AlumniHandler) CreatePickup(c echo.Context) error {
	alumniID := c.Param("id")
	var req struct {
		DocumentTypeID    *string `json:"documentTypeId"`
		RecipientName     string  `json:"recipientName"`
		RecipientRelation string  `json:"recipientRelation"`
		RecipientIDNumber string  `json:"recipientIdNumber"`
		RecipientPhone    string  `json:"recipientPhone"`
		PickupDate       string  `json:"pickupDate"`
		Notes            string  `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	if strings.TrimSpace(req.RecipientName) == "" {
		return shared.BadRequest(c, "Nama penerima wajib diisi")
	}
	pickupDate, err := shared.ParseOptionalDate(req.PickupDate)
	if err != nil {
		return shared.BadRequest(c, err.Error())
	}

	p := models.DocumentPickup{
		AlumniID:          alumniID,
		DocumentTypeID:     req.DocumentTypeID,
		RecipientName:      strings.TrimSpace(req.RecipientName),
		RecipientRelation:  shared.StringPtr(req.RecipientRelation),
		RecipientIDNumber: shared.StringPtr(req.RecipientIDNumber),
		RecipientPhone:    shared.StringPtr(req.RecipientPhone),
		PickupDate:        pickupDate,
		Notes:             shared.StringPtr(req.Notes),
	}

	if err := h.Repo.CreatePickup(p); err != nil {
		return shared.InternalError(c)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

// scoreToLetter converts a numeric score to a letter grade.
func scoreToLetter(score float64) string {
	switch {
	case score >= 90:
		return "A"
	case score >= 78:
		return "B"
	case score >= 65:
		return "C"
	case score >= 50:
		return "D"
	default:
		return "E"
	}
}
