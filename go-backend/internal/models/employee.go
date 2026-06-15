package models

import "time"

type Employee struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	FullName         *string `json:"fullName"`
	Email            string  `json:"email"`
	Role             string  `json:"role"`
	Phone            *string `json:"phone"`
	NIP              *string `json:"nip"`
	NUPTK            *string `json:"nuptk"`
	NIK              *string `json:"nik"`
	EmploymentStatus *string `json:"employmentStatus"`
	JobType          *string `json:"jobType"`
	JoinDate         *string `json:"joinDate"`
	Category         *string `json:"category"`
	Degree           *string `json:"degree"`
	Quote            *string `json:"quote"`
	PhotoUrl         *string `json:"photoUrl"`
	DisplayOrder     *int    `json:"displayOrder"`
	UserID           *string `json:"userId"`
	EmployeeDetailID *string `json:"employeeDetailId"`
}

type EmployeePagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

type EmployeeResponse struct {
	Data       []Employee         `json:"data"`
	Pagination EmployeePagination `json:"pagination"`
}

type CreateEmployeeRequest struct {
	Email            string  `json:"email"`
	FullName         string  `json:"fullName"`
	Role             string  `json:"role"`
	Phone            *string `json:"phone,omitempty"`
	NIP              *string `json:"nip,omitempty"`
	NUPTK            *string `json:"nuptk,omitempty"`
	NIK              *string `json:"nik,omitempty"`
	EmploymentStatus *string `json:"employmentStatus,omitempty"`
	JobType          *string `json:"jobType,omitempty"`
	JoinDate         *string `json:"joinDate,omitempty"`
	Category         *string `json:"category,omitempty"`
	Degree           *string `json:"degree,omitempty"`
	Quote            *string `json:"quote,omitempty"`
	PhotoUrl         *string `json:"photoUrl,omitempty"`
	DisplayOrder     *int    `json:"displayOrder,omitempty"`
}

type StaffProfile struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Degree       *string    `json:"degree"`
	Position     string     `json:"position"`
	Category     string     `json:"category"`
	PhotoUrl     *string    `json:"photoUrl"`
	NIP          *string    `json:"nip"`
	Quote        *string    `json:"quote"`
	DisplayOrder int        `json:"displayOrder"`
	IsActive     bool       `json:"isActive"`
	CreatedAt    *time.Time `json:"createdAt"`
	UpdatedAt    *time.Time `json:"updatedAt"`
}

type StaffProfileResponse struct {
	Data []StaffProfile `json:"data"`
}
