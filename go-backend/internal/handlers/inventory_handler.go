package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type InventoryHandler struct {
	Repo *repository.InventoryRepository
}

func NewInventoryHandler(repo *repository.InventoryRepository) *InventoryHandler {
	return &InventoryHandler{Repo: repo}
}

func (h *InventoryHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

func (h *InventoryHandler) GetRooms(c echo.Context) error {
	q := c.QueryParam("q")
	rooms, err := h.Repo.GetRooms(q)
	if err != nil {
		c.Logger().Error("Failed to get rooms:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      rooms,
		"totalItems": len(rooms),
	})
}

func (h *InventoryHandler) GetRoom(c echo.Context) error {
	id := c.Param("id")
	room, err := h.Repo.GetRoomByID(id)
	if err != nil {
		c.Logger().Error("Failed to get room:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}
	if room == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Room not found"})
	}
	return c.JSON(http.StatusOK, room)
}

func (h *InventoryHandler) CreateRoom(c echo.Context) error {
	var req models.CreateInventoryRoomRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama ruangan wajib diisi"})
	}

	room, err := h.Repo.CreateRoom(req)
	if err != nil {
		c.Logger().Error("Failed to create room:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}

	return c.JSON(http.StatusOK, room)
}

func (h *InventoryHandler) UpdateRoom(c echo.Context) error {
	id := c.Param("id")
	var req models.CreateInventoryRoomRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	room, err := h.Repo.UpdateRoom(id, req)
	if err != nil {
		c.Logger().Error("Failed to update room:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}

	return c.JSON(http.StatusOK, room)
}

func (h *InventoryHandler) DeleteRoom(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteRoom(id); err != nil {
		c.Logger().Error("Failed to delete room:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}

	return c.NoContent(http.StatusNoContent)
}

// Assets
func (h *InventoryHandler) GetAssets(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 { limit = 20 }
	roomId := c.QueryParam("roomId")
	search := c.QueryParam("search")
	category := c.QueryParam("category")

	items, total, err := h.Repo.GetAssets(page, limit, roomId, search, category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      items,
		"totalItems": total,
		"totalPages": (total + limit - 1) / limit,
	})
}

func (h *InventoryHandler) CreateAsset(c echo.Context) error {
	var a models.InventoryAsset
	if err := c.Bind(&a); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	id, err := h.Repo.CreateAsset(a)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": id, "success": "true"})
}

func (h *InventoryHandler) UpdateAsset(c echo.Context) error {
	id := c.Param("id")
	var a models.InventoryAsset
	if err := c.Bind(&a); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.UpdateAsset(id, a); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}

func (h *InventoryHandler) DeleteAsset(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAsset(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}

// Items (Stock)
func (h *InventoryHandler) GetItems(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 { limit = 20 }
	search := c.QueryParam("search")
	category := c.QueryParam("category")

	items, total, err := h.Repo.GetItems(page, limit, search, category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      items,
		"totalItems": total,
		"totalPages": (total + limit - 1) / limit,
	})
}

func (h *InventoryHandler) CreateItem(c echo.Context) error {
	var i models.InventoryItem
	if err := c.Bind(&i); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.CreateItem(i); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]string{"success": "true"})
}

// Transactions
func (h *InventoryHandler) CreateTransaction(c echo.Context) error {
	var t models.InventoryTransaction
	if err := c.Bind(&t); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.CreateTransaction(t); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]string{"success": "true"})
}

// Opname
func (h *InventoryHandler) GetOpnames(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 { limit = 20 }
	items, total, err := h.Repo.GetOpnames(page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      items,
		"totalItems": total,
	})
}

func (h *InventoryHandler) CreateOpname(c echo.Context) error {
	var o models.InventoryOpname
	if err := c.Bind(&o); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.CreateOpname(o); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]string{"success": "true"})
}

func (h *InventoryHandler) ApplyOpname(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.ApplyOpname(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}

func (h *InventoryHandler) GetAuditLogs(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 { limit = 20 }
	logs, err := h.Repo.GetAuditLogs(limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    logs,
	})
}
