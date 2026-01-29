
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { employeeDetails } from "./employees";
import { relations } from "drizzle-orm";

// ==========================================
// Loans (Pinjaman & Kasbon)
// ==========================================

export const loans = sqliteTable("loans", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  employeeDetailId: text("employee_detail_id").references(() => employeeDetails.id), // Nullable for School/External debts
  
  // Borrower Info
  borrowerType: text("borrower_type", { enum: ["EMPLOYEE", "SCHOOL", "EXTERNAL"] }).notNull().default("EMPLOYEE"),
  borrowerName: text("borrower_name"), // For SCHOOL/EXTERNAL
  description: text("description"),

  // Loan Type & Terms
  type: text("type", { enum: ["KASBON", "CICILAN"] }).notNull(), // KASBON (Short term), CICILAN (Long term)
  amountRequested: real("amount_requested").notNull(),
  amountApproved: real("amount_approved"), // Nullable until approved
  tenorMonths: integer("tenor_months").notNull(), // 1 for Kasbon
  adminFee: real("admin_fee").default(0),
  
  // Status
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED", "LUNAS", "MACET"] }).default("PENDING"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  
  // Timestamps
  disbursedAt: integer("disbursed_at", { mode: "timestamp" }), // When money was given
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => ({
  employeeIdx: index("idx_loans_employee").on(table.employeeDetailId),
  statusIdx: index("idx_loans_status").on(table.status),
}));

export const loanInstallments = sqliteTable("loan_installments", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  loanId: text("loan_id").references(() => loans.id, { onDelete: "cascade" }).notNull(),
  
  // Installment Details
  installmentNumber: integer("installment_number").notNull(), // 1, 2, 3...
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
  
  // Amounts
  principalAmount: real("principal_amount").notNull(), // Pokok
  interestAmount: real("interest_amount").default(0), // Bunga/Jasa
  totalAmount: real("total_amount").notNull(), // Pokok + Bunga
  
  // Payment Status
  status: text("status", { enum: ["UNPAID", "PAID", "LATE"] }).default("UNPAID"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  paymentMethod: text("payment_method", { enum: ["CASH", "TRANSFER", "SALARY_DEDUCTION"] }),
  notes: text("notes"), // e.g. "Potongan Gaji Bulan X"

  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => ({
  loanIdx: index("idx_installments_loan").on(table.loanId),
  dueDateIdx: index("idx_installments_due_date").on(table.dueDate),
  statusIdx: index("idx_installments_status").on(table.status),
}));


// ==========================================
// Relations
// ==========================================

export const loansRelations = relations(loans, ({ one, many }) => ({
  employee: one(employeeDetails, {
    fields: [loans.employeeDetailId],
    references: [employeeDetails.id],
  }),
  installments: many(loanInstallments),
}));

export const loanInstallmentsRelations = relations(loanInstallments, ({ one }) => ({
  loan: one(loans, {
    fields: [loanInstallments.loanId],
    references: [loans.id],
  }),
}));

export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;

export type LoanInstallment = typeof loanInstallments.$inferSelect;
export type NewLoanInstallment = typeof loanInstallments.$inferInsert;
