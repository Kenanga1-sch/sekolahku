import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { format } from "date-fns";

// Config
const DB_PATH = path.join(process.cwd(), "data", "sekolahku.db");
const BACKUP_ROOT = path.join(process.cwd(), "backups");
const RETENTION_DAYS = 30; // Keep backups for 30 days

async function backup() {
  console.log(`[Backup] Starting backup process...`);
  console.log(`[Backup] Database: ${DB_PATH}`);

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }

  // Generate filename: sekolahku_YYYY-MM-DD_HH-mm-ss.db
  const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
  const backupName = `sekolahku_${timestamp}.db`;
  const backupPath = path.join(BACKUP_ROOT, backupName);

  try {
    // Open database connection just for backup
    const db = new Database(DB_PATH, { readonly: true });
    
    // Perform online backup (hot backup) - safe to do while app is running
    await db.backup(backupPath, {
        progress({ totalPages, remainingPages }) {
            const percent = ((totalPages - remainingPages) / totalPages) * 100;
            process.stdout.write(`\r[Backup] Progress: ${percent.toFixed(1)}%`);
            return 200; // Pause 200ms between chunks to not hog IO
        }
    });

    console.log(`\n[Backup] Success! Saved to: ${backupPath}`);
    db.close();

    // Rotate old backups
    cleanupOldBackups();

  } catch (error) {
    console.error("\n[Backup] Failed:", error);
    process.exit(1);
  }
}

function cleanupOldBackups() {
  console.log("[Backup] Cleaning up old backups...");
  const files = fs.readdirSync(BACKUP_ROOT).filter(f => f.endsWith(".db"));
  const now = Date.now();
  let deleted = 0;

  files.forEach(file => {
    const filePath = path.join(BACKUP_ROOT, file);
    const stats = fs.statSync(filePath);
    const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

    if (ageDays > RETENTION_DAYS) {
      fs.unlinkSync(filePath);
      console.log(`[Backup] Deleted old backup: ${file}`);
      deleted++;
    }
  });

  if (deleted === 0) console.log("[Backup] No old backups to delete.");
}

backup();
