"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import React from "react";

export interface EditClassificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedClass: { code?: string } | null;
    editCode: string;
    setEditCode: (v: string) => void;
    editName: string;
    setEditName: (v: string) => void;
    editDescription: string;
    setEditDescription: (v: string) => void;
    editIsActive: boolean;
    setEditIsActive: (v: boolean) => void;
    isUpdating: boolean;
    onSubmit: (e: React.FormEvent) => void;
}

export function EditClassificationDialog({
    open,
    onOpenChange,
    selectedClass,
    editCode,
    setEditCode,
    editName,
    setEditName,
    editDescription,
    setEditDescription,
    editIsActive,
    setEditIsActive,
    isUpdating,
    onSubmit,
}: EditClassificationDialogProps) {
    return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Edit Klasifikasi Dinas</DialogTitle>
                        <DialogDescription>
                            Perbarui detail atau status untuk kode klasifikasi <code className="font-mono bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-blue-600 font-bold">{selectedClass?.code}</code>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={onSubmit} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit_code" className="text-sm font-semibold">Kode Klasifikasi</Label>
                            <Input
                                id="edit_code"
                                value={editCode}
                                onChange={(e) => setEditCode(e.target.value)}
                                required
                                className="font-mono bg-slate-50 dark:bg-zinc-950"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_name" className="text-sm font-semibold">Nama Kategori / Tujuan Dinas</Label>
                            <Input
                                id="edit_name"
                                placeholder="Contoh: Kepegawaian (PTK)"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_desc" className="text-sm font-semibold">Deskripsi / Penjelasan Fungsi Kode</Label>
                            <Textarea
                                id="edit_desc"
                                placeholder="Tuliskan penjelasan mengenai fungsi kode klasifikasi ini untuk apa saja..."
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950/50">
                            <div className="space-y-0.5">
                                <Label htmlFor="edit_active" className="text-sm font-semibold">Status Aktif</Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Klasifikasi nonaktif tidak akan muncul saat membuat surat baru.
                                </p>
                            </div>
                            <Switch
                                id="edit_active"
                                checked={editIsActive}
                                onCheckedChange={setEditIsActive}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); }}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                                {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
    );
}
