"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import React from "react";

export interface CreateClassificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    createCode: string;
    setCreateCode: (v: string) => void;
    createName: string;
    setCreateName: (v: string) => void;
    createDescription: string;
    setCreateDescription: (v: string) => void;
    isCreating: boolean;
    onSubmit: (e: React.FormEvent) => void;
}

export function CreateClassificationDialog({
    open,
    onOpenChange,
    createCode,
    setCreateCode,
    createName,
    setCreateName,
    createDescription,
    setCreateDescription,
    isCreating,
    onSubmit,
}: CreateClassificationDialogProps) {
    return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Tambah Klasifikasi Dinas</DialogTitle>
                        <DialogDescription>
                            Buat kode klasifikasi surat baru. Pastikan kode klasifikasi unik.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={onSubmit} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="create_code" className="text-sm font-semibold">Kode Klasifikasi</Label>
                            <Input
                                id="create_code"
                                placeholder="Contoh: 400.3.5.02 atau 421.1"
                                value={createCode}
                                onChange={(e) => setCreateCode(e.target.value)}
                                required
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create_name" className="text-sm font-semibold">Nama Kategori / Tujuan Dinas</Label>
                            <Input
                                id="create_name"
                                placeholder="Contoh: Kepegawaian (PTK) atau Kurikulum"
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create_desc" className="text-sm font-semibold">Deskripsi / Penjelasan Fungsi Kode</Label>
                            <Textarea
                                id="create_desc"
                                placeholder="Tuliskan penjelasan mengenai fungsi kode klasifikasi ini untuk apa saja..."
                                value={createDescription}
                                onChange={(e) => setCreateDescription(e.target.value)}
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isCreating} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                                {isCreating ? "Menyimpan..." : "Tambah Klasifikasi"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
    );
}
