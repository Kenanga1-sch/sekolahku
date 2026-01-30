// import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// Create database directory if it doesn't exist
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

// Explicit imports to fix inference issues
import * as usersSchema from "./schema/users";
import * as spmbSchema from "./schema/spmb";
import * as librarySchema from "./schema/library";
import * as tabunganSchema from "./schema/tabungan";
import * as miscSchema from "./schema/misc";
import * as inventorySchema from "./schema/inventory";
import * as studentsSchema from "./schema/students";
import * as alumniSchema from "./schema/alumni";
import * as attendanceSchema from "./schema/attendance";
import * as gallerySchema from "./schema/gallery";
import * as mutasiSchema from "./schema/mutasi";
import * as mutasiKeluarSchema from "./schema/mutasi-keluar";
import * as staffSchema from "./schema/staff";
import * as notificationSchema from "./schema/notifications";
import * as arsipSchema from "./schema/arsip";
import * as lettersSchema from "./schema/letters";
import * as curriculumSchema from "./schema/curriculum";
import * as academicSchema from "./schema/academic";
import * as employeesSchema from "./schema/employees";
import * as studentHistorySchema from "./schema/student-history";
import * as studentDocumentsSchema from "./schema/student-documents";
import * as loansSchema from "./schema/loans";
import * as financeSchema from "./schema/finance";

const dbPath = "./data/sekolahku.db";
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Create SQLite connection
const sqlite = new Database(dbPath);

// Optimize for HDD Storage (Reduce disk I/O) & Low RAM (4GB)
sqlite.pragma("journal_mode = WAL"); // Better concurrency
sqlite.pragma("synchronous = NORMAL"); // Faster writes, safe for app crashes (not OS crashes)
sqlite.pragma("temp_store = MEMORY"); // Keep temp tables in RAM
sqlite.pragma("cache_size = -128000"); // 128MB cache limit (increased for slow HDD, still safe for 4GB RAM)
sqlite.pragma("mmap_size = 2147483648"); // 2GB mmap (Better for 4GB system than 30GB address space)
sqlite.pragma("page_size = 4096"); // Standard for most file systems

// Combine all schemas into one object explicitly
const schema = {
  ...usersSchema,
  ...spmbSchema,
  ...librarySchema,
  ...tabunganSchema,
  ...miscSchema,
  ...inventorySchema,
  ...studentsSchema,
  ...alumniSchema,
  ...attendanceSchema,
  ...gallerySchema,
  ...mutasiSchema,
  ...mutasiKeluarSchema,
  ...staffSchema,
  ...notificationSchema,
  ...arsipSchema,
  ...lettersSchema,
  ...curriculumSchema,
  ...academicSchema,
  ...employeesSchema,
  ...studentHistorySchema,
  ...studentDocumentsSchema,
  ...loansSchema,
  ...financeSchema,
};

// Create Drizzle instance with all schemas
export const db = drizzle(sqlite, { schema });

// Export schema for type inference
export * from "./schema/users";
export * from "./schema/spmb";
export * from "./schema/library";
export * from "./schema/tabungan";
export * from "./schema/misc";
export * from "./schema/inventory";
export * from "./schema/students";
export * from "./schema/alumni";
export * from "./schema/attendance";
export * from "./schema/gallery";
export * from "./schema/mutasi";
export * from "./schema/mutasi-keluar";
export * from "./schema/staff";
export * from "./schema/notifications";
export * from "./schema/arsip";
export * from "./schema/letters";
export * from "./schema/curriculum";
export * from "./schema/academic";
export * from "./schema/employees";
export * from "./schema/student-history";
export * from "./schema/student-documents";
export * from "./schema/loans";
export * from "./schema/finance";

