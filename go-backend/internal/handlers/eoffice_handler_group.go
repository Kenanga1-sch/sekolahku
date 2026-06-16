package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
)

func (h *EOfficeHandler) GetTemplateGroups(c echo.Context) error {
	list, err := h.Repo.GetTemplateGroups()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *EOfficeHandler) GetTemplateGroupByID(c echo.Context) error {
	id := c.Param("id")
	t, err := h.Repo.GetTemplateGroupByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Grup template tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": t})
}

func (h *EOfficeHandler) CreateTemplateGroup(c echo.Context) error {
	var g models.LetterTemplateGroup
	if err := c.Bind(&g); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if strings.TrimSpace(g.Name) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nama grup wajib diisi"})
	}
	
	id, err := h.Repo.CreateTemplateGroup(g)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *EOfficeHandler) UpdateTemplateGroup(c echo.Context) error {
	id := c.Param("id")
	var g models.LetterTemplateGroup
	if err := c.Bind(&g); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateTemplateGroup(id, g); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Grup template tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *EOfficeHandler) DeleteTemplateGroup(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteTemplateGroup(id); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Grup template tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *EOfficeHandler) GenerateGroupAndSubmit(c echo.Context) error {
	var req struct {
		GroupID            string            `json:"groupId"`
		ClassificationCode string            `json:"classificationCode"`
		Recipient          string            `json:"recipient"`
		SubjectPrefix      string            `json:"subjectPrefix"`
		MailNumber         string            `json:"mailNumber"` // Optionally left blank to auto-generate
		DateOfLetter       string            `json:"dateOfLetter"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if req.Recipient == "" || req.GroupID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Penerima dan grup template wajib diisi"})
	}

	group, err := h.Repo.GetTemplateGroupByID(req.GroupID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Grup tidak ditemukan"})
	}

	uid := currentUserID(c)
	dateLetter := req.DateOfLetter
	if dateLetter == "" {
		dateLetter = time.Now().Format("2006-01-02")
	}

	var generatedIds []string

	for _, item := range group.Items {
		subject := req.SubjectPrefix
		if subject == "" {
			subject = item.Template.Name
		} else {
			subject = subject + " - " + item.Template.Name
		}
		
		sk := models.SuratKeluar{
			MailNumber:         req.MailNumber, // Note: if blank, repo will auto-generate sequence
			Recipient:          req.Recipient,
			Subject:            subject,
			DateOfLetter:       dateLetter,
			ClassificationCode: stringPtrIfNotEmpty(req.ClassificationCode),
			TemplateID:         stringPtrIfNotEmpty(item.TemplateID),
			Status:             "Menunggu Verifikasi",
			CreatedBy:          &uid,
		}
		
		// If MailNumber is not blank, we might have duplicate mail numbers. That is usually allowed for bundles.
		// However, CreateSuratKeluar (or CreateSuratKeluarFromTemplate) handles it.
		// Wait, CreateSuratKeluarFromTemplate doesn't auto-generate mail number! It assumes it's provided.
		// So we use CreateSuratKeluar which auto-generates if blank.
		
		id, _, err := h.Repo.CreateSuratKeluar(sk)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		}
		generatedIds = append(generatedIds, id)
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true, 
		"ids": generatedIds, 
		"status": "Menunggu Verifikasi",
	})
}
