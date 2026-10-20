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
                    success: "border-success/40 bg-success/10 text-success",
                    error: "border-destructive/40 bg-destructive/10 text-destructive-strong",
                    warning: "border-warning/40 bg-warning/10 text-warning",
                    info: "border-info/40 bg-info/10 text-info",
                },
            }}
            closeButton
        />
    );
}
