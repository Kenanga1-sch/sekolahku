package models

// AttendancePoint adalah satu titik lokasi presensi (sekolah / ekskul / custom)
// dengan radius toleransi meter. Dipakai untuk memvalidasi radius scan QR.
type AttendancePoint struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	PointType string  `json:"pointType"` // 'sekolah' | 'ekskul' | 'custom'
	RefID     *string `json:"refId,omitempty"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	RadiusM   int     `json:"radiusM"`
	IsActive  bool    `json:"isActive"`
}

// CreateAttendancePointRequest payload buat/ubah titik presensi.
type CreateAttendancePointRequest struct {
	Name      string  `json:"name"`
	PointType string  `json:"pointType"`
	RefID     *string `json:"refId,omitempty"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	RadiusM   int     `json:"radiusM"`
	IsActive  *bool   `json:"isActive,omitempty"`
}

// ExtracurricularTeacher menghubungkan GTK (employee) dengan ekskul yang
// diampu. Satu GTK boleh mengampu beberapa ekskul. Bila pointId diisi, presensi
// ekskul divalidasi terhadap titik itu; bila kosong pakai titik sekolah.
type ExtracurricularTeacher struct {
	ID                  string  `json:"id"`
	EmployeeID          string  `json:"employeeId"`
	Name                string  `json:"name"`
	NIP                 *string `json:"nip,omitempty"`
	ExtracurricularName string  `json:"extracurricularName"`
	Schedule            *string `json:"schedule,omitempty"`
	PointID             *string `json:"pointId,omitempty"`
	PointName           *string `json:"pointName,omitempty"`
	IsActive            bool    `json:"isActive"`
}

// CreateExtracurricularTeacherRequest payload menautkan pengajar ekskul.
type CreateExtracurricularTeacherRequest struct {
	EmployeeID          string  `json:"employeeId"`
	ExtracurricularName string  `json:"extracurricularName"`
	Schedule            *string `json:"schedule,omitempty"`
	PointID             *string `json:"pointId,omitempty"`
	IsActive            *bool   `json:"isActive,omitempty"`
}

// ScanGTKRequest payload scan presensi GTK (dengan geolokasi untuk validasi radius).
type ScanGTKRequest struct {
	QRCode     string   `json:"qrCode"`
	Status     string   `json:"status"`
	RecordedBy string   `json:"recordedBy"`
	Latitude   *float64 `json:"latitude,omitempty"`
	Longitude  *float64 `json:"longitude,omitempty"`
	// PointID: titik presensi yang dipakai (default titik sekolah). Untuk
	// presensi ekskul, bisa diarahkan ke titik ekskul.
	PointID *string `json:"pointId,omitempty"`
	// ExtracurricularID: diisi bila ini presensi sesi ekskul.
	ExtracurricularID *string `json:"extracurricularId,omitempty"`
	// OverrideRadius hanya boleh dipakai admin/bendahara; alasan wajib diisi.
	OverrideRadius bool   `json:"overrideRadius,omitempty"`
	OverrideReason string `json:"overrideReason,omitempty"`
}

// PresensiSettings ringkasan pengaturan presensi (radius default + titik aktif).
type PresensiSettings struct {
	RequireRadius  bool               `json:"requireRadius"`
	DefaultRadiusM int                `json:"defaultRadiusM"`
	Points         []AttendancePoint  `json:"points"`
}
