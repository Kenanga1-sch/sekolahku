
import { copyFile, mkdir, readdir, unlink, stat } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { join, dirname } from "path";
import { existsSync } from "fs";

const execAsync = promisify(exec);

const DB_PATH = "./data/sekolahku.db";
const DB_BACKUP_DIR = "./backups/db";
const FILES_PATH = "./public/uploads";
const FILES_BACKUP_DIR = "./backups/files";

const MAX_RETENTION_DAYS = 7;

async function ensureDir(dir: string) {
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
}

async function backupDatabase() {
    await ensureDir(DB_BACKUP_DIR);
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = join(DB_BACKUP_DIR, `sekolahku-${dateStr}.db`);
    
    console.log(`[Backup] Backing up Database to ${dest}...`);
    await copyFile(DB_PATH, dest);
    console.log("[Backup] Database Backup Success");
}

async function backupFiles() {
    await ensureDir(FILES_BACKUP_DIR);
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const zipName = `uploads-${dateStr}.tar.gz`;
    const dest = join(FILES_BACKUP_DIR, zipName);

    console.log(`[Backup] Zipping Files to ${dest}...`);
    
    // Check if uploads dir exists
    if (!existsSync(FILES_PATH)) {
        console.log("[Backup] No uploads directory found, skipping file backup.");
        return;
    }

    // Use system tar (Available on Windows 10+ and Linux)
    // Command: tar -czf <dest> -C <source_parent> <source_folder>
    try {
        await execAsync(`tar -czf "${dest}" -C "./public" "uploads"`);
        console.log("[Backup] File Backup Success");
    } catch (error) {
        console.error("[Backup] Failed to zip files. Ensure 'tar' is available.", error);
    }
}

async function cleanOldBackups(dir: string) {
    console.log(`[Retention] Checking ${dir}...`);
    try {
        const files = await readdir(dir);
        const now = Date.now();
        const maxAge = MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = join(dir, file);
            const stats = await stat(filePath);
            
            if (now - stats.mtimeMs > maxAge) {
                console.log(`[Retention] Deleting old backup: ${file}`);
                await unlink(filePath);
            }
        }
    } catch (error) {
        console.error("[Retention] Error cleaning up:", error);
    }
}

async function run() {
    console.log("=== Starting Backup Process ===");
    try {
        await backupDatabase();
        await backupFiles();
        
        await cleanOldBackups(DB_BACKUP_DIR);
        await cleanOldBackups(FILES_BACKUP_DIR);
        
        console.log("=== Backup Process Completed Successfully ===");
    } catch (error) {
        console.error("=== Backup Failed ===", error);
        process.exit(1);
    }
}

run();
