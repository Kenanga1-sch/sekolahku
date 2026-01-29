import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { relations } from "drizzle-orm";

export const notificationTypeEnum = [
  "info",
  "warning",
  "success",
  "error",
] as const;

export const notificationCategoryEnum = [
  "system",
  "spmb",
  "library",
  "academic",
  "finance",
  "staff",
  "student",
  "other"
] as const;

export const adminNotifications = sqliteTable("admin_notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" }), // Nullable for global/broadcast notifications if needed, but per plan references user
  type: text("type", { enum: notificationTypeEnum }).default("info").notNull(),
  category: text("category", { enum: notificationCategoryEnum }).default("system").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetUrl: text("target_url"),
  isRead: integer("is_read", { mode: "boolean" }).default(false).notNull(),
  metadata: text("metadata", { mode: "json" }), // Store JSON string or use blob if needed, text mode json is easy in drizzle+sqlite
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date()),
});

export const adminNotificationsRelations = relations(adminNotifications, ({ one }) => ({
  user: one(users, {
    fields: [adminNotifications.userId],
    references: [users.id],
  }),
}));

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type NewAdminNotification = typeof adminNotifications.$inferInsert;
