package models


// Curriculum / Grades
type StudentGrade struct {
	StudentID string  `json:"studentId"`
	Score     int     `json:"score"`
	Type      string  `json:"type"`
	Notes     *string `json:"notes"`
}

type BulkGradeRequest struct {
	TpID   string         `json:"tpId"`
	Grades []StudentGrade `json:"grades"`
}
