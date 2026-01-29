import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const galleries = sqliteTable("galleries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("general").notNull(),
  imageUrl: text("image_url").notNull(),
  publicId: text("public_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export type Gallery = typeof galleries.$inferSelect;
export type NewGallery = typeof galleries.$inferInsert;
