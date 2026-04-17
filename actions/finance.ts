/**
 * Client-side finance actions — fetches directly from Golang API.
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

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

// --- Accounts ---
export async function getAccounts() {
  try { return await goGet("/api/finance/accounts"); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function createAccount(data: any) {
  try { return await goPost("/api/finance/accounts", data); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function updateAccount(id: string, data: any) {
  try { return await goPut(`/api/finance/accounts/${id}`, data); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function deleteAccount(id: string) {
  try { return await goDelete(`/api/finance/accounts/${id}`); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

// --- Categories ---
export async function getCategories() {
  try { return await goGet("/api/finance/categories"); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function createCategory(data: any) {
  try { return await goPost("/api/finance/categories", data); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function updateCategory(id: string, data: any) {
  try { return await goPut(`/api/finance/categories/${id}`, data); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function deleteCategory(id: string) {
  try { return await goDelete(`/api/finance/categories/${id}`); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

// --- Transactions ---
export async function getTransactions(params?: any) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  try { return await goGet(`/api/finance/transactions${query}`); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function createTransaction(data: CreateTransactionData) {
  try { return await goPost("/api/finance/transactions", data); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function updateTransaction(id: string, data: any) {
  try { return await goPut(`/api/finance/transactions/${id}`, data); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function deleteTransaction(id: string) {
  try { return await goDelete(`/api/finance/transactions/${id}`); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

// --- Stats ---
export async function getFinanceStats() {
  try { return await goGet("/api/finance/stats"); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function getFinanceDashboard() {
  try { return await goGet("/api/finance/dashboard"); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function getTransactionsByDateRange(start: string, end: string) {
  try { return await goGet(`/api/finance/transactions?startDate=${start}&endDate=${end}`); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function getReportTransactions(params?: any) {
  try { 
    return await getTransactions(params);
  }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}
