/**
 * Loan Actions — communicates with Go backend.
 * Optimized with handleAction and Caching.
 */

import { goGet, goPost, CacheTTL } from "@/lib/api-client";
import { handleAction } from "@/lib/action-utils";

export type CreateLoanParams = {
    borrowerType: "EMPLOYEE" | "SCHOOL" | "EXTERNAL";
    employeeDetailId?: string;
    borrowerName?: string;
    description?: string;
    type: "KASBON" | "CICILAN";
    amountRequested: number;
    tenorMonths: number;
    notes?: string;
};

export async function createLoan(data: CreateLoanParams) {
    return handleAction(goPost("/api/loans", data), "Pengajuan pinjaman berhasil dibuat");
}

function extractList(data: any) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.vaults)) return data.vaults;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.items)) return data.data.items;
    if (Array.isArray(data?.data?.vaults)) return data.data.vaults;
    if (Array.isArray(data?.data?.data)) return data.data.data;
    return [];
}

export async function getLoans(type: "RECEIVABLE" | "PAYABLE") {
    const backendType = type === "RECEIVABLE" ? "EMPLOYEE" : "PAYABLE";
    return handleAction(
        goGet(`/api/loans?type=${backendType}`, { ttl: CacheTTL.SHORT }).then(extractList)
    );
}

export async function getVaults() {
    return handleAction(
        goGet("/api/savings/brankas", { ttl: CacheTTL.MEDIUM }).then(extractList)
    );
}

export async function approveLoan(loanId: string, approvedAmount: number, sourceVaultId: string) {
    return handleAction(
        goPost(`/api/loans/${loanId}/approve`, { approvedAmount, sourceVaultId }),
        "Pinjaman disetujui"
    );
}

export async function addPayment(loanId: string, amount: number, notes?: string, targetVaultId?: string) {
    return handleAction(
        goPost(`/api/loans/${loanId}/pay`, { amount, notes, targetVaultId }),
        "Pembayaran berhasil dicatat"
    );
}

export async function getEmployeeOptions() {
    return handleAction(goGet("/api/master/employees", { ttl: CacheTTL.LONG }));
}

export async function createLoanRequest(data: any) {
    return createLoan({
        ...data,
        borrowerType: "EMPLOYEE",
        description: data.notes
    });
}

export async function rejectLoan(loanId: string, reason: string) {
    return handleAction(
        goPost(`/api/loans/${loanId}/reject`, { reason }),
        "Pinjaman ditolak"
    );
}
