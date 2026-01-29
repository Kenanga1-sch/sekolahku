import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { students } from "./students";

// --- Master Data ---

// 1. Capaian Pembelajaran (CP) - Centralized Data
export const curriculumCp = sqliteTable("curriculum_cp", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fase: text("fase", { enum: ["A", "B", "C", "D", "E", "F"] }).notNull(),
  subject: text("subject").notNull(), // Mata Pelajaran
  element: text("element").notNull(), // Elemen CP (e.g. Bilangan, Geometri)
  content: text("content").notNull(), // Text CP
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// --- Planning (Modul A) ---

// 2. Tujuan Pembelajaran (TP) - Teacher's breakdown of CP
export const teacherTp = sqliteTable("teacher_tp", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teacherId: text("teacher_id").references(() => users.id).notNull(),
  cpId: text("cp_id").references(() => curriculumCp.id), // Optional link to master CP
  code: text("code").notNull(), // e.g. "TP.1.1"
  content: text("content").notNull(), // Text TP
  semester: integer("semester").notNull(), // 1 or 2
  subject: text("subject").notNull(), // Mapel name if not linked to CP directly
  gradeLevel: integer("grade_level").notNull(), // Kelas (1-6)
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// 3. Modul Ajar (Teaching Modules / RPP Plus)
export const teachingModules = sqliteTable("teaching_modules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tpId: text("tp_id").references(() => teacherTp.id).notNull(),
  topic: text("topic").notNull(), // Lingkup Materi
  
  // Structured Activities (Stored as JSON string in SQLite)
  activities: text("activities", { mode: "json" }).$type<{
    opening: string;
    core: string;
    closing: string;
  }>(),

  // Duration allocation (in minutes)
  allocationMap: text("allocation_map", { mode: "json" }).$type<{
    opening: number;
    core: number;
    closing: number;
  }>(),
  
  assessmentPlan: text("assessment_plan"), // Rencana Asesmen
  mediaLinks: text("media_links", { mode: "json" }).$type<string[]>(), // Array of URLs
  
  status: text("status").default("DRAFT"), // DRAFT, PUBLISHED
  feedback: text("supervisor_feedback"), // Catatan Kepala Sekolah
  
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// --- Executive (Modul B) ---

// 3.5. Jurnal Kelas (Daily Journal)
export const classJournals = sqliteTable("class_journals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teacherId: text("teacher_id").references(() => users.id).notNull(),
  
  // Schedule context
  date: integer("date", { mode: "timestamp" }).default(sql`(unixepoch())`), // Tanggal ajar
  className: text("class_name").notNull(), // e.g. "1A"
  subject: text("subject").notNull(), // Mapel
  
  // Curriculum context
  tpIds: text("tp_ids", { mode: "json" }).$type<string[]>(), // Array of TP IDs covered
  
  // Content
  notes: text("notes"), // Catatan KBM
  studentAttendance: text("student_attendance", { mode: "json" }).$type<string[]>(), // Array of Absent Student IDs or Objects
  
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// --- Assessment (Modul C) ---

// 4. Nilai Akademik
export const studentGrades = sqliteTable("student_grades", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: text("student_id").references(() => students.id).notNull(),
  tpId: text("tp_id").references(() => teacherTp.id).notNull(),
  
  score: integer("score"), // 0-100
  type: text("type", { enum: ["FORMATIVE", "SUMMATIVE", "SAS"] }).notNull(), 
  
  notes: text("notes"), // Catatan khusus
  
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// --- Profil Pelajar Pancasila (Modul D) ---

// 5. Projek P5
export const p5Projects = sqliteTable("p5_projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  theme: text("theme").notNull(), // e.g. Gaya Hidup Berkelanjutan
  title: text("title").notNull(), // Judul Projek
  description: text("description"),
  
  // Dimensions targets 
  dimensions: text("dimensions", { mode: "json" }).$type<string[]>(), 
  
  gradeLevel: integer("grade_level").notNull(), // Kelas target
  semester: integer("semester").notNull(),
  
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// 6. Nilai P5
export const p5Grades = sqliteTable("p5_grades", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => p5Projects.id).notNull(),
  studentId: text("student_id").references(() => students.id).notNull(),
  
  dimension: text("dimension").notNull(), // e.g. "Beriman & Bertakwa"
  predicate: text("predicate", { enum: ["BB", "MB", "BSH", "SB"] }).notNull(), // BB, MB, BSH, SB
  
  notes: text("notes"),
  
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});
