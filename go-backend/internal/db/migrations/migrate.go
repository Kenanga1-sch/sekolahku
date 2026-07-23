package migrations

import (
	"database/sql"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"
)

//go:embed *.sql
var migrationFiles embed.FS

func RunMigrations(db *sql.DB) error {
	// 1. Create migration tracking table
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)`)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// 2. Read embedded migration files
	entries, err := migrationFiles.ReadDir(".")
	if err != nil {
		return fmt.Errorf("failed to read embedded migrations: %w", err)
	}

	var upFiles []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".up.sql") {
			upFiles = append(upFiles, e.Name())
		}
	}
	sort.Strings(upFiles)

	// 3. Apply migrations
	for _, fName := range upFiles {
		var version int
		_, err := fmt.Sscanf(fName, "%d_", &version)
		if err != nil {
			log.Printf("Warning: skipping invalid migration filename: %s", fName)
			continue
		}

		// Check if already applied
		var exists int
		err = db.QueryRow("SELECT COUNT(*) FROM _migrations WHERE version = ?", version).Scan(&exists)
		if err != nil {
			return err
		}

		if exists > 0 {
			continue
		}

		log.Printf("Applying migration: %s", fName)
		content, err := migrationFiles.ReadFile(fName)
		if err != nil {
			return err
		}

		// Execute SQL (custom parser to handle triggers properly)
		var statements []string
		var currentStmt string
		inTrigger := false

		for _, line := range strings.Split(string(content), "\n") {
			trimmedLine := strings.TrimSpace(line)
			if trimmedLine == "" || strings.HasPrefix(trimmedLine, "--") {
				continue
			}

			upperLine := strings.ToUpper(trimmedLine)
			if strings.HasPrefix(upperLine, "CREATE TRIGGER") {
				inTrigger = true
			}

			currentStmt += line + "\n"

			if inTrigger {
				if upperLine == "END;" {
					inTrigger = false
					statements = append(statements, currentStmt)
					currentStmt = ""
				}
			} else {
				if strings.HasSuffix(trimmedLine, ";") {
					statements = append(statements, currentStmt)
					currentStmt = ""
				}
			}
		}
		if strings.TrimSpace(currentStmt) != "" {
			statements = append(statements, currentStmt)
		}

		for _, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			_, err = db.Exec(stmt)
			if err != nil {
				if strings.Contains(err.Error(), "duplicate column name") {
					log.Printf("Ignoring duplicate column error in %s: %v", fName, err)
					continue
				}
				return fmt.Errorf("failed migration %s: %w", fName, err)
			}
		}

		// Record success
		_, err = db.Exec("INSERT INTO _migrations (version) VALUES (?)", version)
		if err != nil {
			return err
		}
		log.Printf("Migration %s applied successfully", fName)
	}

	return nil
}
