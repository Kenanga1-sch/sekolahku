import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

// ==========================================
// Klasifikasi Surat (Classification Codes)
// ==========================================

export const klasifikasiSurat = sqliteTable(
  "klasifikasi_surat",
  {
    code: text("code").primaryKey(), // e.g. "420"
    name: text("name").notNull(), // e.g. "Pendidikan"
    description: text("description"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  }
);

// ==========================================
// Surat Masuk (Incoming Mail)
// ==========================================

export const suratMasukStatusEnum = ["Menunggu Disposisi", "Terdisposisi", "Selesai", "Arsip"] as const;

export const suratMasuk = sqliteTable(
  "surat_masuk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    agendaNumber: text("agenda_number").unique().notNull(), // AGD/2026/001
    originalNumber: text("original_number").notNull(), // Nomor dari pengirim
    sender: text("sender").notNull(), // Pengirim
    subject: text("subject").notNull(), // Perihal
    dateOfLetter: text("date_of_letter").notNull(), // Tanggal di surat (YYYY-MM-DD)
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull(), // Tanggal diterima
    classificationCode: text("classification_code").references(() => klasifikasiSurat.code),
    filePath: text("file_path").notNull(), // Path to PDF
    status: text("status", { enum: suratMasukStatusEnum })
      .default("Menunggu Disposisi")
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
    agendaIdx: index("idx_sm_agenda").on(table.agendaNumber),
    dateIdx: index("idx_sm_date").on(table.receivedAt),
    senderIdx: index("idx_sm_sender").on(table.sender),
  })
);

// ==========================================
// Disposisi (Disposition)
// ==========================================

export const disposisi = sqliteTable(
  "disposisi",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    suratMasukId: text("surat_masuk_id")
      .notNull()
      .references(() => suratMasuk.id),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id), // Usually Principal
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id), // Target Staff/Teacher
    instruction: text("instruction").notNull(),
    deadline: text("deadline"), // YYYY-MM-DD
    isCompleted: integer("is_completed", { mode: "boolean" }).default(false).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    completedNote: text("completed_note"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => ({
    suratIdx: index("idx_disp_surat").on(table.suratMasukId),
    toUserIdx: index("idx_disp_to_user").on(table.toUserId),
  })
);

// ==========================================
// Surat Keluar (Outgoing Mail)
// ==========================================

export const suratKeluarStatusEnum = ["Draft", "Pending", "Selesai", "Arsip"] as const;

export const suratKeluar = sqliteTable(
  "surat_keluar",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    mailNumber: text("mail_number").unique().notNull(), // 421.2/050-SD/I/2026
    recipient: text("recipient").notNull(), // Tujuan Kepada
    subject: text("subject").notNull(), // Perihal
    dateOfLetter: text("date_of_letter").notNull(), // Tanggal Surat (YYYY-MM-DD)
    classificationCode: text("classification_code").references(() => klasifikasiSurat.code),
    filePath: text("file_path"), // Can be null initially (Draft)
    finalFilePath: text("final_file_path"), // Scan of signed doc
    status: text("status", { enum: suratKeluarStatusEnum })
      .default("Draft")
      .notNull(),
    createdBy: text("created_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    numberIdx: index("idx_sk_number").on(table.mailNumber),
    dateIdx: index("idx_sk_date").on(table.dateOfLetter),
    recipientIdx: index("idx_sk_recipient").on(table.recipient),
  })
);

// ==========================================
// Relations
// ==========================================

export const suratMasukRelations = relations(suratMasuk, ({ one, many }) => ({
  classification: one(klasifikasiSurat, {
    fields: [suratMasuk.classificationCode],
    references: [klasifikasiSurat.code],
  }),
  disposisi: many(disposisi),
}));

export const disposisiRelations = relations(disposisi, ({ one }) => ({
  suratMasuk: one(suratMasuk, {
    fields: [disposisi.suratMasukId],
    references: [suratMasuk.id],
  }),
  fromUser: one(users, {
    fields: [disposisi.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [disposisi.toUserId],
    references: [users.id],
  }),
}));

export const suratKeluarRelations = relations(suratKeluar, ({ one }) => ({
  classification: one(klasifikasiSurat, {
    fields: [suratKeluar.classificationCode],
    references: [klasifikasiSurat.code],
  }),
  creator: one(users, {
    fields: [suratKeluar.createdBy],
    references: [users.id],
  }),
}));

// ==========================================
// Types
// ==========================================

export type SuratMasuk = typeof suratMasuk.$inferSelect;
export type NewSuratMasuk = typeof suratMasuk.$inferInsert;

export type SuratKeluar = typeof suratKeluar.$inferSelect;
export type NewSuratKeluar = typeof suratKeluar.$inferInsert;

export type Disposisi = typeof disposisi.$inferSelect;
export type NewDisposisi = typeof disposisi.$inferInsert;

export type KlasifikasiSurat = typeof klasifikasiSurat.$inferSelect;
