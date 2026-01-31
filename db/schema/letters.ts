import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

// ==========================================
// Letter Templates Table
// ==========================================

export const letterTemplates = sqliteTable(
  "letter_templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(), // e.g. "Surat Keterangan Aktif", "Undangan Rapat"
    category: text("category").default("GENERAL").notNull(), // GENERAL, STUDENT, STAFF, PARENT
    content: text("content"), // HTML Content with {{variables}} (Nullable for DOCX)
    filePath: text("file_path"), // Path to uploaded .docx
    type: text("type").default("EDITOR").notNull(), // EDITOR, UPLOAD
    paperSize: text("paper_size").default("A4").notNull(), // A4, F4, LEGAL
    orientation: text("orientation").default("portrait").notNull(), // portrait, landscape
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    nameIdx: index("idx_template_name").on(table.name),
    categoryIdx: index("idx_template_category").on(table.category),
  })
);

// ==========================================
// Types
// ==========================================

export type LetterTemplate = typeof letterTemplates.$inferSelect;
export type NewLetterTemplate = typeof letterTemplates.$inferInsert;

export const generatedLetters = sqliteTable("generated_letters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  letterNumber: text("letter_number").notNull(), // The full formatted string
  classificationCode: text("classification_code"), // e.g. "421"
  sequenceNumber: integer("sequence_number").notNull(), // The integer counter
  recipient: text("recipient"), 
  templateId: text("template_id").references(() => letterTemplates.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export type GeneratedLetter = typeof generatedLetters.$inferSelect;
export type NewGeneratedLetter = typeof generatedLetters.$inferInsert;
