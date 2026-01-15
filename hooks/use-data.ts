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
