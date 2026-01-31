import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import * as usersSchema from "../db/schema/users";
import * as spmbSchema from "../db/schema/spmb";
import * as librarySchema from "../db/schema/library";
import * as tabunganSchema from "../db/schema/tabungan";
import * as miscSchema from "../db/schema/misc";
import * as inventorySchema from "../db/schema/inventory";
import * as studentsSchema from "../db/schema/students";
import * as alumniSchema from "../db/schema/alumni";
import * as attendanceSchema from "../db/schema/attendance";
import * as gallerySchema from "../db/schema/gallery";
import * as mutasiSchema from "../db/schema/mutasi";
import * as mutasiKeluarSchema from "../db/schema/mutasi-keluar";
import * as staffSchema from "../db/schema/staff";
import * as notificationSchema from "../db/schema/notifications";
import * as arsipSchema from "../db/schema/arsip";
import * as lettersSchema from "../db/schema/letters";
import * as curriculumSchema from "../db/schema/curriculum";
import * as academicSchema from "../db/schema/academic";
import * as employeesSchema from "../db/schema/employees";
import * as studentHistorySchema from "../db/schema/student-history";
import * as studentDocumentsSchema from "../db/schema/student-documents";
import * as loansSchema from "../db/schema/loans";
import * as financeSchema from "../db/schema/finance";

export const schema = {
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

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = OFF"); // Disable for tests to simplify setup
  const db = drizzle(sqlite, { schema });

  try {
    migrate(db, { migrationsFolder: path.join(__dirname, "../db/migrations") });
  } catch (e) {
    // If migrations fail, we might need to use sql statements or ignore if it's just about tables already existing
    // But for :memory:, they shouldn't exist.
    console.error("Migration failed", e);
  }

  return { db, sqlite };
}
