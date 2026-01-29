
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

// ==========================================
// Academic Years (Tahun Ajaran)
// ==========================================

export const academicYears = sqliteTable("academic_years", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(), // e.g. "2025/2026"
  semester: text("semester", { enum: ["ganjil", "genap"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(false).notNull(),
  startDate: text("start_date"), // YYYY-MM-DD
  endDate: text("end_date"), // YYYY-MM-DD
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

// ==========================================
// Subjects (Mata Pelajaran)
// ==========================================

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  code: text("code").unique(), // e.g. "MAT-01"
  name: text("name").notNull(), // e.g. "Matematika"
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export type AcademicYear = typeof academicYears.$inferSelect;
export type NewAcademicYear = typeof academicYears.$inferInsert;
export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
