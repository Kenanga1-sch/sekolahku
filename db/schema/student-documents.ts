
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { students } from "./students";

// ==========================================
// Student Documents Table
// ==========================================
export const studentDocumentTypeEnum = [
    "kk", // Kartu Keluarga
    "akta", // Akta Kelahiran
    "kip", // Kartu Indonesia Pintar
    "ijazah_tk", // Ijazah TK/PAUD
    "foto", // Pas Foto
    "lainnya" // Other
] as const;

export const studentDocuments = sqliteTable(
  "student_documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    
    title: text("title").notNull(), // User friendly name e.g. "KK 2024"
    type: text("type", { enum: studentDocumentTypeEnum }).default("lainnya").notNull(),
    fileUrl: text("file_url").notNull(), // Path to file
    fileSize: integer("file_size"), // in bytes
    mimeType: text("mime_type"), 
    
    isVerified: integer("is_verified", { mode: "boolean" }).default(false),
    
    uploadedAt: integer("uploaded_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    uploadedBy: text("uploaded_by"), // Admin ID
  },
  (table) => ({
    studentIdx: index("idx_doc_student").on(table.studentId),
  })
);

export const studentDocumentsRelations = relations(studentDocuments, ({ one }) => ({
  student: one(students, {
    fields: [studentDocuments.studentId],
    references: [students.id],
  }),
}));

export type StudentDocument = typeof studentDocuments.$inferSelect;
export type NewStudentDocument = typeof studentDocuments.$inferInsert;
