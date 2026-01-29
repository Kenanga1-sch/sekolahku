
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
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

const dbPath = "./data/sekolahku.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

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
};

export const dbScript = drizzle(sqlite, { schema });
