// ==========================================
// Data Fetching Hooks (SWR)
// ==========================================
// Centralized data fetching with caching and deduplication

import useSWR from "swr";
import { pb } from "@/lib/pocketbase";
import type { User, SPMBRegistrant, Announcement } from "@/types";
import type { LibraryItem, LibraryMember, LibraryLoan } from "@/types/library";
import type { InventoryAsset, InventoryRoom } from "@/types/inventory";

// ==========================================
// Generic Fetcher
// ==========================================

interface PaginatedResult<T> {
    items: T[];
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
}

interface UseDataOptions {
    page?: number;
    perPage?: number;
    filter?: string;
    sort?: string;
    expand?: string;
}

/**
 * Generic hook for paginated data
 */
function useCollection<T>(
    collection: string,
    options: UseDataOptions = {}
) {
    const { page = 1, perPage = 20, filter = "", sort = "-created", expand = "" } = options;

    const key = `${collection}?page=${page}&perPage=${perPage}&filter=${filter}&sort=${sort}&expand=${expand}`;

    const { data, error, isLoading, mutate } = useSWR<PaginatedResult<T>>(
        key,
        async () => {
            const result = await pb.collection(collection).getList<T>(page, perPage, {
                filter,
                sort,
                expand,
            });
            return result;
        }
    );

    return {
        data: data?.items || [],
        totalItems: data?.totalItems || 0,
        totalPages: data?.totalPages || 1,
        page: data?.page || 1,
        isLoading,
        error,
        mutate,
    };
}

// ==========================================
// User Hooks
// ==========================================

export function useUsers(options: UseDataOptions = {}) {
    return useCollection<User>("users", options);
}

export function useUser(id: string) {
    const { data, error, isLoading, mutate } = useSWR<User>(
        id ? `users/${id}` : null,
        async () => pb.collection("users").getOne<User>(id)
    );
    return { user: data, isLoading, error, mutate };
}

// ==========================================
// SPMB Hooks
// ==========================================

export function useSPMBRegistrants(options: UseDataOptions = {}) {
    return useCollection<SPMBRegistrant>("spmb_registrants", options);
}

export function useSPMBStats() {
    const { data, error, isLoading } = useSWR(
        "spmb_stats",
        async () => {
            const [total, pending, verified, accepted, rejected] = await Promise.all([
                pb.collection("spmb_registrants").getList(1, 1),
                pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "pending"' }),
                pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "verified"' }),
                pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "accepted"' }),
                pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "rejected"' }),
            ]);

            return {
                total: total.totalItems,
                pending: pending.totalItems,
                verified: verified.totalItems,
                accepted: accepted.totalItems,
                rejected: rejected.totalItems,
            };
        },
        { dedupingInterval: 30000 } // Cache stats for 30 seconds
    );

    return { stats: data, isLoading, error };
}

// ==========================================
// Announcement Hooks
// ==========================================

export function useAnnouncements(options: UseDataOptions = {}) {
    return useCollection<Announcement>("announcements", options);
}

// ==========================================
// Library Hooks
// ==========================================

export function useLibraryItems(options: UseDataOptions = {}) {
    return useCollection<LibraryItem>("library_items", options);
}

export function useLibraryMembers(options: UseDataOptions = {}) {
    return useCollection<LibraryMember>("library_members", options);
}

export function useLibraryLoans(options: UseDataOptions = {}) {
    return useCollection<LibraryLoan>("library_loans", {
        ...options,
        expand: options.expand || "member,item",
    });
}

// ==========================================
// Inventory Hooks
// ==========================================

export function useInventoryAssets(options: UseDataOptions = {}) {
    return useCollection<InventoryAsset>("inventory_assets", {
        ...options,
        expand: options.expand || "room",
    });
}

export function useInventoryRooms(options: UseDataOptions = {}) {
    return useCollection<InventoryRoom>("inventory_rooms", options);
}

// ==========================================
// Tabungan Hooks
// ==========================================

import type {
    TabunganKelas,
    TabunganSiswa,
    TabunganTransaksi,
    TabunganStats,
} from "@/types/tabungan";

export function useTabunganKelas(options: UseDataOptions = {}) {
    return useCollection<TabunganKelas>("tabungan_kelas", {
        ...options,
        sort: options.sort || "nama",
    });
}

export function useTabunganSiswa(options: UseDataOptions = {}) {
    return useCollection<TabunganSiswa>("tabungan_siswa", {
        ...options,
        expand: options.expand || "kelas_id",
        filter: options.filter || "is_active = true",
    });
}

export function useTabunganTransaksi(options: UseDataOptions = {}) {
    return useCollection<TabunganTransaksi>("tabungan_transaksi", {
        ...options,
        expand: options.expand || "siswa_id,user_id,verified_by",
    });
}

export function useTabunganStats() {
    const { data, error, isLoading, mutate } = useSWR<TabunganStats>(
        "tabungan_stats",
        async () => {
            const today = new Date().toISOString().split("T")[0];

            const [siswaRes, pendingRes, todayRes] = await Promise.all([
                pb.collection("tabungan_siswa").getList(1, 1, { filter: "is_active = true" }),
                pb.collection("tabungan_transaksi").getList(1, 1, { filter: 'status = "pending"' }),
                pb.collection("tabungan_transaksi").getList(1, 100, {
                    filter: `created >= "${today}" && status = "verified"`,
                }),
            ]);

            // Calculate saldo (batched)
            let totalSaldo = 0;
            const saldoBatch = await pb.collection("tabungan_siswa").getList<TabunganSiswa>(1, 100, {
                filter: "is_active = true",
                fields: "saldo_terakhir",
            });
            totalSaldo = saldoBatch.items.reduce((sum, s) => sum + (s.saldo_terakhir || 0), 0);

            // Calculate today's totals
            let todayDeposit = 0;
            let todayWithdraw = 0;
            for (const t of todayRes.items as TabunganTransaksi[]) {
                if (t.tipe === "setor") todayDeposit += t.nominal;
                else todayWithdraw += t.nominal;
            }

            return {
                totalSiswa: siswaRes.totalItems,
                totalSaldo,
                pendingTransactions: pendingRes.totalItems,
                todayTransactions: todayRes.totalItems,
                todayDeposit,
                todayWithdraw,
            };
        },
        { dedupingInterval: 30000 }
    );

    return { stats: data, isLoading, error, mutate };
}

export function useTabunganPending() {
    return useCollection<TabunganTransaksi>("tabungan_transaksi", {
        filter: 'status = "pending"',
        expand: "siswa_id,user_id",
        sort: "-created",
        perPage: 100,
    });
}
