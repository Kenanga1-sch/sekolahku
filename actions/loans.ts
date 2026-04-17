import { goGet, goPost } from "@/lib/api-client";

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
    try {
        const res = await goPost("/api/loans", data);
        return res;
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function getLoans(type: "RECEIVABLE" | "PAYABLE") {
    try {
        return await goGet(`/api/loans?type=${type}`);
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function getVaults() {
    try {
        const res: any = await goGet("/api/savings/brankas");
        return res;
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function approveLoan(loanId: string, approvedAmount: number, sourceVaultId: string) {
    try {
        const res = await goPost(`/api/loans/${loanId}/approve`, { approvedAmount, sourceVaultId });
        return res;
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function addPayment(loanId: string, amount: number, notes?: string, targetVaultId?: string) {
    try {
        const res = await goPost(`/api/loans/${loanId}/payments`, { amount, notes, targetVaultId });
        return res;
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function getEmployeeOptions() {
    try {
        return await goGet("/api/employee/options");
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function createLoanRequest(data: any) {
    return createLoan({
        ...data,
        borrowerType: "EMPLOYEE",
        description: data.notes
    });
}

export async function rejectLoan(loanId: string, reason: string) {
    try {
        const res = await goPost(`/api/loans/${loanId}/reject`, { reason });
        return res;
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}
