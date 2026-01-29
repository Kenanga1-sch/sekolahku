import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { students } from "./students";

// ==========================================
// Mutasi Keluar Requests Table
// ==========================================

export const mutasiOutReasonEnum = ["domisili", "tugas_orangtua", "lainnya"] as const;
export const mutasiOutStatusEnum = ["draft", "processed", "completed", "rejected"] as const;

export const mutasiOutRequests = sqliteTable(
  "mutasi_out_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    destinationSchool: text("destination_school").notNull(),
    reason: text("reason", { enum: mutasiOutReasonEnum }).notNull(),
    reasonDetail: text("reason_detail"), // Optional details for "lainnya"
    status: text("status", { enum: mutasiOutStatusEnum }).default("draft").notNull(),
    
    // Tracking fields
    downloadedAt: integer("downloaded_at", { mode: "timestamp" }),
    processedAt: integer("processed_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studentIdIdx: index("idx_mutasi_out_student_id").on(table.studentId),
    statusIdx: index("idx_mutasi_out_status").on(table.status),
  })
);

// ==========================================
// Relations
// ==========================================

export const mutasiOutRequestsRelations = relations(mutasiOutRequests, ({ one }) => ({
  student: one(students, {
    fields: [mutasiOutRequests.studentId],
    references: [students.id],
  }),
}));

// ==========================================
// Types
// ==========================================

export type MutasiOutRequest = typeof mutasiOutRequests.$inferSelect;
export type NewMutasiOutRequest = typeof mutasiOutRequests.$inferInsert;
