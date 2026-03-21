package models

import "time"

type InventoryRoom struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Code        *string    `json:"code"`
	Description *string    `json:"description"`
	Location    *string    `json:"location"`
	PICID       *string    `json:"picId"`
	PIC         *User      `json:"pic,omitempty"`
	CreatedAt   *time.Time `json:"createdAt"`
}

type CreateInventoryRoomRequest struct {
	Name        string  `json:"name"`
	Code        *string `json:"code,omitempty"`
	Description *string `json:"description,omitempty"`
	Location    *string `json:"location,omitempty"`
	PICID       *string `json:"picId,omitempty"`
}
