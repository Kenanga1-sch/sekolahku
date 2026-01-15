"use client";

import { ReactNode } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ==========================================
// Types
// ==========================================

export interface FormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    trigger?: ReactNode;
    submitLabel?: string;
    onSubmit: (e: React.FormEvent) => void;
    loading?: boolean;
    children: ReactNode;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

// ==========================================
// FormDialog Component
// ==========================================

export function FormDialog({
    open,
    onOpenChange,
    title,
    description,
    trigger,
    submitLabel = "Simpan",
    onSubmit,
    loading = false,
    children,
    maxWidth = "md",
}: FormDialogProps) {
    const maxWidthClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className={maxWidthClasses[maxWidth]}>
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        {description && (
                            <DialogDescription>{description}</DialogDescription>
                        )}
                    </DialogHeader>
                    <div className="py-4">{children}</div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Menyimpan..." : submitLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
