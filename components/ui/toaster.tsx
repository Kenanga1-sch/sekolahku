"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
    return (
        <SonnerToaster
            position="top-right"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group flex items-center gap-2 border bg-background text-foreground shadow-lg rounded-lg p-4",
                    description: "text-muted-foreground text-sm",
                    actionButton: "bg-primary text-primary-foreground",
                    cancelButton: "bg-muted text-muted-foreground",
                    success: "border-green-500/50 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300",
                    error: "border-red-500/50 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300",
                    warning: "border-amber-500/50 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300",
                    info: "border-blue-500/50 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
                },
            }}
            closeButton
            richColors
        />
    );
}
