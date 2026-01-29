import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { studentClasses } from "./students";

// ==========================================
// Mutasi Masuk Requests
// ==========================================

export const mutasiStatusEnum = [
  "pending",
  "verified",
  "principal_approved",
  "rejected",
] as const;

export const mutasiDeliveryStatusEnum = ["unsent", "sent"] as const;

export const mutasiRequests = sqliteTable(
  "mutasi_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    registrationNumber: text("registration_number").unique().notNull(), // Generated auto, e.g. MUT-TIMESTAMP
    
    // Student Data
    studentName: text("student_name").notNull(),
    nisn: text("nisn").notNull(),
    gender: text("gender", { enum: ["L", "P"] }).notNull(),
    originSchool: text("origin_school").notNull(),
    originSchoolAddress: text("origin_school_address"), // New field
    targetGrade: integer("target_grade").notNull(), // 1-6
    
    // Assignment (Admin Only)
    targetClassId: text("target_class_id").references(() => studentClasses.id),
    
    // Parent Data
    parentName: text("parent_name").notNull(),
    whatsappNumber: text("whatsapp_number").notNull(), // Format: 628xxx
    
    // Status
    statusApproval: text("status_approval", { enum: mutasiStatusEnum })
      .default("pending")
      .notNull(),
    statusDelivery: text("status_delivery", { enum: mutasiDeliveryStatusEnum })
      .default("unsent")
      .notNull(),
      
    // Meta
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIdx: index("idx_mutasi_status").on(table.statusApproval),
    createdIdx: index("idx_mutasi_created").on(table.createdAt),
  })
);

// ==========================================
// Relations
// ==========================================

export const mutasiRequestsRelations = relations(mutasiRequests, ({ one }) => ({
  targetClass: one(studentClasses, {
    fields: [mutasiRequests.targetClassId],
    references: [studentClasses.id],
  }),
}));

// ==========================================
// Types
// ==========================================

export type MutasiRequest = typeof mutasiRequests.$inferSelect;
export type NewMutasiRequest = typeof mutasiRequests.$inferInsert;
export type MutasiStatus = (typeof mutasiStatusEnum)[number];
