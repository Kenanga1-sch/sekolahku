import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { students } from "./students";

// ==========================================
// Library Items (Books) Table
// ==========================================

export const itemCategoryEnum = [
  "FICTION",
  "NON_FICTION",
  "REFERENCE",
  "TEXTBOOK",
  "MAGAZINE",
  "OTHER",
] as const;

export const itemStatusEnum = ["AVAILABLE", "BORROWED"] as const;

export const libraryItems = sqliteTable(
  "library_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    title: text("title").notNull(),
    author: text("author"),
    isbn: text("isbn"),
    publisher: text("publisher"),
    year: integer("year"),
    category: text("category", { enum: itemCategoryEnum })
      .default("OTHER")
      .notNull(),
    location: text("location"),
    description: text("description"),
    qrCode: text("qr_code").unique().notNull(),
    status: text("status", { enum: itemStatusEnum })
      .default("AVAILABLE")
      .notNull(),
    cover: text("cover"), // file path
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIdx: index("idx_item_status").on(table.status),
    qrCodeIdx: index("idx_item_qr_code").on(table.qrCode),
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
      .references(() => libraryItems.id),
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
      .notNull()
      .references(() => libraryMembers.id),
    date: text("date").notNull(), // YYYY-MM-DD format
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
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

export const libraryItemsRelations = relations(libraryItems, ({ many }) => ({
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
  item: one(libraryItems, {
    fields: [libraryLoans.itemId],
    references: [libraryItems.id],
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

export type LibraryItem = typeof libraryItems.$inferSelect;
export type NewLibraryItem = typeof libraryItems.$inferInsert;
export type LibraryMember = typeof libraryMembers.$inferSelect;
export type NewLibraryMember = typeof libraryMembers.$inferInsert;
export type LibraryLoan = typeof libraryLoans.$inferSelect;
export type NewLibraryLoan = typeof libraryLoans.$inferInsert;
export type LibraryVisit = typeof libraryVisits.$inferSelect;
export type NewLibraryVisit = typeof libraryVisits.$inferInsert;
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
];

export const DEFAULT_LOAN_DAYS = 7;
export const FINE_PER_DAY = 1000; // Rp 1.000 per hari
