/**
 * Client-side finance actions - fetches directly from Golang API.
 * Optimized with handleAction while keeping finance data fresh after mutations.
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import { handleAction } from "@/lib/action-utils";

export type CreateTransactionData = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  accountIdSource: string;
  accountIdDest?: string;
  categoryId?: string;
  amount: number;
  description?: string;
  proofImage?: string;
  date?: Date;
  status?: "PENDING" | "APPROVED";
};

function unwrapApi<T = any>(response: any): T {
  return (response?.data ?? response?.items ?? response) as T;
}

function normalizeParams(params?: Record<string, any>) {
  const normalized = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (value instanceof Date) {
      normalized.set(key, value.toISOString());
    } else {
      normalized.set(key, String(value));
    }
  });
  const query = normalized.toString();
  return query ? `?${query}` : "";
}

// --- Accounts ---
export async function getAccounts() {
  return handleAction(goGet("/api/finance/accounts", { forceRefresh: true }).then(unwrapApi));
}

export async function createAccount(data: any) {
  return handleAction(goPost("/api/finance/accounts", data), "Akun berhasil dibuat");
}

export async function updateAccount(id: string, data: any) {
  return handleAction(goPut(`/api/finance/accounts/${id}`, data), "Akun berhasil diperbarui");
}

export async function deleteAccount(id: string) {
  return handleAction(goDelete(`/api/finance/accounts/${id}`), "Akun berhasil dihapus");
}

// --- Categories ---
export async function getCategories() {
  return handleAction(goGet("/api/finance/categories", { forceRefresh: true }).then(unwrapApi));
}

export async function createCategory(data: any) {
  return handleAction(goPost("/api/finance/categories", data), "Kategori berhasil dibuat");
}

export async function updateCategory(id: string, data: any) {
  return handleAction(goPut(`/api/finance/categories/${id}`, data), "Kategori berhasil diperbarui");
}

export async function deleteCategory(id: string) {
  return handleAction(goDelete(`/api/finance/categories/${id}`), "Kategori berhasil dihapus");
}

// --- Transactions ---
export async function getTransactions(params?: any) {
  return handleAction(goGet(`/api/finance/transactions${normalizeParams(params)}`, { forceRefresh: true }).then(unwrapApi));
}

export async function createTransaction(data: CreateTransactionData) {
  return handleAction(goPost("/api/finance/transactions", data), "Transaksi berhasil dicatat");
}

export async function updateTransaction(id: string, data: any) {
  return handleAction(goPut(`/api/finance/transactions/${id}`, data), "Transaksi berhasil diperbarui");
}

export async function deleteTransaction(id: string) {
  return handleAction(goDelete(`/api/finance/transactions/${id}`), "Transaksi berhasil dihapus");
}

// --- Stats ---
export async function getFinanceStats() {
  return handleAction(goGet("/api/finance/stats", { forceRefresh: true }).then(unwrapApi));
}

export async function getFinanceDashboard() {
  return handleAction(goGet("/api/finance/dashboard", { forceRefresh: true }).then(unwrapApi));
}

export async function getTransactionsByDateRange(start: string, end: string) {
  return getTransactions({ startDate: start, endDate: end, status: "APPROVED", sort: "asc", limit: 2000 });
}

export async function getReportTransactions(params?: any) {
  return getTransactions(params);
}
