import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

// ==========================================
// SPMB Periods Table
// ==========================================

export const spmbPeriods = sqliteTable("spmb_periods", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  academicYear: text("academic_year").notNull(),
  name: text("name").notNull(),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }).notNull(),
  quota: integer("quota").default(0),
  isActive: integer("is_active", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ==========================================
// SPMB Registrants Table
// ==========================================

export const registrantStatusEnum = [
  "draft",
  "pending",
  "verified",
  "accepted",
  "rejected",
] as const;

export const genderEnum = ["L", "P"] as const;

export const spmbRegistrants = sqliteTable(
  "spmb_registrants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    registrationNumber: text("registration_number").unique().notNull(),
    // Student Details
    fullName: text("full_name").notNull(),
    studentName: text("student_name"), // Legacy/Duplicate
    nisn: text("nisn"), // Optional
    studentNik: text("student_nik").unique().notNull(),
    kkNumber: text("kk_number").notNull(),
    birthCertificateNo: text("birth_certificate_no"),
    birthDate: integer("birth_date", { mode: "timestamp" }).notNull(),
    birthPlace: text("birth_place").notNull(),
    gender: text("gender", { enum: genderEnum }).notNull(),
    religion: text("religion").notNull(),
    specialNeeds: text("special_needs"), // "Tidak" or specific need
    livingArrangement: text("living_arrangement"), // "Bersama Orang Tua", etc.
    transportMode: text("transport_mode"),
    childOrder: integer("child_order"),
    hasKpsPkh: integer("has_kps_pkh", { mode: "boolean" }).default(false),
    hasKip: integer("has_kip", { mode: "boolean" }).default(false),
    previousSchool: text("previous_school"),
    
    // Detailed Address
    addressStreet: text("address_street").notNull(),
    addressRt: text("address_rt").notNull(),
    addressRw: text("address_rw").notNull(),
    addressVillage: text("address_village").notNull(),
    postalCode: text("postal_code"),
    // Computed/Legacy address field for backward compat or summary
    address: text("address").notNull(),

    // Contact (Parent/Guardian Representative)
    parentName: text("parent_name").notNull().default("-"), // Legacy
    parentPhone: text("parent_phone").notNull(),
    parentEmail: text("parent_email"), // Optional

    // Father Details
    fatherName: text("father_name"),
    fatherNik: text("father_nik"),
    fatherBirthYear: text("father_birth_year"),
    fatherEducation: text("father_education"),
    fatherJob: text("father_job"),
    fatherIncome: text("father_income"),

    // Mother Details
    motherName: text("mother_name"),
    motherNik: text("mother_nik"),
    motherBirthYear: text("mother_birth_year"),
    motherEducation: text("mother_education"),
    motherJob: text("mother_job"),
    motherIncome: text("mother_income"),

    // Guardian Details
    guardianName: text("guardian_name"),
    guardianNik: text("guardian_nik"),
    guardianBirthYear: text("guardian_birth_year"),
    guardianEducation: text("guardian_education"),
    guardianJob: text("guardian_job"),
    guardianIncome: text("guardian_income"),

    homeLat: real("home_lat"),
    homeLng: real("home_lng"),
    distanceToSchool: real("distance_to_school"),
    isInZone: integer("is_in_zone", { mode: "boolean" }).default(false),
    status: text("status", { enum: registrantStatusEnum }).default("draft"),
    notes: text("notes"),
    priorityRank: integer("priority_rank"),
    priorityGroup: integer("priority_group"),
    periodId: text("period_id").references(() => spmbPeriods.id),
    documents: text("documents"), // JSON array of file paths
    verifiedBy: text("verified_by").references(() => users.id),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIdx: index("idx_registrant_status").on(table.status),
    createdIdx: index("idx_registrant_created").on(table.createdAt),
    periodIdx: index("idx_registrant_period").on(table.periodId),
  })
);

// ==========================================
// Relations
// ==========================================

export const spmbPeriodsRelations = relations(spmbPeriods, ({ many }) => ({
  registrants: many(spmbRegistrants),
}));

export const spmbRegistrantsRelations = relations(
  spmbRegistrants,
  ({ one }) => ({
    period: one(spmbPeriods, {
      fields: [spmbRegistrants.periodId],
      references: [spmbPeriods.id],
    }),
    verifier: one(users, {
      fields: [spmbRegistrants.verifiedBy],
      references: [users.id],
    }),
  })
);

// ==========================================
// Types
// ==========================================

export type SPMBPeriod = typeof spmbPeriods.$inferSelect;
export type NewSPMBPeriod = typeof spmbPeriods.$inferInsert;
export type SPMBRegistrant = typeof spmbRegistrants.$inferSelect;
export type NewSPMBRegistrant = typeof spmbRegistrants.$inferInsert;
export type RegistrantStatus = (typeof registrantStatusEnum)[number];
export type Gender = (typeof genderEnum)[number];
