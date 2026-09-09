/**
 * Inventory Helpers (Client-side)
 * Semua logika database ada di backend Go; modul ini hanya pembungkus tipis
 * di atas API. Respons error TIDAK ditelan: pemanggil wajib menangani.
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import type {
    InventoryAsset,
    InventoryRoom,
    InventoryOpname,
    InventoryStats,
} from "@/types/inventory";

/** Buka "items" dari bentuk respons lama (items) maupun baru (data). */
export function unwrapItems<T>(res: unknown): T[] {
    if (Array.isArray(res)) return res as T[];
    const r = res as Record<string, unknown>;
    if (Array.isArray(r?.items)) return r.items as T[];
    if (Array.isArray(r?.data)) return r.data as T[];
    return [];
}

export interface UserOption {
    id: string;
    name: string;
    role: string;
}

export async function getUsers(): Promise<UserOption[]> {
    const res = await goGet<{ items: { id: string; name: string; role: string }[] }>("/api/users?limit=1000");
    return res?.items ?? [];
}

// ============ Ruangan ============

export async function getRooms(
    page = 1,
    perPage = 20,
    search = "",
): Promise<{ items: InventoryRoom[]; totalItems: number }> {
    const query = new URLSearchParams({
        page: page.toString(),
        limit: perPage.toString(),
        q: search,
    });
    return await goGet(`/api/inventory/rooms?${query}`);
}

export async function getAllRooms(): Promise<InventoryRoom[]> {
    const res = await getRooms(1, 200);
    return res.items;
}

export async function createRoom(data: Partial<InventoryRoom>): Promise<InventoryRoom> {
    return await goPost("/api/inventory/rooms", data);
}

export async function updateRoom(id: string, data: Partial<InventoryRoom>): Promise<InventoryRoom> {
    return await goPut(`/api/inventory/rooms/${id}`, data);
}

export async function deleteRoom(id: string): Promise<boolean> {
    await goDelete(`/api/inventory/rooms/${id}`);
    return true;
}

// ============ Aset ============

export interface AssetFilter {
    roomId?: string;
    search?: string;
    category?: string;
}

export async function getAssets(
    page = 1,
    perPage = 20,
    filter: AssetFilter = {},
): Promise<{ items: InventoryAsset[]; totalPages: number; totalItems: number }> {
    const query = new URLSearchParams({
        page: page.toString(),
        limit: perPage.toString(),
        roomId: filter.roomId ?? "",
        search: filter.search ?? "",
        category: filter.category ?? "",
    });
    return await goGet(`/api/inventory/assets?${query}`);
}

export async function getAsset(id: string): Promise<InventoryAsset | null> {
    try {
        return await goGet(`/api/inventory/assets/${id}`);
    } catch {
        return null;
    }
}

export async function createAsset(data: Partial<InventoryAsset>): Promise<InventoryAsset> {
    return await goPost("/api/inventory/assets", data);
}

export async function updateAsset(id: string, data: Partial<InventoryAsset>): Promise<InventoryAsset> {
    return await goPut(`/api/inventory/assets/${id}`, data);
}

export async function deleteAsset(id: string): Promise<boolean> {
    await goDelete(`/api/inventory/assets/${id}`);
    return true;
}

// ============ Opname ============

/**
 * Ambil SEMUA aset untuk laporan, dengan menelusuri halaman.
 *
 * Backend memotong `limit` menjadi paling banyak 200 (inventoryPaging), jadi
 * meminta ?limit=1000 tidak pernah bekerja — ia sunyi-sunyi dipotong.
 * Laporan yang hanya mengambil halaman pertama akan kehilangan sisanya tanpa
 * tanda apa pun. Fungsi ini membaca totalItems dan mengulang sampai semua
 * halaman terkumpul.
 *
 * Batas halaman diminta 200 (batas atas backend) agar jumlah permintaan
 * sesedikit mungkin.
 */
export async function getAllAssets(
    filter: AssetFilter = {},
    maxPages = 200,
): Promise<InventoryAsset[]> {
    const all: InventoryAsset[] = [];
    let page = 1;
    while (page <= maxPages) {
        const res = await getAssets(page, 200, filter);
        const items = res?.items ?? [];
        all.push(...items);
        const totalItems = res?.totalItems ?? items.length;
        const totalPages = res?.totalPages ?? 1;
        // Hentikan juga bila server mengembalikan halaman kosong, supaya
        // hitungan total yang keliru tidak membuat pengulangan tak berujung.
        if (items.length === 0) break;
        if (all.length >= totalItems) break;
        if (page >= totalPages) break;
        page += 1;
    }
    return all;
}

export async function getOpnameSessions(
    page = 1,
    perPage = 20,
): Promise<{ items: InventoryOpname[]; totalItems: number }> {
    return await goGet(`/api/inventory/opname?page=${page}&limit=${perPage}`);
}

export async function createOpnameSession(data: Partial<InventoryOpname>): Promise<{ success: boolean }> {
    return await goPost("/api/inventory/opname", data);
}

export async function applyOpnameSession(id: string): Promise<boolean> {
    await goPost(`/api/inventory/opname/${id}/apply`);
    return true;
}

// ============ Statistik ============

export async function getInventoryStats(): Promise<InventoryStats> {
    const res = await goGet<{ data: InventoryStats }>("/api/inventory/stats");
    return res.data ?? (res as unknown as InventoryStats);
}

export async function getCategoryDistribution(): Promise<{ name: string; value: number; color: string }[]> {
    return await goGet("/api/inventory/data?type=category-distribution");
}

export async function getConditionBreakdown(): Promise<{ name: string; value: number; color: string }[]> {
    return await goGet("/api/inventory/data?type=condition-breakdown");
}

export async function getTopRoomsByValue(): Promise<
    { id: string; name: string; assetCount: number; totalValue: number }[]
> {
    return await goGet("/api/inventory/data?type=top-rooms");
}

export async function getRecentAudit(limit = 10): Promise<{
    id: string;
    action: string;
    entity: string;
    entityId: string;
    userName: string;
    time: string;
}[]> {
    return await goGet(`/api/inventory/data?type=recent-audit&limit=${limit}`);
}

export async function getAssetReport(category?: string): Promise<{
    id: string;
    name: string;
    code: string | null;
    category: string;
    roomName: string;
    quantity: number;
    conditionGood: number;
    conditionDamaged: number;
    conditionLost: number;
    price: number;
    totalValue: number;
}[]> {
    const res = await getAssets(1, 200, category ? { category } : {});
    return res.items.map(a => ({
        id: a.id,
        name: a.name,
        code: a.code ?? "",
        category: a.category,
        roomName: a.expand?.room?.name ?? "-",
        quantity: a.quantity,
        conditionGood: a.condition_good ?? 0,
        conditionDamaged: (a.condition_light_damaged ?? 0) + (a.condition_heavy_damaged ?? 0),
        conditionLost: a.condition_lost ?? 0,
        price: a.price,
        totalValue: a.price * a.quantity,
    }));
}

// ============ Pengajuan Peminjaman Aset Antar-Ruangan ============

export interface BorrowRequest {
    id: string;
    assetId: string;
    assetName: string;
    roomId: string;
    roomName: string;
    requesterId: string;
    requesterName: string;
    reason?: string | null;
    quantity: number;
    status: "pending" | "approved" | "rejected" | "returned";
    approvedBy?: string | null;
    approvedAt?: number | null;
    returnedBy?: string | null;
    returnedAt?: number | null;
    createdAt: number;
}

export async function createBorrowRequest(assetId: string, quantity: number, reason: string): Promise<{ id: string; status: string }> {
    const res = await goPost<{ data: { id: string; status: string } }>("/api/inventory/borrow-requests", { assetId, quantity, reason });
    return res.data;
}

export async function getBorrowRequests(status?: string): Promise<BorrowRequest[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await goGet<{ items: BorrowRequest[] }>(`/api/inventory/borrow-requests${q}`);
    return res?.items ?? [];
}

export async function reviewBorrowRequest(id: string, action: "approve" | "reject"): Promise<{ status: string }> {
    return await goPost(`/api/inventory/borrow-requests/${id}/review`, { action });
}

export async function returnBorrowRequest(id: string): Promise<{ status: string }> {
    return await goPost(`/api/inventory/borrow-requests/${id}/return`, {});
}

// ============ Upload Foto untuk Label ============

/**
 * Unggah foto aset/barang ke folder `inventory` dan kembalikan URL-nya.
 * Foto bersifat opsional — kalau tidak ada, halaman detail publik menampilkan
 * placeholder, bukan error.
 */
export async function uploadPhoto(file: File): Promise<string> {
    let uploadFile = file;
    try {
        const { compressImage } = await import("@/lib/utils");
        if (file.type.startsWith("image/")) {
            uploadFile = await compressImage(file, 1024, 0.85);
        }
    } catch {
        // Kompresi gagal tidak fatal — unggah berkas aslinya.
    }
    const form = new FormData();
    form.append("file", uploadFile);
    form.append("folder", "inventory");
    const res = await goPost<{ success: boolean; url: string }>("/api/upload", form);
    if (!res?.url) {
        throw new Error("Upload gagal: server tidak mengembalikan URL");
    }
    return res.url;
}

// ============ Pelacakan per Bungkus (Batch & Unit) ============

export interface ItemBatch {
    id: string;
    itemId: string;
    batchCode?: string;
    year: number;
    startNo: number;
    endNo: number;
    quantity: number;
    fundingSource?: string | null;
    fiscalYear?: number | null;
    receivedAt?: number | null;
    description?: string | null;
    createdAt?: number | null;
}

export interface ItemUnit {
    id: string;
    itemId: string;
    batchId?: string | null;
    unitNo: number;
    year: number;
    status: "AVAILABLE" | "ISSUED";
    issuedTo?: string | null;
    issuedAt?: number | null;
}

/**
 * Ambil daftar penerimaan (batch) suatu barang.
 * Mencetak per batch membuat nomor tidak pernah berubah.
 */
export async function getItemBatches(itemId: string): Promise<ItemBatch[]> {
    const res = await goGet<{ batches?: ItemBatch[]; data?: ItemBatch[] }>(
        `/api/inventory/items/${itemId}/batches`
    );
    return res?.batches || res?.data || [];
}

/**
 * Ambil nomor-nomor bungkus. Secara bawaan hanya yang masih tersedia.
 */
export async function getItemUnits(
    itemId: string,
    year: number,
    onlyAvailable = true
): Promise<ItemUnit[]> {
    const res = await goGet<{ units?: ItemUnit[]; data?: ItemUnit[] }>(
        `/api/inventory/items/${itemId}/units?year=${year}${onlyAvailable ? "" : "&all=true"}`
    );
    return res?.units || res?.data || [];
}

/**
 * Kembalikan bungkus yang sudah dikeluarkan menjadi tersedia lagi.
 */
export async function returnItemUnits(
    itemId: string,
    numbers: number[],
    date?: string
): Promise<number> {
    const res = await goPost<{ success: boolean; count: number }>(
        `/api/inventory/items/${itemId}/units/return`,
        { numbers, date }
    );
    return res?.count || 0;
}
