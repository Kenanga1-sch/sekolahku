"use server";

import { db } from "@/db";
import { loans, loanInstallments, employeeDetails, users, tabunganBrankas, tabunganBrankasTransaksi } from "@/db"; // Assuming exports
import { eq, desc, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// --- Types ---
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

// --- Actions ---

// ... imports
import { auth } from "@/auth";

// ... Types

// --- Actions ---

export async function createLoan(data: CreateLoanParams) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        // Basic validation
        if (data.borrowerType === "EMPLOYEE" && !data.employeeDetailId) {
            return { success: false, error: "Pegawai wajib dipilih untuk Hutang Pegawai" };
        }
        if (data.borrowerType !== "EMPLOYEE" && !data.borrowerName) {
            return { success: false, error: "Nama Peminjam/Pemberi Hutang wajib diisi" };
        }

        let finalEmployeeDetailId = data.employeeDetailId;

        // Resolve EmployeeDetailId if it's a UserId
        if (data.borrowerType === "EMPLOYEE" && data.employeeDetailId) {
            // Check if it matches a UserId first (Common case since UI sends userId)
            const byUserId = await db.query.employeeDetails.findFirst({
                where: eq(employeeDetails.userId, data.employeeDetailId)
            });

            if (byUserId) {
                finalEmployeeDetailId = byUserId.id;
            } else {
                // If not found by UserId, check if it's already a valid EmployeeDetailId
                const byId = await db.query.employeeDetails.findFirst({
                    where: eq(employeeDetails.id, data.employeeDetailId)
                });

                if (!byId) {
                    // Try to auto-create if it's a valid User but no Detail? 
                    // Or just fail. For now fail with clear message.
                    // Actually, let's check if the user exists at least
                    const userExists = await db.query.users.findFirst({ where: eq(users.id, data.employeeDetailId) });
                    if (userExists) {
                         // Auto-create minimal employee detail
                        const newDetail = await db.insert(employeeDetails).values({
                            userId: userExists.id,
                            // defaults
                        }).returning();
                        finalEmployeeDetailId = newDetail[0].id;
                    } else {
                        return { success: false, error: "Data detail pegawai tidak ditemukan. Hubungi Admin." };
                    }
                }
            }
        }

        await db.insert(loans).values({
            ...data,
            employeeDetailId: finalEmployeeDetailId,
            amountApproved: data.amountRequested, // Default behavior as per original code
            status: "PENDING", 
        });

        revalidatePath("/keuangan/tabungan/bendahara");
        return { success: true, message: "Data hutang berhasil dibuat" };
    } catch (error: any) {
        // Better error message for constraint violation
        if (error.message.includes("FOREIGN KEY")) {
             return { success: false, error: "Gagal: Data pegawai tidak valid (FK Error)." };
        }
        return { success: false, error: error.message };
    }
}

export async function getLoans(type: "RECEIVABLE" | "PAYABLE") {
    // RECEIVABLE = Hutang Pegawai (School expects money back) -> borrowerType = EMPLOYEE
    // PAYABLE = Hutang Sekolah (School owes money) -> borrowerType != EMPLOYEE
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    
    try {
        const whereClause = type === "RECEIVABLE" 
            ? eq(loans.borrowerType, "EMPLOYEE")
            : ne(loans.borrowerType, "EMPLOYEE");

        const data = await db.query.loans.findMany({
            where: whereClause,
            with: {
                employee: {
                    with: {
                        user: true
                    }
                },
                installments: true
            },
            orderBy: [desc(loans.createdAt)],
        });

        // Calculate paid amount
        const enriched = data.map(loan => {
            const paid = loan.installments
                .filter(i => i.status === "PAID")
                .reduce((sum, i) => sum + i.totalAmount, 0);
            return { ...loan, paidAmount: paid, remainingAmount: (loan.amountApproved || 0) + (loan.adminFee || 0) - paid };
        });

        return { success: true, data: enriched };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Helper to get Vaults
export async function getVaults() {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const result = await db.query.tabunganBrankas.findMany();
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function approveLoan(loanId: string, approvedAmount: number, sourceVaultId: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        // Validation
        if (!sourceVaultId) return { success: false, error: "Sumber dana (Brankas Tunai) wajib dipilih" };

        const vault = await db.query.tabunganBrankas.findFirst({
            where: eq(tabunganBrankas.id, sourceVaultId)
        });

        if (!vault) return { success: false, error: "Data brankas tidak ditemukan" };
        if (vault.tipe !== "cash") return { success: false, error: "Pencairan hutang hanya boleh menggunakan Uang Tunai (Kas)" };
        if (vault.saldo < approvedAmount) return { success: false, error: "Saldo Brankas Tunai tidak mencukupi. Silakan tarik dana dari Bank terlebih dahulu." };

        // Transaction
        db.transaction((tx) => {
            // 1. Update Loan Status
            tx.update(loans)
                .set({ 
                    status: "APPROVED",
                    amountApproved: approvedAmount,
                    disbursedAt: new Date(), 
                    // Store sourceVaultId if we add a column later, for now we just log in transaction
                })
                .where(eq(loans.id, loanId))
                .run();
            
            // 2. Deduct from Vault
            tx.update(tabunganBrankas)
                .set({ saldo: vault.saldo - approvedAmount })
                .where(eq(tabunganBrankas.id, sourceVaultId))
                .run();

            // 3. Log Vault Transaction
            tx.insert(tabunganBrankasTransaksi).values({
                tipe: "tarik_dari_bank", // Context: Money OUT (Disbursement). reusing compatible enum.
                nominal: approvedAmount,
                catatan: `Pencairan Pinjaman: ${loanId}`, 
                userId: session.user?.id || "SYSTEM"
            } as any).run();
        });

        revalidatePath("/keuangan/tabungan/bendahara");
        return { success: true, message: "Hutang disetujui & dana dicairkan dari Kas Tunai" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function addPayment(loanId: string, amount: number, notes?: string, targetVaultId?: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        if (!targetVaultId) return { success: false, error: "Tujuan masuk dana (Brankas Tunai) wajib dipilih" };

        const loan = await db.query.loans.findFirst({
             where: eq(loans.id, loanId),
             with: { installments: true } 
        });

        if (!loan) return { success: false, error: "Hutang tidak ditemukan" };
        
        const vault = await db.query.tabunganBrankas.findFirst({ where: eq(tabunganBrankas.id, targetVaultId) });
        if (!vault) return { success: false, error: "Brankas tujuan tidak ditemukan" };
        if (vault.tipe !== "cash") return { success: false, error: "Pembayaran hutang hanya boleh masuk ke Uang Tunai (Kas)" };

        db.transaction((tx) => {
             // 1. Record Installment
            const nextInstallmentNum = loan.installments.length + 1;
            tx.insert(loanInstallments).values({
                loanId,
                installmentNumber: nextInstallmentNum,
                dueDate: new Date(),
                principalAmount: amount, 
                totalAmount: amount,
                status: "PAID",
                paidAt: new Date(),
                paymentMethod: "CASH",
                notes
            } as any).run();

            // 2. Add to Vault
            tx.update(tabunganBrankas)
                .set({ saldo: vault.saldo + amount })
                .where(eq(tabunganBrankas.id, targetVaultId))
                .run();

            // 3. Log Vault Transaction
            tx.insert(tabunganBrankasTransaksi).values({
                tipe: "setor_ke_bank", // Context: Money IN (Repayment). reusing compatible enum.
                nominal: amount,
                catatan: `Pelunasan/Cicilan Hutang: ${loan.description || loan.type} (${loan.id})`,
                userId: session.user?.id || "SYSTEM"
            } as any).run();
        });
        
        revalidatePath("/keuangan/tabungan/bendahara");
        return { success: true, message: "Pembayaran berhasil dicatat & masuk ke Kas Tunai" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
// --- Restored/Compat Actions for LoanRequestDialog ---

export async function getEmployeeOptions() {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const result = await db.query.employeeDetails.findMany({
            with: { user: true }
        });
        
        // Transform to simplified structure if needed, or just return as is
        const options = result.map(emp => ({
            id: emp.id,
            user: emp.user,
            nip: emp.nip
        }));

        return { success: true, data: options };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createLoanRequest(data: {
    employeeDetailId: string;
    type: "KASBON" | "CICILAN";
    amountRequested: number;
    tenorMonths: number;
    notes?: string;
}) {
    // Wrapper for new universal createLoan
    // session check handled in createLoan
    return createLoan({
        borrowerType: "EMPLOYEE",
        employeeDetailId: data.employeeDetailId,
        type: data.type,
        amountRequested: data.amountRequested,
        tenorMonths: data.tenorMonths,
        notes: data.notes,
        description: data.notes // Use notes as description for compatibility
    });
}

export async function rejectLoan(loanId: string, reason: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        await db.update(loans)
            .set({ 
                status: "REJECTED",
                rejectionReason: reason,
                updatedAt: new Date()
            })
            .where(eq(loans.id, loanId));

        revalidatePath("/keuangan/tabungan/bendahara");
        return { success: true, message: "Hutang ditolak" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

