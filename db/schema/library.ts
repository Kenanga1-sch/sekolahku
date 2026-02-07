import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { students } from "./students";

// ==========================================
// Library Catalog (Bibliographic Data)
// ==========================================

export const itemCategoryEnum = [
  "FICTION",
  "NON_FICTION",
  "REFERENCE",
  "TEXTBOOK",
  "MAGAZINE",
  "OTHER",
  "000_COMPUTER",
  "100_PHILOSOPHY",
  "200_RELIGION",
  "300_SOCIAL",
  "400_LANGUAGE",
  "500_SCIENCE",
  "600_TECHNOLOGY",
  "700_ART",
  "800_LITERATURE",
  "900_HISTORY",
  "UNSORTED",
] as const;

export const libraryCatalog = sqliteTable(
  "library_catalog",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    isbn: text("isbn").unique(),
    title: text("title").notNull(),
    author: text("author"),
    publisher: text("publisher"),
    year: integer("year"),
    category: text("category", { enum: itemCategoryEnum })
      .default("OTHER")
      .notNull(),
    description: text("description"),
    cover: text("cover"), // file path
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    isbnIdx: index("idx_catalog_isbn").on(table.isbn),
    titleIdx: index("idx_catalog_title").on(table.title),
  })
);

// ==========================================
// Library Assets (Physical Items)
// ==========================================

export const itemStatusEnum = ["AVAILABLE", "BORROWED", "DAMAGED", "LOST"] as const;

export const libraryAssets = sqliteTable(
  "library_assets",
  {
    id: text("id").primaryKey(), // QR Code is the PK
    catalogId: text("catalog_id")
      .notNull()
      .references(() => libraryCatalog.id, { onDelete: "cascade" }),
    status: text("status", { enum: itemStatusEnum })
      .default("AVAILABLE")
      .notNull(),
    location: text("location"),
    condition: text("condition").default("Baik"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    catalogIdx: index("idx_asset_catalog").on(table.catalogId),
    statusIdx: index("idx_asset_status").on(table.status),
  })
);

// ==========================================
// Library Members Table
// ==========================================

export const libraryMembers = sqliteTable(
  "library_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id").references(() => users.id),
    studentId: text("student_id").references(() => students.id), // Link to master students
    name: text("name").notNull(),
    className: text("class_name"),
    qrCode: text("qr_code").unique().notNull(),
    maxBorrowLimit: integer("max_borrow_limit").default(3).notNull(),
    photo: text("photo"), // file path
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    qrCodeIdx: index("idx_member_qr_code").on(table.qrCode),
    studentIdIdx: index("idx_member_student_id").on(table.studentId),
  })
);

// ==========================================
// Library Loans Table
// ==========================================

export const libraryLoans = sqliteTable(
  "library_loans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    memberId: text("member_id")
      .notNull()
      .references(() => libraryMembers.id),
    itemId: text("item_id")
      .notNull()
      .references(() => libraryAssets.id), // Now references libraryAssets(id) which is QR Code
    borrowDate: integer("borrow_date", { mode: "timestamp" }).notNull(),
    dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
    returnDate: integer("return_date", { mode: "timestamp" }),
    isReturned: integer("is_returned", { mode: "boolean" })
      .default(false)
      .notNull(),
    fineAmount: integer("fine_amount").default(0).notNull(),
    finePaid: integer("fine_paid", { mode: "boolean" }).default(false).notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    memberIdx: index("idx_loan_member").on(table.memberId),
    itemIdx: index("idx_loan_item").on(table.itemId),
    isReturnedIdx: index("idx_loan_is_returned").on(table.isReturned),
  })
);

// ==========================================
// Library Visits Table
// ==========================================

export const libraryVisits = sqliteTable(
  "library_visits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    memberId: text("member_id")
      .references(() => libraryMembers.id), // Made nullable (removed .notNull())
    guestName: text("guest_name"), // Added guestName
    institution: text("institution"), // Added institution (optional but good for guests)
    purpose: text("purpose"), // Added purpose
    date: text("date").notNull(), // YYYY-MM-DD format
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(
      () => new Date()
    ),
  },
  (table) => ({
    memberDateIdx: index("idx_visit_member_date").on(table.memberId, table.date),
  })
);

// ==========================================
// Relations
// ==========================================

export const libraryCatalogRelations = relations(libraryCatalog, ({ many }) => ({
  assets: many(libraryAssets),
}));

export const libraryAssetsRelations = relations(libraryAssets, ({ one, many }) => ({
  catalog: one(libraryCatalog, {
    fields: [libraryAssets.catalogId],
    references: [libraryCatalog.id],
  }),
  loans: many(libraryLoans),
}));

export const libraryMembersRelations = relations(
  libraryMembers,
  ({ one, many }) => ({
    user: one(users, {
      fields: [libraryMembers.userId],
      references: [users.id],
    }),
    loans: many(libraryLoans),
    visits: many(libraryVisits),
  })
);

export const libraryLoansRelations = relations(libraryLoans, ({ one }) => ({
  member: one(libraryMembers, {
    fields: [libraryLoans.memberId],
    references: [libraryMembers.id],
  }),
  item: one(libraryAssets, {
    fields: [libraryLoans.itemId],
    references: [libraryAssets.id],
  }),
}));

export const libraryVisitsRelations = relations(libraryVisits, ({ one }) => ({
  member: one(libraryMembers, {
    fields: [libraryVisits.memberId],
    references: [libraryMembers.id],
  }),
}));

// ==========================================
// Types
// ==========================================

// ==========================================
// Library QR Batches (Sequence Tracking)
// ==========================================

export const libraryQrBatches = sqliteTable(
  "library_qr_batches",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    prefix: text("prefix").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    startSequence: integer("start_sequence").notNull(),
    endSequence: integer("end_sequence").notNull(),
    batchSize: integer("batch_size").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    createdBy: text("created_by"), // user id
  },
  (table) => ({
    prefixDateIdx: index("idx_qr_batch_prefix_date").on(table.prefix, table.date),
  })
);

// Types
export type LibraryCatalog = typeof libraryCatalog.$inferSelect;
export type NewLibraryCatalog = typeof libraryCatalog.$inferInsert;
export type LibraryAsset = typeof libraryAssets.$inferSelect;
export type NewLibraryAsset = typeof libraryAssets.$inferInsert;
export type LibraryMember = typeof libraryMembers.$inferSelect;
export type NewLibraryMember = typeof libraryMembers.$inferInsert;
export type LibraryLoan = typeof libraryLoans.$inferSelect;
export type NewLibraryLoan = typeof libraryLoans.$inferInsert;
export type LibraryVisit = typeof libraryVisits.$inferSelect;
export type NewLibraryVisit = typeof libraryVisits.$inferInsert;
export type LibraryQrBatch = typeof libraryQrBatches.$inferSelect;
export type NewLibraryQrBatch = typeof libraryQrBatches.$inferInsert;
export type ItemCategory = (typeof itemCategoryEnum)[number];
export type ItemStatus = (typeof itemStatusEnum)[number];

// Constants
export const ITEM_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "FICTION", label: "Fiksi" },
  { value: "NON_FICTION", label: "Non-Fiksi" },
  { value: "REFERENCE", label: "Referensi" },
  { value: "TEXTBOOK", label: "Buku Pelajaran" },
  { value: "MAGAZINE", label: "Majalah" },
  { value: "OTHER", label: "Lainnya" },
  { value: "000_COMPUTER", label: "000 - Komputer & Informasi" },
  { value: "100_PHILOSOPHY", label: "100 - Filsafat & Psikologi" },
  { value: "200_RELIGION", label: "200 - Agama" },
  { value: "300_SOCIAL", label: "300 - Ilmu Sosial" },
  { value: "400_LANGUAGE", label: "400 - Bahasa" },
  { value: "500_SCIENCE", label: "500 - Sains & Matematika" },
  { value: "600_TECHNOLOGY", label: "600 - Teknologi & Kesehatan" },
  { value: "700_ART", label: "700 - Seni & Olahraga" },
  { value: "800_LITERATURE", label: "800 - Sastra" },
  { value: "900_HISTORY", label: "900 - Sejarah & Geografi" },
];

export const DEFAULT_LOAN_DAYS = 7;
export const FINE_PER_DAY = 1000; // Rp 1.000 per hari
