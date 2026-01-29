"use server";

import { db } from "@/db";
import { financeAccounts, financeCategories, financeTransactions } from "@/db";
import { eq, desc, asc, and, sql, between } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// --- Types ---
export type FinanceAccount = typeof financeAccounts.$inferSelect;
export type FinanceCategory = typeof financeCategories.$inferSelect;
export type FinanceTransaction = typeof financeTransactions.$inferSelect;

export type CreateTransactionData = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  accountIdSource: string;
  accountIdDest?: string; // For Transfer
  categoryId?: string;
  amount: number;
  description?: string;
  proofImage?: string;
  date?: Date;
  status?: "PENDING" | "APPROVED"; // Default APPROVED unless configured for approval flow
};

// --- Accounts ---

// ... imports
import { auth } from "@/auth";

// ... Types

// --- Accounts ---

export async function getAccounts() {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  try {
    const data = await db.query.financeAccounts.findMany({
        orderBy: [desc(financeAccounts.isSystem), desc(financeAccounts.name)],
    });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createAccount(data: { name: string; accountNumber?: string; description?: string; initialBalance?: number }) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  try {
    const { initialBalance, ...accountData } = data;
    
    // 1. Create Account
    const [newAccount] = await db.insert(financeAccounts).values(accountData).returning();

    // 2. If Initial Balance is set, create a transaction
    if (initialBalance && initialBalance > 0) {
        await db.insert(financeTransactions).values({
            type: "INCOME",
            accountIdSource: newAccount.id,
            amount: initialBalance,
            description: "Saldo Awal",
            status: "APPROVED",
            date: new Date(),
            categoryId: null,
            accountIdDest: null,
            createdBy: session.user?.id || null,
        });
    }

    revalidatePath("/keuangan/arus-kas");
    return { success: true, message: "Akun berhasil dibuat" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateAccount(id: string, data: { name: string; accountNumber?: string; description?: string }) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        await db.update(financeAccounts).set(data).where(eq(financeAccounts.id, id));
        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Akun berhasil diperbarui" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteAccount(id: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        // Prevent if system account
        const account = await db.query.financeAccounts.findFirst({
            where: eq(financeAccounts.id, id),
        });
        if (account?.isSystem) return { success: false, error: "Akun sistem tidak dapat dihapus" };

        // Check for transactions
        const hasTx = await db.query.financeTransactions.findFirst({
            where: sql`${financeTransactions.accountIdSource} = ${id} OR ${financeTransactions.accountIdDest} = ${id}`
        });

        if (hasTx) return { success: false, error: "Akun ini memiliki riwayat transaksi, tidak dapat dihapus" };

        await db.delete(financeAccounts).where(eq(financeAccounts.id, id));
        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Akun berhasil dihapus" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Categories ---

export async function getCategories(type?: "INCOME" | "EXPENSE") {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  try {
    const where = type ? eq(financeCategories.type, type) : undefined;
    const data = await db.query.financeCategories.findMany({
        where,
        orderBy: [desc(financeCategories.name)],
    });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCategory(data: { name: string; type: "INCOME" | "EXPENSE"; description?: string }) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  try {
    await db.insert(financeCategories).values(data);
    revalidatePath("/keuangan/arus-kas");
    return { success: true, message: "Kategori berhasil dibuat" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCategory(id: string, data: { name: string; type: "INCOME" | "EXPENSE"; description?: string }) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        await db.update(financeCategories).set(data).where(eq(financeCategories.id, id));
        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Kategori berhasil diperbarui" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteCategory(id: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const category = await db.query.financeCategories.findFirst({ where: eq(financeCategories.id, id) });
        if (category?.isSystem) return { success: false, error: "Kategori sistem tidak dapat dihapus" };

        // Check usage
        const hasTx = await db.query.financeTransactions.findFirst({
            where: eq(financeTransactions.categoryId, id)
        });
        if (hasTx) return { success: false, error: "Kategori ini sudah digunakan dalam transaksi" };

        await db.delete(financeCategories).where(eq(financeCategories.id, id));
        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Kategori berhasil dihapus" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Transactions ---

export async function getTransactions(filters?: { accountId?: string; startDate?: Date; endDate?: Date; limit?: number }) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const conditions = [];
        if (filters?.accountId) {
             conditions.push(sql`${financeTransactions.accountIdSource} = ${filters.accountId} OR ${financeTransactions.accountIdDest} = ${filters.accountId}`);
        }
        // Date filters can be added here
        
        const data = await db.query.financeTransactions.findMany({
            where: conditions.length > 0 ? and(...conditions) : undefined,
            with: {
                accountSource: true,
                accountDest: true,
                category: true,
                creator: true,
            },
            orderBy: [desc(financeTransactions.date), desc(financeTransactions.createdAt)],
            limit: filters?.limit || 50,
        });
        
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createTransaction(data: CreateTransactionData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  try {
    // 1. Validation
    if (data.amount <= 0) throw new Error("Nominal harus lebih dari 0");
    if (!data.accountIdSource) throw new Error("Akun sumber wajib dipilih");

    // 2. Logic based on Type
    if (data.type === "TRANSFER") {
        if (!data.accountIdDest) throw new Error("Akun tujuan wajib dipilih untuk transfer");
        if (data.accountIdSource === data.accountIdDest) throw new Error("Akun asal dan tujuan tidak boleh sama");
    }

    // 3. Insert
    await db.insert(financeTransactions).values({
        type: data.type,
        accountIdSource: data.accountIdSource,
        // Fix: Ensure empty strings become null to satisfy FK constraints
        accountIdDest: data.accountIdDest || null,
        categoryId: data.categoryId || null,
        amount: data.amount,
        description: data.description,
        proofImage: data.proofImage,
        date: data.date || new Date(),
        status: data.status || "APPROVED",
        createdBy: session.user?.id || null, // Use authenticated user ID
    });

    revalidatePath("/keuangan/arus-kas");
    return { success: true, message: "Transaksi berhasil dicatat" };

  } catch (error: any) {
    console.error("Create Transaction Error:", error);
    return { success: false, error: error.message };
  }
}

export async function updateTransaction(id: string, data: Partial<CreateTransactionData>) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        // Basic validation if keys present
        if (data.amount !== undefined && data.amount <= 0) return { success: false, error: "Nominal harus > 0" };

        await db.update(financeTransactions).set({
            ...data,
            // Ensure nulls if cleared or empty string
            accountIdDest: (data.type === "TRANSFER" && data.accountIdDest) ? data.accountIdDest : null,
            categoryId: data.categoryId || null,
        }).where(eq(financeTransactions.id, id));

        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Transaksi diperbarui" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteTransaction(id: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        await db.delete(financeTransactions).where(eq(financeTransactions.id, id));
        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Transaksi dihapus" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function approveTransaction(transactionId: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        await db.update(financeTransactions).set({ status: "APPROVED" }).where(eq(financeTransactions.id, transactionId));
        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Transaksi disetujui" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
// --- Reports ---

export async function getReportTransactions(filters: { accountId?: string; startDate: Date; endDate: Date }) {
    try {
        const conditions = [
            // Only approved transactions usually count for reports
            eq(financeTransactions.status, "APPROVED"),
            // Date Range
            between(financeTransactions.date, filters.startDate, filters.endDate)
        ];

        if (filters.accountId) {
             conditions.push(sql`(${financeTransactions.accountIdSource} = ${filters.accountId} OR ${financeTransactions.accountIdDest} = ${filters.accountId})`);
        }
        
        const data = await db.query.financeTransactions.findMany({
            where: and(...conditions),
            with: {
                accountSource: true,
                accountDest: true,
                category: true,
            },
            // Order by Date ASC for Running Balance
            orderBy: [asc(financeTransactions.date), asc(financeTransactions.createdAt)],
        });
        
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
