package repository

import (
	"database/sql"
	"errors"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type InventoryRepository struct {
	DB *sql.DB
}

func NewInventoryRepository(db *sql.DB) *InventoryRepository {
	return &InventoryRepository{DB: db}
}

func (r *InventoryRepository) GetRooms(q string) ([]models.InventoryRoom, error) {
	query := `
		SELECT r.id, r.name, r.code, r.description, r.location, r.pic_id, r.created_at,
		       u.id, u.name, u.email
		FROM inventory_rooms r
		LEFT JOIN users u ON r.pic_id = u.id
	`
	var args []interface{}
	if q != "" {
		query += " WHERE r.name LIKE ?"
		args = append(args, "%"+q+"%")
	}
	query += " ORDER BY r.created_at DESC"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []models.InventoryRoom
	for rows.Next() {
		var rm models.InventoryRoom
		var code, desc, loc, picId sql.NullString
		var createdAt sql.NullTime
		var uId, uName, uEmail sql.NullString

		err := rows.Scan(
			&rm.ID, &rm.Name, &code, &desc, &loc, &picId, &createdAt,
			&uId, &uName, &uEmail,
		)
		if err != nil {
			return nil, err
		}

		if code.Valid { rm.Code = &code.String }
		if desc.Valid { rm.Description = &desc.String }
		if loc.Valid { rm.Location = &loc.String }
		if picId.Valid { rm.PICID = &picId.String }
		if createdAt.Valid { rm.CreatedAt = &createdAt.Time }

		if uId.Valid {
			rm.PIC = &models.User{
				ID:    uId.String,
				Name:  &uName.String,
				Email: uEmail.String,
			}
		}

		rooms = append(rooms, rm)
	}

	if rooms == nil {
		rooms = []models.InventoryRoom{}
	}

	return rooms, nil
}

func (r *InventoryRepository) GetRoomByID(id string) (*models.InventoryRoom, error) {
	query := `
		SELECT r.id, r.name, r.code, r.description, r.location, r.pic_id, r.created_at,
		       u.id, u.name, u.email
		FROM inventory_rooms r
		LEFT JOIN users u ON r.pic_id = u.id
		WHERE r.id = ?
	`
	row := r.DB.QueryRow(query, id)

	var rm models.InventoryRoom
	var code, desc, loc, picId sql.NullString
	var createdAt sql.NullTime
	var uId, uName, uEmail sql.NullString

	err := row.Scan(
		&rm.ID, &rm.Name, &code, &desc, &loc, &picId, &createdAt,
		&uId, &uName, &uEmail,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Not found
		}
		return nil, err
	}

	if code.Valid { rm.Code = &code.String }
	if desc.Valid { rm.Description = &desc.String }
	if loc.Valid { rm.Location = &loc.String }
	if picId.Valid { rm.PICID = &picId.String }
	if createdAt.Valid { rm.CreatedAt = &createdAt.Time }

	if uId.Valid {
		rm.PIC = &models.User{
			ID:    uId.String,
			Name:  &uName.String,
			Email: uEmail.String,
		}
	}

	return &rm, nil
}

func (r *InventoryRepository) CreateRoom(req models.CreateInventoryRoomRequest) (*models.InventoryRoom, error) {
	id := cuid2.Generate()
	query := `INSERT INTO inventory_rooms (id, name, code, description, location, pic_id) VALUES (?, ?, ?, ?, ?, ?)`
	_, err := r.DB.Exec(query, id, req.Name, req.Code, req.Description, req.Location, req.PICID)
	if err != nil {
		return nil, err
	}
	return r.GetRoomByID(id)
}

func (r *InventoryRepository) UpdateRoom(id string, req models.CreateInventoryRoomRequest) (*models.InventoryRoom, error) {
	query := `UPDATE inventory_rooms SET name = ?, code = ?, description = ?, location = ?, pic_id = ? WHERE id = ?`
	_, err := r.DB.Exec(query, req.Name, req.Code, req.Description, req.Location, req.PICID, id)
	if err != nil {
		return nil, err
	}
	return r.GetRoomByID(id)
}

func (r *InventoryRepository) DeleteRoom(id string) error {
	query := `DELETE FROM inventory_rooms WHERE id = ?`
	_, err := r.DB.Exec(query, id)
	return err
}
