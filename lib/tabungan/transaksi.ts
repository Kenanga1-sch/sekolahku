import { goGet, goPost, goDelete } from "@/lib/api-client";
import type {
    TabunganTransaksiWithRelations,
    TabunganTransaksiFormData,
} from "@/types/tabungan";

export async function getTransaksi(
    page = 1,
    perPage = 20,
    options: {
        siswaId?: string;
        search?: string;
    } = {}
): Promise<{ items: TabunganTransaksiWithRelations[]; totalPages: number; totalItems: number }> {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", perPage.toString());
    if (options.siswaId) params.append("siswaId", options.siswaId);
    if (options.search) params.append("search", options.search);

    const response: any = await goGet(`/api/savings/transactions?${params.toString()}`);
    if (response.success) {
        return {
            items: response.data || [],
            totalPages: response.pagination?.totalPages || 1,
            totalItems: response.pagination?.total || 0
        };
    }
    return { items: [], totalPages: 0, totalItems: 0 };
}

export async function getOpenTransactions(guruId: string): Promise<TabunganTransaksiWithRelations[]> {
    // Currently reuse main transactions but client side filter or dedicated endpoint
    // To match backend logic: get collected but not settled.
    // Let's assume there's a param for status on the backend.
    const response: any = await goGet(`/api/savings/transactions?status=collected&guruId=${guruId}`);
    return response.success ? response.data : [];
}

export async function createTransaksi(
    data: TabunganTransaksiFormData,
    userId: string
) {
    const currentTipe = (data as any).type || (data as any).tipe;
    const payload = {
        siswaId: data.siswaId,
        tipe: currentTipe,
        nominal: data.nominal,
        catatan: data.catatan,
        userId: userId
    };

    return await goPost("/api/savings/transactions", payload);
}

export async function deleteTransaksi(id: string) {
    return await goDelete(`/api/savings/transactions/${id}`);
}

export async function getRecentTransactions(limit = 10): Promise<TabunganTransaksiWithRelations[]> {
    const response: any = await goGet(`/api/savings/transactions?limit=${limit}`);
    return response.success ? response.data : [];
}
