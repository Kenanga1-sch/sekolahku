"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCw } from "lucide-react";
import { goGet } from "@/lib/api-client";

export interface WidgetState<T> {
    data: T;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

/**
 * Fetch terpadu untuk widget dashboard inventaris.
 *
 * Latar belakang: sebelumnya setiap widget memanggil goGet sendiri di dalam
 * useEffect dan menelan semua kegagalan dengan blok catch kosong. Akibatnya
 * empat widget dashboard kosong permanen (endpoint 404) tanpa error, tanpa
 * log, dan tanpa bisa dibedakan dari "memang belum ada data".
 *
 * Hook ini membuat kegagalan eksplisit: `error` terisi, dan UI wajib
 * menampilkannya beserta tombol coba ulang.
 */
export function useWidgetData<T>(
    path: string,
    empty: T,
    deps: unknown[] = []
): WidgetState<T> {
    const [data, setData] = useState<T>(empty);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await goGet<T>(path);
            setData(result ?? empty);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal memuat data");
            setData(empty);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path, ...deps]);

    useEffect(() => {
        load();
    }, [load]);

    return { data, loading, error, reload: load };
}

/**
 * Tampilan seragam saat widget gagal memuat.
 * Sengaja dipusatkan di sini supaya tidak ada lagi widget yang gagal diam-diam.
 */
export function WidgetError({
    message,
    onRetry,
    height = 250,
}: {
    message: string;
    onRetry: () => void;
    height?: number;
}) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-3 px-6 text-center"
            style={{ height }}
        >
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">{message}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCw className="h-3.5 w-3.5 mr-2" />
                Coba lagi
            </Button>
        </div>
    );
}
