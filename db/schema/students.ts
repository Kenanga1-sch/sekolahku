import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ==========================================
// Students (Peserta Didik) Master Table
// ==========================================

export const studentGenderEnum = ["L", "P"] as const;

export const students = sqliteTable(
  "students",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    nik: text("nik").unique(), // Nomor Induk Kependudukan
    nisn: text("nisn").unique(), // Nomor Induk Siswa Nasional
    nis: text("nis").unique(), // Nomor Induk Sekolah
    fullName: text("full_name").notNull(),
    gender: text("gender", { enum: studentGenderEnum }),
    birthPlace: text("birth_place"),
    birthDate: text("birth_date"), // YYYY-MM-DD format
    religion: text("religion"),
    address: text("address"),
    
    // Parent / Guardian Details
    parentName: text("parent_name"), // Legacy field to prevent data loss on push
    fatherName: text("father_name"),
    fatherNik: text("father_nik"),
    motherName: text("mother_name"),
    motherNik: text("mother_nik"),
    guardianName: text("guardian_name"),
    guardianNik: text("guardian_nik"),
    guardianJob: text("guardian_job"),
    parentPhone: text("parent_phone"), // Keep generic parent phone for notifications

    // Academic & Status
    className: text("class_name"), // Legacy field, keeping for fallback? Or replace with classId? Keeping for now.
    classId: text("class_id").references(() => studentClasses.id), // Direct relation to official class
    status: text("status", { enum: ["active", "graduated", "transferred", "dropped", "deceased"] }).default("active").notNull(),
    
    photo: text("photo"),
    qrCode: text("qr_code").unique().notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(), // Deprecated in favor of status? keeping for compatibility.
    
    metaData: text("meta_data", { mode: "json" }), // Flexible JSON for health, hobbies, etc.

    enrolledAt: integer("enrolled_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    nisnIdx: index("idx_student_nisn").on(table.nisn),
    nisIdx: index("idx_student_nis").on(table.nis),
    qrCodeIdx: index("idx_student_qr_code").on(table.qrCode),
    classIdIdx: index("idx_student_class_id").on(table.classId),
    statusIdx: index("idx_student_status").on(table.status),
  })
);

// ==========================================
// Student Class (Kelas) Table
// ==========================================

export const studentClasses = sqliteTable("student_classes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(), // e.g., "1A", "2B", "6C"
  grade: integer("grade").notNull(), // 1-6 for SD
  academicYear: text("academic_year").notNull(), // e.g., "2025/2026"
  teacherName: text("teacher_name"), // Wali Kelas
  capacity: integer("capacity").default(28).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
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

export const studentsRelations = relations(students, () => ({}));

export const studentClassesRelations = relations(studentClasses, () => ({}));

// ==========================================
// Types
// ==========================================

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type StudentClass = typeof studentClasses.$inferSelect;
export type NewStudentClass = typeof studentClasses.$inferInsert;
export type StudentGender = (typeof studentGenderEnum)[number];

// ==========================================
// Constants
// ==========================================

export const STUDENT_GENDER_OPTIONS: { value: StudentGender; label: string }[] = [
  { value: "L", label: "Laki-laki" },
  { value: "P", label: "Perempuan" },
];

export const GRADE_OPTIONS = [
  { value: 1, label: "Kelas 1" },
  { value: 2, label: "Kelas 2" },
  { value: 3, label: "Kelas 3" },
  { value: 4, label: "Kelas 4" },
  { value: 5, label: "Kelas 5" },
  { value: 6, label: "Kelas 6" },
];
