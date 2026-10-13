"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";

export interface DeleteClassificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classToDelete: { code?: string; name?: string } | null;
    isDeleting: boolean;
    onConfirm: () => void;
}

export function DeleteClassificationDialog({
    open,
    onOpenChange,
    classToDelete,
    isDeleting,
    onConfirm,
}: DeleteClassificationDialogProps) {
    return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Hapus Klasifikasi?
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            Apakah Anda yakin ingin menghapus kode klasifikasi <strong className="font-mono text-slate-800 dark:text-white">{classToDelete?.code}</strong> ({classToDelete?.name})?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3 rounded-lg text-xs text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
                        <p className="font-bold">⚠️ Perhatian Pengarsipan:</p>
                        <p>
                            Jika kode klasifikasi ini sudah digunakan pada surat masuk atau surat keluar, sistem akan **menonaktifkannya secara otomatis** (soft delete) agar arsip lama tidak terputus relasinya. Jika belum digunakan, data akan dihapus permanen.
                        </p>
                    </div>
                    <DialogFooter className="pt-4 gap-2">
                        <Button type="button" variant="outline" onClick={() => { onOpenChange(false); }}>
                            Batal
                        </Button>
                        <Button 
                            type="button" 
                            disabled={isDeleting} 
                            onClick={onConfirm} 
                            className="bg-red-600 hover:bg-red-700 text-white font-medium"
                        >
                            {isDeleting ? "Menghapus..." : "Ya, Hapus"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
    );
}
