import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

// ==========================================
// Announcements Table
// ==========================================

export const announcementCategoryEnum = [
  "berita",
  "pengumuman",
  "spmb",
  "prestasi",
  "kegiatan",
] as const;

export const announcements = sqliteTable("announcements", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  content: text("content"), // HTML content
  excerpt: text("excerpt"), // Short summary
  category: text("category", { enum: announcementCategoryEnum }),
  thumbnail: text("thumbnail"), // file path
  isPublished: integer("is_published", { mode: "boolean" }).default(false),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  authorId: text("author_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ==========================================
// Audit Logs Table
// ==========================================

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  details: text("details"), // JSON string
  userId: text("user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// ==========================================
// School Settings Table (Singleton)
// ==========================================

export const schoolSettings = sqliteTable("school_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  schoolName: text("school_name").notNull(),
  schoolNpsn: text("school_npsn"),
  schoolAddress: text("school_address"),
  schoolPhone: text("school_phone"),
  schoolEmail: text("school_email"),
  schoolWebsite: text("school_website"),
  schoolLogo: text("school_logo"), // file path
  schoolLat: real("school_lat"),
  schoolLng: real("school_lng"),
  maxDistanceKm: real("max_distance_km"),
  spmbIsOpen: integer("spmb_is_open", { mode: "boolean" }).default(false),
  currentAcademicYear: text("current_academic_year").default("2025/2026"),
  principalName: text("principal_name"),
  principalNip: text("principal_nip"),
  isMaintenance: integer("is_maintenance", { mode: "boolean" }).default(false),
  lastLetterNumber: integer("last_letter_number").default(0),
  letterNumberFormat: text("letter_number_format").default("421/{nomor}/SDN1-KNG/{bulan}/{tahun}"),
  savingsTreasurerId: text("savings_treasurer_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ==========================================
// Contact Messages Table
// ==========================================

export const contactMessages = sqliteTable("contact_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// ==========================================
// Relations
// ==========================================

export const announcementsRelations = relations(announcements, ({ one }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// ==========================================
// Types
// ==========================================

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type SchoolSettings = typeof schoolSettings.$inferSelect;
export type NewSchoolSettings = typeof schoolSettings.$inferInsert;
export type AnnouncementCategory = (typeof announcementCategoryEnum)[number];
