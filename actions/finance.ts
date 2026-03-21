"use server";

import { db } from "@/db";
import { financeAccounts, financeCategories, financeTransactions } from "@/db";
import { eq, desc, asc, and, sql, between, type SQL } from "drizzle-orm";
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
    const response = await fetch("http://localhost:8080/api/finance/accounts", { cache: 'no-store' });
    if (!response.ok) throw new Error("Gagal mengambil data dari API Go");
    return await response.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function createAccount(data: { name: string; accountNumber?: string; description?: string; initialBalance?: number }) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  try {
    const payload = { ...data, createdBy: session.user?.id };
    const response = await fetch("http://localhost:8080/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.success) revalidatePath("/keuangan/arus-kas");
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateAccount(id: string, data: { name: string; accountNumber?: string; description?: string }) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const response = await fetch(`http://localhost:8080/api/finance/accounts/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) revalidatePath("/keuangan/arus-kas");
        return result;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function deleteAccount(id: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const response = await fetch(`http://localhost:8080/api/finance/accounts/${id}`, {
            method: "DELETE"
        });
        const result = await response.json();
        if (result.success) revalidatePath("/keuangan/arus-kas");
        return result;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
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
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function createCategory(data: { name: string; type: "INCOME" | "EXPENSE"; description?: string }) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  try {
    await db.insert(financeCategories).values(data);
    revalidatePath("/keuangan/arus-kas");
    return { success: true, message: "Kategori berhasil dibuat" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateCategory(id: string, data: { name: string; type: "INCOME" | "EXPENSE"; description?: string }) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        await db.update(financeCategories).set(data).where(eq(financeCategories.id, id));
        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Kategori berhasil diperbarui" };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
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
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

// --- Transactions ---

export async function getTransactions(filters?: { accountId?: string; startDate?: Date; endDate?: Date; limit?: number }) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const conditions: (SQL | undefined)[] = [];
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
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
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

  } catch (error) {
    console.error("Create Transaction Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
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
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function deleteTransaction(id: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        await db.delete(financeTransactions).where(eq(financeTransactions.id, id));
        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Transaksi dihapus" };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function approveTransaction(transactionId: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        await db.update(financeTransactions).set({ status: "APPROVED" }).where(eq(financeTransactions.id, transactionId));
        revalidatePath("/keuangan/arus-kas");
        return { success: true, message: "Transaksi disetujui" };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
// --- Reports ---

export async function getReportTransactions(filters: { accountId?: string; startDate: Date; endDate: Date }) {
// Report Report Transactions
    try {
        const conditions: (SQL | undefined)[] = [
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
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Gagal mengambil data laporan" };
    }
}
