import { NextResponse } from "next/server";
import { statSync, existsSync } from "fs";
import { join } from "path";
import os from "os";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbPath = join(process.cwd(), "data", "sekolahku.db");
    
    // Database Stats
    let dbSize = 0;
    let dbStatus = "Unknown";
    
    if (existsSync(dbPath)) {
      const stats = statSync(dbPath);
      dbSize = stats.size;
      dbStatus = "Online";
    } else {
      dbStatus = "Offline";
    }

    // Server Stats
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
    };
    
    const uptime = os.uptime();
    const cpuLoad = os.loadavg();

    // Check Backup Status
    const backupDir = join(process.cwd(), "backups");
    let lastBackup = null;
    let backupCount = 0;
    
    if (existsSync(backupDir)) {
      const { readdirSync } = require("fs");
      const files = readdirSync(backupDir).filter((f: string) => f.endsWith(".gz"));
      backupCount = files.length;
      if (files.length > 0) {
          // Sort to find latest
          files.sort().reverse();
          const latestFile = files[0];
          const stats = statSync(join(backupDir, latestFile));
          lastBackup = stats.mtime;
      }
    }

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        size_bytes: dbSize,
        formatted_size: (dbSize / 1024 / 1024).toFixed(2) + " MB",
      },
      system: {
        uptime_seconds: uptime,
        memory_usage_mb: (memoryUsage.rss / 1024 / 1024).toFixed(2),
        total_ram_gb: (systemMemory.total / 1024 / 1024 / 1024).toFixed(2),
        free_ram_gb: (systemMemory.free / 1024 / 1024 / 1024).toFixed(2),
        cpu_load: cpuLoad,
      },
      backup: {
        count: backupCount,
        last_backup: lastBackup,
      }
    });

  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Internal Error" }, 
      { status: 500 }
    );
  }
}
