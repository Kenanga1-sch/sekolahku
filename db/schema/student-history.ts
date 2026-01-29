
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { students } from "./students";
import { studentClasses } from "./students";

// ==========================================
// Student Class History Table
// ==========================================
// Records the journey of a student through classes and years.
// Vital for reproducing old report cards and tracking progress.

export const studentClassHistory = sqliteTable(
  "student_class_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: text("class_id")
      .references(() => studentClasses.id), // Can be null if graduated/transferred
    className: text("class_name"), // Snapshot of class name at that time (e.g. "1A")
    academicYear: text("academic_year").notNull(), // e.g. "2024/2025"
    grade: integer("grade"), // Snapshot of grade (1-6)
    
    status: text("status", { 
        enum: ["active", "graduated", "promoted", "retained", "transferred_out"] 
    }).notNull(),
    
    notes: text("notes"), // Optional context, e.g. "Pindah ikut orang tua"
    
    recordDate: integer("record_date", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    promotedBy: text("promoted_by"), // ID of admin/teacher who executed the action
  },
  (table) => ({
    studentIdx: index("idx_history_student").on(table.studentId),
    yearIdx: index("idx_history_year").on(table.academicYear),
  })
);

// ==========================================
// Relations
// ==========================================

export const studentClassHistoryRelations = relations(studentClassHistory, ({ one }) => ({
  student: one(students, {
    fields: [studentClassHistory.studentId],
    references: [students.id],
  }),
  class: one(studentClasses, {
    fields: [studentClassHistory.classId],
    references: [studentClasses.id],
  }),
}));

export type StudentClassHistory = typeof studentClassHistory.$inferSelect;
export type NewStudentClassHistory = typeof studentClassHistory.$inferInsert;
