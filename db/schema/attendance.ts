import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { students } from "./students";

// ==========================================
// Attendance Sessions (Sesi Absensi)
// ==========================================

export const attendanceSessionStatusEnum = ["open", "closed"] as const;

export const attendanceSessions = sqliteTable(
  "attendance_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    date: text("date").notNull(), // YYYY-MM-DD format
    classId: text("class_id"),
    className: text("class_name").notNull(),
    teacherId: text("teacher_id"),
    teacherName: text("teacher_name"),
    status: text("status", { enum: attendanceSessionStatusEnum })
      .default("open")
      .notNull(),
    openedAt: integer("opened_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    closedAt: integer("closed_at", { mode: "timestamp" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    dateIdx: index("idx_attendance_session_date").on(table.date),
    classNameIdx: index("idx_attendance_session_class").on(table.className),
    statusIdx: index("idx_attendance_session_status").on(table.status),
  })
);

// ==========================================
// Attendance Records (Record Absensi)
// ==========================================

export const attendanceStatusEnum = ["hadir", "sakit", "izin", "alpha"] as const;
export const recordMethodEnum = ["qr_scan", "manual"] as const;

export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: text("status", { enum: attendanceStatusEnum })
      .default("hadir")
      .notNull(),
    checkInTime: integer("check_in_time", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    recordedBy: text("recorded_by"), // Teacher/admin who recorded
    recordMethod: text("record_method", { enum: recordMethodEnum })
      .default("manual")
      .notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    sessionIdx: index("idx_attendance_record_session").on(table.sessionId),
    studentIdx: index("idx_attendance_record_student").on(table.studentId),
    statusIdx: index("idx_attendance_record_status").on(table.status),
    uniqueSessionStudent: index("idx_attendance_session_student").on(
      table.sessionId,
      table.studentId
    ),
  })
);

// ==========================================
// Attendance Settings
// ==========================================

export const attendanceSettings = sqliteTable("attendance_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ==========================================
// Relations
// ==========================================

export const attendanceSessionsRelations = relations(
  attendanceSessions,
  ({ many }) => ({
    records: many(attendanceRecords),
  })
);

export const attendanceRecordsRelations = relations(
  attendanceRecords,
  ({ one }) => ({
    session: one(attendanceSessions, {
      fields: [attendanceRecords.sessionId],
      references: [attendanceSessions.id],
    }),
    student: one(students, {
      fields: [attendanceRecords.studentId],
      references: [students.id],
    }),
  })
);

// ==========================================
// Types
// ==========================================

export type AttendanceSession = typeof attendanceSessions.$inferSelect;
export type NewAttendanceSession = typeof attendanceSessions.$inferInsert;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;
export type AttendanceSetting = typeof attendanceSettings.$inferSelect;
export type AttendanceStatus = (typeof attendanceStatusEnum)[number];
export type RecordMethod = (typeof recordMethodEnum)[number];
export type SessionStatus = (typeof attendanceSessionStatusEnum)[number];

// ==========================================
// Constants
// ==========================================

export const ATTENDANCE_STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  color: string;
}[] = [
  { value: "hadir", label: "Hadir", color: "bg-green-100 text-green-700" },
  { value: "sakit", label: "Sakit", color: "bg-yellow-100 text-yellow-700" },
  { value: "izin", label: "Izin", color: "bg-blue-100 text-blue-700" },
  { value: "alpha", label: "Alpha", color: "bg-red-100 text-red-700" },
];
