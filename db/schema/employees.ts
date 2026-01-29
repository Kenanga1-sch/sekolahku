
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

// ==========================================
// Employee Details (Detail GTK)
// ==========================================
// This table extends the base `users` table for school employees (Teachers/Staff)

export const employeeDetails = sqliteTable("employee_details", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").references(() => users.id).notNull(), // Link to Login Account
  
  // Identifiers
  nip: text("nip"), // PNS Identity
  nuptk: text("nuptk"), // Teacher Identity
  nik: text("nik"), // National Identity
  
  // Employment
  employmentStatus: text("employment_status"), // PNS, P3K, GTY, GTT, Honorer
  jobType: text("job_type"), // Guru Kelas, Guru Mapel, Staff TU, Penjaga
  joinDate: text("join_date"), // YYYY-MM-DD
  
  // Roles
  isHomeroom: integer("is_homeroom", { mode: "boolean" }).default(false), // Wali Kelas?
  
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => ({
  userIdIdx: index("idx_employee_user_id").on(table.userId),
}));

export type EmployeeDetail = typeof employeeDetails.$inferSelect;
export type NewEmployeeDetail = typeof employeeDetails.$inferInsert;

import { relations } from "drizzle-orm";

export const employeeDetailsRelations = relations(employeeDetails, ({ one }) => ({
  user: one(users, {
    fields: [employeeDetails.userId],
    references: [users.id],
  }),
}));
