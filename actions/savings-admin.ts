"use server";

import { db } from "@/db";
import { schoolSettings, users, tabunganKelas, tabunganSetoran, tabunganTransaksi, tabunganSiswa, tabunganBrankas, tabunganBrankasTransaksi } from "@/db";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// --- Users ---

export async function getEmployees() {
  try {
    const data = await db.query.users.findMany({
      where: or(eq(users.role, "guru"), eq(users.role, "staff"), eq(users.role, "admin"), eq(users.role, "superadmin")),
      orderBy: [desc(users.name)],
    });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- Treasurer Management ---

export async function getSavingsTreasurer() {
  try {
    const settings = await db.query.schoolSettings.findFirst();
    if (!settings?.savingsTreasurerId) return { success: true, data: null };

    const treasurer = await db.query.users.findFirst({
      where: eq(users.id, settings.savingsTreasurerId),
    });

    return { success: true, data: treasurer };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function assignSavingsTreasurer(userId: string) {
  try {
    const settings = await db.query.schoolSettings.findFirst();
    
    if (settings) {
      await db.update(schoolSettings)
        .set({ savingsTreasurerId: userId })
        .where(eq(schoolSettings.id, settings.id));
    } else {
      // Create if doesn't exist (singleton)
      await db.insert(schoolSettings).values({
        schoolName: "SekolahKu", // Default
        savingsTreasurerId: userId,
      });
    }

    revalidatePath("/keuangan/tabungan/bendahara");
    return { success: true, message: "Bendahara Tabungan berhasil ditunjuk" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- Class Rep Management ---

export async function getClassesWithReps() {
  try {
    const data = await db.query.tabunganKelas.findMany({
      with: {
        waliKelasUser: true,
      },
      orderBy: [desc(tabunganKelas.nama)],
    });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function assignClassRep(classId: string, userId: string) {
  try {
    await db.update(tabunganKelas)
      .set({ waliKelas: userId })
      .where(eq(tabunganKelas.id, classId));
    
    revalidatePath("/keuangan/tabungan/bendahara");
    return { success: true, message: "Penanggung Jawab Kelas berhasil diupdate" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- Verification Queue (Setoran) ---

export async function getPendingSetoran() {
  try {
    const data = await db.query.tabunganSetoran.findMany({
      where: eq(tabunganSetoran.status, "pending"),
      with: {
        guru: true, // The Class Rep who made the deposit
      },
      orderBy: [desc(tabunganSetoran.createdAt)],
    });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function verifySetoran(setoranId: string, bendaharaId: string) {
  try {
    // 1. Update Setoran Status
    await db.update(tabunganSetoran)
      .set({ 
        status: "verified",
        bendaharaId: bendaharaId,
        updatedAt: new Date()
      })
      .where(eq(tabunganSetoran.id, setoranId));

    // 2. Update all linked Transactions to "verified" (if they aren't already)
    // tabunganTransaksi has a status column too. When Setoran is verified, the transactions inside should surely be verified.
    await db.update(tabunganTransaksi)
      .set({ status: "verified" })
      .where(eq(tabunganTransaksi.setoranId, setoranId));

    revalidatePath("/keuangan/tabungan/bendahara");
    return { success: true, message: "Setoran berhasil diverifikasi/disahkan" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectSetoran(setoranId: string, reason?: string) {
  try {
    const existing = await db.query.tabunganSetoran.findFirst({
        where: eq(tabunganSetoran.id, setoranId),
        columns: { catatan: true }
    });

    const oldCatatan = existing?.catatan || "";
    const newCatatan = reason ? `${oldCatatan} [REJECTED: ${reason}]`.trim() : oldCatatan;

    await db.update(tabunganSetoran)
      .set({ 
        status: "rejected",
        catatan: newCatatan,
        updatedAt: new Date()
      })
      .where(eq(tabunganSetoran.id, setoranId));

    // Optionally reject transactions or keep them pending?
    // Usually if the bundle is rejected, the transactions are also rejected or need to be re-bundled.
    // For now, let's mark them rejected too.
    await db.update(tabunganTransaksi)
      .set({ status: "rejected" })
      .where(eq(tabunganTransaksi.setoranId, setoranId));

    revalidatePath("/keuangan/tabungan/bendahara");
    return { success: true, message: "Setoran ditolak" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
// --- Brankas Management ---

export async function getBrankasSummary() {
  try {
    const vaults = await db.query.tabunganBrankas.findMany();
    
    // Sort so Cash is first, Bank is second usually
    vaults.sort((a, b) => (a.tipe === "cash" ? -1 : 1));

    const recentTransactions = await db.query.tabunganBrankasTransaksi.findMany({
      orderBy: [desc(tabunganBrankasTransaksi.createdAt)],
      limit: 10,
      with: {
        user: true,
      }
    });

    return { success: true, data: { vaults, recentTransactions } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function transferVaultFunds(tipe: "setor_ke_bank" | "tarik_dari_bank", nominal: number, userId: string) {
  try {
    const vaults = await db.query.tabunganBrankas.findMany();
    const cashVault = vaults.find(v => v.tipe === 'cash');
    const bankVault = vaults.find(v => v.tipe === 'bank');

    if (!cashVault || !bankVault) {
      return { success: false, error: "Data brankas (Kas/Bank) tidak lengkap." };
    }

    // Validation
    if (tipe === "setor_ke_bank") {
      // Cash -> Bank
      if (cashVault.saldo < nominal) {
        return { success: false, error: "Saldo Kas Tunai tidak mencukupi untuk setor ke Bank." };
      }
    } else {
      // Bank -> Cash
      if (bankVault.saldo < nominal) {
        return { success: false, error: "Saldo Bank tidak mencukupi untuk penarikan." };
      }
    }

    // Perform Transfer
    db.transaction((tx) => {
      // 1. Update Vaults
      if (tipe === "setor_ke_bank") {
        tx.update(tabunganBrankas).set({ saldo: cashVault.saldo - nominal }).where(eq(tabunganBrankas.id, cashVault.id)).run();
        tx.update(tabunganBrankas).set({ saldo: bankVault.saldo + nominal }).where(eq(tabunganBrankas.id, bankVault.id)).run();
      } else {
        tx.update(tabunganBrankas).set({ saldo: cashVault.saldo + nominal }).where(eq(tabunganBrankas.id, cashVault.id)).run();
        tx.update(tabunganBrankas).set({ saldo: bankVault.saldo - nominal }).where(eq(tabunganBrankas.id, bankVault.id)).run();
      }

      // 2. Log Transaction
      tx.insert(tabunganBrankasTransaksi).values({
        tipe,
        nominal,
        userId,
        catatan: tipe === "setor_ke_bank" ? "Setor Tunai ke Bank" : "Tarik Tunai dari Bank",
      } as any).run();
    });

    revalidatePath("/keuangan/tabungan/bendahara");
    return { success: true, message: "Transfer berhasil." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
