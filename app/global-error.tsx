"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log to Sentry
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/5 p-4">
                    <div className="text-center max-w-lg">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 text-red-600 mb-6">
                            <AlertTriangle className="h-10 w-10" />
                        </div>

                        <h1 className="text-3xl font-bold mb-4">Terjadi Kesalahan</h1>

                        <p className="text-muted-foreground mb-6">
                            Maaf, terjadi kesalahan yang tidak terduga. Tim kami telah diberitahu dan sedang memperbaikinya.
                        </p>

                        {error.digest && (
                            <p className="text-xs text-muted-foreground mb-6 font-mono">
                                Error ID: {error.digest}
                            </p>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button onClick={reset} className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Coba Lagi
                            </Button>
                            <Link href="/">
                                <Button variant="outline" className="gap-2">
                                    <Home className="h-4 w-4" />
                                    Ke Beranda
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
