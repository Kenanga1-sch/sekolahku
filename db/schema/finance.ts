import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

// 1. Akun Kas (Wadah Uang) - Cash, Bank, E-Wallet
export const financeAccounts = sqliteTable("finance_accounts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(), // 'Kas Tunai TU', 'Bank BJB BOS'
  accountNumber: text("account_number"), // Optional for Cash
  description: text("description"),
  isSystem: integer("is_system", { mode: "boolean" }).default(false), // If true, cannot be deleted
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// 2. Kategori Anggaran (Chart of Accounts)
export const financeCategories = sqliteTable("finance_categories", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(), // 'SPP', 'Gaji Guru', 'ATK'
  type: text("type", { enum: ["INCOME", "EXPENSE"] }).notNull(),
  description: text("description"),
  isSystem: integer("is_system", { mode: "boolean" }).default(false),
});

// 3. Transaksi (Arus Kas)
export const financeTransactions = sqliteTable("finance_transactions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  date: integer("date", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  type: text("type", { enum: ["INCOME", "EXPENSE", "TRANSFER"] }).notNull(),
  
  // Relasi Akun
  accountIdSource: text("account_id_source").references(() => financeAccounts.id), // Source Fund
  accountIdDest: text("account_id_dest").references(() => financeAccounts.id), // For Transfer Only
  
  categoryId: text("category_id").references(() => financeCategories.id), // Nullable for Transfer? Or strict?
  
  amount: real("amount").notNull(),
  description: text("description"),
  
  proofImage: text("proof_image"), // URL to uploaded image
    
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).default("APPROVED").notNull(), // Default APPROVED for now, unless configured
  
  // Polymorphic Relations (Optional)
  refTable: text("ref_table"), // 'loans', 'student_payments'
  refId: text("ref_id"),
  
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// Relations
export const financeAccountsRelations = relations(financeAccounts, ({ many }) => ({
  transactionsSource: many(financeTransactions, { relationName: "sourceAccount" }),
  transactionsDest: many(financeTransactions, { relationName: "destAccount" }),
}));

export const financeCategoriesRelations = relations(financeCategories, ({ many }) => ({
  transactions: many(financeTransactions),
}));

export const financeTransactionsRelations = relations(financeTransactions, ({ one }) => ({
  accountSource: one(financeAccounts, {
    fields: [financeTransactions.accountIdSource],
    references: [financeAccounts.id],
    relationName: "sourceAccount",
  }),
  accountDest: one(financeAccounts, {
    fields: [financeTransactions.accountIdDest],
    references: [financeAccounts.id],
    relationName: "destAccount"
  }),
  category: one(financeCategories, {
    fields: [financeTransactions.categoryId],
    references: [financeCategories.id],
  }),
  creator: one(users, {
    fields: [financeTransactions.createdBy],
    references: [users.id],
  })
}));
