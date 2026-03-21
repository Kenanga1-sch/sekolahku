package handlers

import (
	"net/http"

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

func (h *InventoryHandler) GetRooms(c echo.Context) error {
	q := c.QueryParam("q")
	rooms, err := h.Repo.GetRooms(q)
	if err != nil {
		c.Logger().Error("Failed to get rooms:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
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
