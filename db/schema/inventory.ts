import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

// ==========================================
// Inventory Assets
// ==========================================

export const inventoryAssets = sqliteTable("inventory_assets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  code: text("code"),
  category: text("category").notNull().default("OTHER"),
  price: integer("price").default(0),
  quantity: integer("quantity").default(1),
  roomId: text("room_id"), // Relation to rooms if needed
  conditionGood: integer("condition_good").default(1),
  conditionLightDamaged: integer("condition_light_damaged").default(0),
  conditionHeavyDamaged: integer("condition_heavy_damaged").default(0),
  conditionLost: integer("condition_lost").default(0),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }),
  notes: text("notes"),
  status: text("status").default("ACTIVE"), // ACTIVE, ARCHIVED
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ==========================================
// Inventory Rooms
// ==========================================

export const inventoryRooms = sqliteTable("inventory_rooms", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  location: text("location"),
  picId: text("pic_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// ==========================================
// Inventory Opname (Stock Take)
// ==========================================

export const inventoryOpname = sqliteTable("inventory_opname", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  date: integer("date", { mode: "timestamp" }).notNull(),
  roomId: text("room_id").references(() => inventoryRooms.id),
  auditorId: text("auditor_id").references(() => users.id),
  items: text("items", { mode: "json" }).notNull(), // JSON array of OpnameItem
  status: text("status").notNull().default("PENDING"),
  note: text("note"),
  created: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ==========================================
// Inventory Audit Logs
// ==========================================

export const inventoryAudit = sqliteTable("inventory_audit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  action: text("action").notNull(), // CREATE, UPDATE, DELETE, OPNAME_APPLY
  entity: text("entity").notNull(), // ASSET, ROOM, OPNAME
  entityId: text("entity_id").notNull(),
  changes: text("changes", { mode: "json" }), // JSON string of changes
  userId: text("user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// ==========================================
// Relations
// ==========================================

export const inventoryAuditRelations = relations(inventoryAudit, ({ one }) => ({
  user: one(users, {
    fields: [inventoryAudit.userId],
    references: [users.id],
  }),
}));

export const inventoryAssetsRelations = relations(inventoryAssets, ({ one }) => ({
  room: one(inventoryRooms, {
    fields: [inventoryAssets.roomId],
    references: [inventoryRooms.id],
  }),
}));

export const inventoryOpnameRelations = relations(inventoryOpname, ({ one }) => ({
  room: one(inventoryRooms, {
    fields: [inventoryOpname.roomId],
    references: [inventoryRooms.id],
  }),
  auditor: one(users, {
    fields: [inventoryOpname.auditorId],
    references: [users.id],
  }),
}));

export const inventoryRoomsRelations = relations(inventoryRooms, ({ one }) => ({
  pic: one(users, {
    fields: [inventoryRooms.picId],
    references: [users.id],
  }),
}));

// ==========================================
// Inventory Items (Consumables / ATK)
// ==========================================

export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  code: text("code").unique(),
  category: text("category").notNull().default("LAINNYA"), // ATK, ART, KEBERSIHAN
  unit: text("unit").notNull().default("Pcs"),
  minStock: integer("min_stock").default(5),
  currentStock: integer("current_stock").default(0),
  location: text("location"),
  price: integer("price").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ==========================================
// Inventory Transactions
// ==========================================

export const inventoryTransactions = sqliteTable("inventory_transactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  itemId: text("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // IN, OUT, ADJUSTMENT
  quantity: integer("quantity").notNull(),
  date: integer("date", { mode: "timestamp" }).$defaultFn(() => new Date()),
  description: text("description"),
  recipient: text("recipient"), // Who took the item (for OUT)
  proofImage: text("proof_image"), // Path to uploaded image
  userId: text("user_id").references(() => users.id), // Admin who recorded it
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// ==========================================
// New Relations
// ==========================================

export const inventoryItemsRelations = relations(inventoryItems, ({ many }) => ({
  transactions: many(inventoryTransactions),
}));

export const inventoryTransactionsRelations = relations(
  inventoryTransactions,
  ({ one }) => ({
    item: one(inventoryItems, {
      fields: [inventoryTransactions.itemId],
      references: [inventoryItems.id],
    }),
    user: one(users, {
      fields: [inventoryTransactions.userId],
      references: [users.id],
    }),
  })
);
