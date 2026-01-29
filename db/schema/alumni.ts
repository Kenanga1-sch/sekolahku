import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { students } from "./students";

// ==========================================
// Alumni Table
// ==========================================

export const alumniGenderEnum = ["L", "P"] as const;

export const alumni = sqliteTable(
  "alumni",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    studentId: text("student_id").references(() => students.id), // Original student record
    nisn: text("nisn").unique(),
    nis: text("nis"),
    fullName: text("full_name").notNull(),
    gender: text("gender", { enum: alumniGenderEnum }),
    birthPlace: text("birth_place"),
    birthDate: text("birth_date"), // YYYY-MM-DD
    graduationYear: text("graduation_year").notNull(), // e.g., "2024/2025"
    graduationDate: integer("graduation_date", { mode: "timestamp" }),
    finalClass: text("final_class"), // e.g., "6A"
    photo: text("photo"), // file path
    parentName: text("parent_name"),
    parentPhone: text("parent_phone"),
    currentAddress: text("current_address"),
    currentPhone: text("current_phone"),
    currentEmail: text("current_email"),
    nextSchool: text("next_school"), // SMP lanjutan
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    nisnIdx: index("idx_alumni_nisn").on(table.nisn),
    graduationYearIdx: index("idx_alumni_graduation_year").on(table.graduationYear),
    finalClassIdx: index("idx_alumni_final_class").on(table.finalClass),
    fullNameIdx: index("idx_alumni_full_name").on(table.fullName),
  })
);

// ==========================================
// Alumni Document Types Table
// ==========================================

export const alumniDocumentTypes = sqliteTable("alumni_document_types", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  code: text("code").unique().notNull(), // e.g., "IJAZAH", "SKHUN"
  description: text("description"),
  isRequired: integer("is_required", { mode: "boolean" }).default(false),
  maxFileSizeMb: integer("max_file_size_mb").default(5),
  allowedTypes: text("allowed_types").default('["application/pdf","image/jpeg","image/png"]'), // JSON array
  sortOrder: integer("sort_order").default(0),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ==========================================
// Alumni Documents Table
// ==========================================

export const documentVerificationStatusEnum = [
  "pending",
  "verified",
  "rejected",
] as const;

export const alumniDocuments = sqliteTable(
  "alumni_documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    alumniId: text("alumni_id")
      .notNull()
      .references(() => alumni.id, { onDelete: "cascade" }),
    documentTypeId: text("document_type_id")
      .notNull()
      .references(() => alumniDocumentTypes.id),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: integer("file_size"), // bytes
    mimeType: text("mime_type"),
    documentNumber: text("document_number"), // e.g., nomor ijazah
    issueDate: text("issue_date"), // YYYY-MM-DD
    verificationStatus: text("verification_status", {
      enum: documentVerificationStatusEnum,
    }).default("pending"),
    verifiedBy: text("verified_by").references(() => users.id),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    verificationNotes: text("verification_notes"),
    notes: text("notes"),
    uploadedBy: text("uploaded_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    alumniIdIdx: index("idx_alumni_documents_alumni_id").on(table.alumniId),
    documentTypeIdx: index("idx_alumni_documents_type_id").on(table.documentTypeId),
    verificationStatusIdx: index("idx_alumni_documents_verification").on(
      table.verificationStatus
    ),
  })
);

// ==========================================
// Document Pickups Table
// ==========================================

export const documentPickups = sqliteTable(
  "document_pickups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    alumniId: text("alumni_id")
      .notNull()
      .references(() => alumni.id, { onDelete: "cascade" }),
    documentTypeId: text("document_type_id").references(
      () => alumniDocumentTypes.id
    ), // nullable for bulk pickup
    recipientName: text("recipient_name").notNull(),
    recipientRelation: text("recipient_relation"), // e.g., "Orang Tua", "Wali", "Alumni"
    recipientIdNumber: text("recipient_id_number"), // KTP
    recipientPhone: text("recipient_phone"),
    pickupDate: integer("pickup_date", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    signaturePath: text("signature_path"), // Digital signature file
    photoProofPath: text("photo_proof_path"), // Photo evidence
    notes: text("notes"),
    handedOverBy: text("handed_over_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => ({
    alumniPickupIdx: index("idx_document_pickups_alumni_id").on(table.alumniId),
    pickupDateIdx: index("idx_document_pickups_date").on(table.pickupDate),
  })
);

// ==========================================
// Relations
// ==========================================

export const alumniRelations = relations(alumni, ({ one, many }) => ({
  student: one(students, {
    fields: [alumni.studentId],
    references: [students.id],
  }),
  documents: many(alumniDocuments),
  pickups: many(documentPickups),
}));

export const alumniDocumentTypesRelations = relations(
  alumniDocumentTypes,
  ({ many }) => ({
    documents: many(alumniDocuments),
    pickups: many(documentPickups),
  })
);

export const alumniDocumentsRelations = relations(
  alumniDocuments,
  ({ one }) => ({
    alumni: one(alumni, {
      fields: [alumniDocuments.alumniId],
      references: [alumni.id],
    }),
    documentType: one(alumniDocumentTypes, {
      fields: [alumniDocuments.documentTypeId],
      references: [alumniDocumentTypes.id],
    }),
    verifier: one(users, {
      fields: [alumniDocuments.verifiedBy],
      references: [users.id],
    }),
    uploader: one(users, {
      fields: [alumniDocuments.uploadedBy],
      references: [users.id],
    }),
  })
);

export const documentPickupsRelations = relations(
  documentPickups,
  ({ one }) => ({
    alumni: one(alumni, {
      fields: [documentPickups.alumniId],
      references: [alumni.id],
    }),
    documentType: one(alumniDocumentTypes, {
      fields: [documentPickups.documentTypeId],
      references: [alumniDocumentTypes.id],
    }),
    handedOverByUser: one(users, {
      fields: [documentPickups.handedOverBy],
      references: [users.id],
    }),
  })
);

// ==========================================
// Types
// ==========================================

export type Alumni = typeof alumni.$inferSelect;
export type NewAlumni = typeof alumni.$inferInsert;
export type AlumniDocumentType = typeof alumniDocumentTypes.$inferSelect;
export type NewAlumniDocumentType = typeof alumniDocumentTypes.$inferInsert;
export type AlumniDocument = typeof alumniDocuments.$inferSelect;
export type NewAlumniDocument = typeof alumniDocuments.$inferInsert;
export type DocumentPickup = typeof documentPickups.$inferSelect;
export type NewDocumentPickup = typeof documentPickups.$inferInsert;
export type AlumniGender = (typeof alumniGenderEnum)[number];
export type DocumentVerificationStatus =
  (typeof documentVerificationStatusEnum)[number];

// ==========================================
// Constants
// ==========================================

export const ALUMNI_GENDER_OPTIONS: { value: AlumniGender; label: string }[] = [
  { value: "L", label: "Laki-laki" },
  { value: "P", label: "Perempuan" },
];

export const DOCUMENT_VERIFICATION_STATUS_OPTIONS: {
  value: DocumentVerificationStatus;
  label: string;
  color: string;
}[] = [
  { value: "pending", label: "Menunggu Verifikasi", color: "yellow" },
  { value: "verified", label: "Terverifikasi", color: "green" },
  { value: "rejected", label: "Ditolak", color: "red" },
];

export const RECIPIENT_RELATION_OPTIONS = [
  { value: "alumni", label: "Alumni (Sendiri)" },
  { value: "orang_tua", label: "Orang Tua" },
  { value: "wali", label: "Wali" },
  { value: "keluarga", label: "Keluarga" },
  { value: "lainnya", label: "Lainnya" },
];

// Default document types to seed
export const DEFAULT_DOCUMENT_TYPES = [
  { code: "IJAZAH", name: "Ijazah", description: "Surat Tanda Tamat Belajar", isRequired: true, sortOrder: 1 },
  { code: "SKHUN", name: "SKHUN", description: "Surat Keterangan Hasil Ujian Nasional", isRequired: false, sortOrder: 2 },
  { code: "TRANSKRIP", name: "Transkrip Nilai", description: "Daftar nilai selama sekolah", isRequired: false, sortOrder: 3 },
  { code: "RAPOR_1", name: "Rapor Kelas 1", description: "Buku rapor kelas 1", isRequired: false, sortOrder: 4 },
  { code: "RAPOR_2", name: "Rapor Kelas 2", description: "Buku rapor kelas 2", isRequired: false, sortOrder: 5 },
  { code: "RAPOR_3", name: "Rapor Kelas 3", description: "Buku rapor kelas 3", isRequired: false, sortOrder: 6 },
  { code: "RAPOR_4", name: "Rapor Kelas 4", description: "Buku rapor kelas 4", isRequired: false, sortOrder: 7 },
  { code: "RAPOR_5", name: "Rapor Kelas 5", description: "Buku rapor kelas 5", isRequired: false, sortOrder: 8 },
  { code: "RAPOR_6", name: "Rapor Kelas 6", description: "Buku rapor kelas 6", isRequired: false, sortOrder: 9 },
  { code: "AKTE_LAHIR", name: "Akte Kelahiran", description: "Salinan akte kelahiran", isRequired: false, sortOrder: 10 },
  { code: "KK", name: "Kartu Keluarga", description: "Salinan kartu keluarga", isRequired: false, sortOrder: 11 },
  { code: "FOTO", name: "Pas Foto", description: "Pas foto formal", isRequired: false, sortOrder: 12 },
  { code: "SURAT_PINDAH", name: "Surat Pindah", description: "Surat keterangan pindah sekolah", isRequired: false, sortOrder: 13 },
  { code: "PIAGAM", name: "Piagam Penghargaan", description: "Piagam prestasi dan penghargaan", isRequired: false, sortOrder: 14 },
  { code: "SERTIFIKAT", name: "Sertifikat", description: "Sertifikat kegiatan dan pelatihan", isRequired: false, sortOrder: 15 },
  { code: "LAINNYA", name: "Dokumen Lainnya", description: "Dokumen pendukung lainnya", isRequired: false, sortOrder: 99 },
];
