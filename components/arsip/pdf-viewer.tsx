"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizePublicPath } from "@/lib/utils";

interface PDFViewerProps {
    url: string | null;
    className?: string;
}

export function PDFViewer({ url, className }: PDFViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const normalizedUrl = normalizePublicPath(url);

    useEffect(() => {
        setLoading(Boolean(normalizedUrl));
        setError(false);
    }, [normalizedUrl]);

    if (!normalizedUrl) {
        return (
            <div className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-800 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-xl text-muted-foreground ${className}`}>
                <p>Tidak ada file dipilih</p>
                <p className="text-xs">Upload dokumen PDF untuk melihat preview</p>
            </div>
        );
    }

    return (
        <div className={`relative bg-slate-200 dark:bg-zinc-900 rounded-xl overflow-hidden border ${className}`}>
            {loading && !error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-50/50">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            )}
            
            {error ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                    <p className="font-medium text-red-600">Gagal memuat PDF</p>
                    <Button variant="link" onClick={() => window.open(normalizedUrl, "_blank")}>
                        Buka di Tab Baru
                    </Button>
                </div>
            ) : (
                <iframe
                    src={`${normalizedUrl}#toolbar=0`}
                    title="Preview PDF"
                    className="w-full h-full"
                    onLoad={() => setLoading(false)}
                    onError={() => setError(true)}
                />
            )}
        </div>
    );
}

