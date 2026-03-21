package models

type Employee struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	FullName         *string `json:"fullName"`
	Email            string  `json:"email"`
	Role             string  `json:"role"`
	NIP              *string `json:"nip"`
	NUPTK            *string `json:"nuptk"`
	EmploymentStatus *string `json:"employmentStatus"`
	JobType          *string `json:"jobType"`
	UserID           *string `json:"userId"`
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
}
