package main

import (
	"database/sql"
	"fmt"
	_ "modernc.org/sqlite"
	"os"
)

type ColumnFix struct {
	Table   string
	Name    string
	SQLType string
	Default string
}

func main() {
	dbPath := "../data/sekolahku.db"
	if len(os.Args) > 1 {
		dbPath = os.Args[1]
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Println("DB error:", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		fmt.Println("Ping error:", err)
		os.Exit(1)
	}

	fixes := []ColumnFix{
		// school_settings
		{Table: "school_settings", Name: "principal_name", SQLType: "TEXT"},
		{Table: "school_settings", Name: "principal_nip", SQLType: "TEXT"},
		{Table: "school_settings", Name: "is_maintenance", SQLType: "INTEGER", Default: "0"},
		{Table: "school_settings", Name: "last_letter_number", SQLType: "INTEGER", Default: "0"},
		{Table: "school_settings", Name: "letter_number_format", SQLType: "TEXT", Default: "'421/{nomor}/SDN1-KNG/{bulan}/{tahun}'"},
		{Table: "school_settings", Name: "savings_treasurer_id", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_vision", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_mission", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_indicators", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_history_timeline", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_history_achievements", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_curriculum", SQLType: "TEXT"},
		{Table: "school_settings", Name: "school_extracurriculars", SQLType: "TEXT"},

		// students
		{Table: "students", Name: "nik", SQLType: "TEXT"},
		{Table: "students", Name: "religion", SQLType: "TEXT"},
		{Table: "students", Name: "father_name", SQLType: "TEXT"},
		{Table: "students", Name: "father_nik", SQLType: "TEXT"},
		{Table: "students", Name: "mother_name", SQLType: "TEXT"},
		{Table: "students", Name: "mother_nik", SQLType: "TEXT"},
		{Table: "students", Name: "guardian_name", SQLType: "TEXT"},
		{Table: "students", Name: "guardian_nik", SQLType: "TEXT"},
		{Table: "students", Name: "guardian_job", SQLType: "TEXT"},
		{Table: "students", Name: "class_id", SQLType: "TEXT"},
		{Table: "students", Name: "status", SQLType: "TEXT", Default: "'active'"},
		{Table: "students", Name: "meta_data", SQLType: "TEXT"},

		// faqs
		{Table: "faqs", Name: "order_rank", SQLType: "INTEGER", Default: "0"},
		{Table: "faqs", Name: "category", SQLType: "TEXT"},

		// employee_details
		{Table: "employee_details", Name: "category", SQLType: "TEXT"},
		{Table: "employee_details", Name: "degree", SQLType: "TEXT"},
		{Table: "employee_details", Name: "quote", SQLType: "TEXT"},

		// spmb
		{Table: "spmb_periods", Name: "year", SQLType: "TEXT", Default: "'2026'"},
		{Table: "spmb_periods", Name: "academic_year", SQLType: "TEXT", Default: "'2026/2027'"},
		{Table: "spmb_periods", Name: "committee_name", SQLType: "TEXT"},
		{Table: "spmb_periods", Name: "status", SQLType: "TEXT", Default: "'draft'"},
		{Table: "spmb_periods", Name: "quota", SQLType: "INTEGER", Default: "100"},
		{Table: "spmb_periods", Name: "updated_at", SQLType: "INTEGER"},
		{Table: "spmb_registrants", Name: "nisn", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "kk_number", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "birth_certificate_no", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "birth_place", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "birth_date", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "gender", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "religion", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "special_needs", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "living_arrangement", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "transport_mode", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "child_order", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "has_kps_pkh", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "has_kip", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "previous_school", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "hobby", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "ambition", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "height", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "weight", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "head_circumference", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "sibling_count", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "travel_time", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "address_street", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "address_rt", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "address_rw", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "address_village", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "postal_code", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "home_address", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "home_lat", SQLType: "REAL", Default: "0"},
		{Table: "spmb_registrants", Name: "home_lng", SQLType: "REAL", Default: "0"},
		{Table: "spmb_registrants", Name: "distance_km", SQLType: "REAL", Default: "0"},
		{Table: "spmb_registrants", Name: "is_in_zone", SQLType: "INTEGER", Default: "0"},
		{Table: "spmb_registrants", Name: "parent_phone", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "parent_email", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_name", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_nik", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_birth_year", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_education", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_job", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "father_income", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_name", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_nik", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_birth_year", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_education", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_job", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "mother_income", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_name", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_nik", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_birth_year", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_education", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_job", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "guardian_income", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "status", SQLType: "TEXT", Default: "'pending'"},
		{Table: "spmb_registrants", Name: "period_id", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "notes", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "documents", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "verified_by", SQLType: "TEXT"},
		{Table: "spmb_registrants", Name: "verified_at", SQLType: "INTEGER"},
		{Table: "spmb_registrants", Name: "created_at", SQLType: "INTEGER"},
		{Table: "spmb_registrants", Name: "updated_at", SQLType: "INTEGER"},
	}

	for _, col := range fixes {
		var count int
		row := db.QueryRow("SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?", col.Table, col.Name)
		row.Scan(&count)

		if count == 0 {
			query := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", col.Table, col.Name, col.SQLType)
			if col.Default != "" {
				query += fmt.Sprintf(" DEFAULT %s", col.Default)
			}
			_, err := db.Exec(query)
			if err != nil {
				fmt.Printf("SKIP: %s.%s (already exists or error: %v)\n", col.Table, col.Name, err)
			} else {
				fmt.Printf("ADDED: %s.%s %s\n", col.Table, col.Name, col.SQLType)
			}
		} else {
			fmt.Printf("OK: %s.%s\n", col.Table, col.Name)
		}
	}

	// Ensure default row exists in school_settings
	db.Exec(`INSERT OR IGNORE INTO school_settings (id, school_name, current_academic_year, spmb_is_open, max_distance_km, letter_number_format)
		VALUES ('default', 'UPTD SDN 1 Kenanga', '2026/2027', 1, 3.0, '421/{nomor}/SDN1-KNG/{bulan}/{tahun}')`)

	fmt.Println("\nAll database fixes applied!")
}
