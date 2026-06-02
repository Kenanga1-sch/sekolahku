package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type AuditLogRepository struct {
	DB *sql.DB
}

func NewAuditLogRepository(db *sql.DB) *AuditLogRepository {
	return &AuditLogRepository{DB: db}
}

func (r *AuditLogRepository) GetLogs(page, limit int, action, resource string) ([]models.AuditLog, int, error) {
	offset := (page - 1) * limit
	where := []string{"1=1"}
	var args []interface{}

	if action != "" && action != "all" {
		where = append(where, "UPPER(action) = ?")
		args = append(args, normalizeAuditAction(action))
	}
	if resource != "" && resource != "all" {
		aliases := auditResourceFilterValues(resource)
		placeholders := strings.TrimRight(strings.Repeat("?,", len(aliases)), ",")
		where = append(where, fmt.Sprintf("UPPER(resource) IN (%s)", placeholders))
		for _, alias := range aliases {
			args = append(args, alias)
		}
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + fmt.Sprintf("%s", joinStrings(where, " AND "))
	}

	// 1. Count Total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM audit_logs %s", whereClause)
	err := r.DB.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// 2. Fetch Data
	query := fmt.Sprintf(`
		SELECT id, action, resource, details, user_id, user_name, user_email, ip_address, user_agent, created_at
		FROM audit_logs
		%s
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	finalArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, finalArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		var details, uid, uname, uemail, ip, ua sql.NullString
		var crAt sql.NullInt64

		err := rows.Scan(&l.ID, &l.Action, &l.Resource, &details, &uid, &uname, &uemail, &ip, &ua, &crAt)
		if err != nil {
			return nil, 0, err
		}

		l.Action = normalizeAuditAction(l.Action)
		l.Resource = normalizeAuditResource(l.Resource)
		if details.Valid {
			l.Details = &details.String
		}
		if uid.Valid {
			l.UserID = &uid.String
		}
		if uname.Valid {
			l.UserName = &uname.String
		}
		if uemail.Valid {
			l.UserEmail = &uemail.String
		}
		if ip.Valid {
			l.IPAddress = &ip.String
		}
		if ua.Valid {
			l.UserAgent = &ua.String
		}

		cTime := ToTime(crAt)
		l.CreatedAt = &cTime

		logs = append(logs, l)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	if logs == nil {
		logs = []models.AuditLog{}
	}

	return logs, total, nil
}

func (r *AuditLogRepository) CreateLog(l models.AuditLog) error {
	if l.ID == "" {
		l.ID = cuid2.Generate()
	}
	now := time.Now().UnixMilli()
	l.Action = normalizeAuditAction(l.Action)
	l.Resource = normalizeAuditResource(l.Resource)

	query := `
		INSERT INTO audit_logs (id, action, resource, details, user_id, user_name, user_email, ip_address, user_agent, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, l.ID, l.Action, l.Resource, l.Details, l.UserID, l.UserName, l.UserEmail, l.IPAddress, l.UserAgent, now)
	return err
}

func joinStrings(s []string, sep string) string {
	res := ""
	for i, v := range s {
		if i > 0 {
			res += sep
		}
		res += v
	}
	return res
}

func normalizeAuditAction(action string) string {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "create", "buat":
		return "CREATE"
	case "update", "edit", "ubah":
		return "UPDATE"
	case "delete", "hapus":
		return "DELETE"
	case "login":
		return "LOGIN"
	case "logout":
		return "LOGOUT"
	case "approve", "setujui":
		return "APPROVE"
	case "reject", "tolak":
		return "REJECT"
	case "restore", "pulihkan":
		return "RESTORE"
	case "export":
		return "EXPORT"
	case "upload":
		return "UPLOAD"
	default:
		normalized := strings.ToUpper(strings.TrimSpace(action))
		if normalized == "" {
			return "UPDATE"
		}
		return normalized
	}
}

func normalizeAuditResource(resource string) string {
	switch strings.ToLower(strings.TrimSpace(resource)) {
	case "user", "users", "pengguna":
		return "USER"
	case "student", "students", "siswa":
		return "STUDENT"
	case "inventory", "inventaris":
		return "INVENTORY"
	case "surat_masuk", "surat-masuk":
		return "SURAT_MASUK"
	case "surat_keluar", "surat-keluar":
		return "SURAT_KELUAR"
	case "settings", "setting", "config", "school_settings", "pengaturan":
		return "CONFIG"
	case "profile", "security", "system", "sistem":
		return "SYSTEM"
	case "finance", "keuangan":
		return "FINANCE"
	case "tabungan", "savings":
		return "TABUNGAN"
	case "spmb":
		return "SPMB"
	default:
		normalized := strings.ToUpper(strings.TrimSpace(resource))
		if normalized == "" {
			return "SYSTEM"
		}
		return normalized
	}
}

func auditResourceFilterValues(resource string) []string {
	normalized := normalizeAuditResource(resource)

	switch normalized {
	case "USER":
		return []string{"USER", "USERS", "PENGGUNA"}
	case "STUDENT":
		return []string{"STUDENT", "STUDENTS", "SISWA"}
	case "INVENTORY":
		return []string{"INVENTORY", "INVENTARIS"}
	case "CONFIG":
		return []string{"CONFIG", "SETTINGS", "SETTING", "SCHOOL_SETTINGS", "PENGATURAN"}
	case "SYSTEM":
		return []string{"SYSTEM", "PROFILE", "SECURITY", "SISTEM"}
	case "FINANCE":
		return []string{"FINANCE", "KEUANGAN"}
	case "TABUNGAN":
		return []string{"TABUNGAN", "SAVINGS"}
	default:
		return []string{normalized}
	}
}
