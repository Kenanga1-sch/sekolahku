import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

// ==========================================
// Staff Profiles Table
// ==========================================

export const staffCategoryEnum = ["kepsek", "guru", "staff", "support"] as const;

export const staffProfiles = sqliteTable(
  "staff_profiles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    degree: text("degree"), // Gelar (e.g., S.Pd, M.Kom)
    position: text("position").notNull(),
    category: text("category", { enum: staffCategoryEnum }).notNull(),
    photoUrl: text("photo_url"),
    nip: text("nip"), // Optional NIP/NUPTK
    quote: text("quote"), // Motto or short message
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    categoryIdx: index("idx_staff_category").on(table.category),
    isActiveIdx: index("idx_staff_active").on(table.isActive),
    orderIdx: index("idx_staff_order").on(table.displayOrder),
  })
);

// ==========================================
// Types
// ==========================================

export type StaffProfile = typeof staffProfiles.$inferSelect;
export type NewStaffProfile = typeof staffProfiles.$inferInsert;
export type StaffCategory = (typeof staffCategoryEnum)[number];
