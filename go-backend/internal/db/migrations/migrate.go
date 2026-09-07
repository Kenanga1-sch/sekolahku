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

// postMigrations menghubungkan versi migrasi dengan tahap lanjutan di Go.
var postMigrations = map[int]func(*sql.DB) error{
	// 000034 membuat tabel inventaris "_new" ber-FK; datanya harus disalin dan
	// tabelnya diganti nama sebelum migrasi 000035 ALTER inventory_items.
	34: MigrateInventoryData,
}

// stripTxControl menghapus statement kontrol transaksi (BEGIN/COMMIT/ROLLBACK)
// yang tertulis di dalam file migrasi. Transaksi dikelola oleh Go di
// RunMigrations, jadi statement ini tidak boleh ikut dieksekusi.
func stripTxControl(statements []string) []string {
	out := make([]string, 0, len(statements))
	for _, s := range statements {
		t := strings.ToUpper(strings.TrimSpace(s))
		t = strings.TrimSuffix(t, ";")
		t = strings.TrimSpace(t)
		if t == "BEGIN" || t == "BEGIN TRANSACTION" || t == "COMMIT" || t == "ROLLBACK" || t == "END" {
			continue
		}
		out = append(out, s)
	}
	return out
}

// finishTx menutup transaksi: commit bila sukses, rollback bila gagal.
// Selalu menutup, sehingga transaksi tidak pernah menggantung.
func finishTx(tx *sql.Tx, failed bool) error {
	if failed {
		if err := tx.Rollback(); err != nil {
			// Rollback bisa gagal bila transaksi sudah selesai; itu tidak fatal.
			log.Printf("Note: rollback migration: %v", err)
		}
		return nil
	}
	return tx.Commit()
}

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

		migrationFailed := false

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

		// Buang BEGIN/COMMIT yang tertulis di dalam file: migrasi dijalankan
		// dalam satu transaksi Go di bawah, jadi BEGIN/COMMIT di SQL justru
		// membuka transaksi bersarang yang tidak pernah ditutup bila migrasi
		// gagal di tengah (menggantung dan menggulung balik pekerjaan migrasi
		// sesudahnya).
		statements = stripTxControl(statements)

		// Jalankan seluruh statement dalam satu transaksi supaya gagal = atomik.
		tx, err := db.Begin()
		if err != nil {
			return err
		}

		for _, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			_, err = tx.Exec(stmt)
			if err != nil {
				if strings.Contains(err.Error(), "duplicate column name") {
					log.Printf("Ignoring duplicate column error in %s: %v", fName, err)
					continue
				}
				// Sebagian migrasi lama bergantung pada tabel yang baru dibuat
				// createCoreTables, yang berjalan SETELAH RunMigrations. Di basis
				// data benar-benar baru, migrasi seperti 000007 karena itu gagal
				// ("no such table"), dan sebelumnya satu kegagalan menghentikan
				// SELURUH rantai — akibatnya migrasi berikutnya (termasuk
				// 000034/000036 yang membuat tabel inventaris) tidak pernah
				// dijalankan dan instalasi baru kehilangan modul inventaris.
				//
				// Karena itu kegagalan dicatat dan dilewati, bukan dihentikan.
				// Migrasi yang gagal TIDAK ditandai sukses, sehingga akan dicoba
				// lagi pada start berikutnya (setelah tabel inti ada).
				//
				// Rollback dulu supaya transaksi ini tidak menggantung dan tidak
				// menggulung balik pekerjaan migrasi-migrasi sesudahnya.
				log.Printf("WARNING: skipping migration %s (will retry next start): %v", fName, err)
				migrationFailed = true
				break
			}
		}

		if err := finishTx(tx, migrationFailed); err != nil {
			return err
		}

		// Migrasi yang gagal tidak ditandai sukses, supaya dicoba ulang nanti.
		if migrationFailed {
			continue
		}

		// Record success
		_, err = db.Exec("INSERT INTO _migrations (version) VALUES (?)", version)
		if err != nil {
			return err
		}
		log.Printf("Migration %s applied successfully", fName)

		// Sebagian migrasi butuh tahap lanjutan yang tidak bisa ditulis sebagai
		// SQL statis (SQLite harus me-resolve nama tabel saat parse). Tahap ini
		// dijalankan SEGERA setelah migrasinya, bukan di akhir, supaya migrasi
		// berikutnya boleh ALTER tabel yang baru saja di-rename.
		if finalize, ok := postMigrations[version]; ok {
			if err := finalize(db); err != nil {
				return fmt.Errorf("post-migration for %s failed: %w", fName, err)
			}
		}
	}

	return nil
}
