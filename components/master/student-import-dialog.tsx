
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileSpreadsheet, AlertTriangle, CheckCircle } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StudentImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function StudentImportDialog({ open, onOpenChange, onSuccess }: StudentImportDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        parseExcel(selectedFile);
    };

    const parseExcel = async (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: "binary" });
            const sheetName = workbook.SheetNames[0]; // First sheet
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            
            // Basic mapping if needed, or assume template headers match keys
            setPreviewData(jsonData);
        };
        reader.readAsBinaryString(file);
    };

    const handleImport = async () => {
        if (!previewData.length) return;

        setIsLoading(true);
        try {
            const res = await fetch("/api/master/students/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ students: previewData }),
            });
            
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || "Gagal import data");

            showSuccess(`Berhasil import ${result.count} data siswa!`);
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            showError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTemplate = () => {
        // Create dummy data
        const ws = XLSX.utils.json_to_sheet([
            { fullName: "Budi Santoso", nis: "1001", nisn: "0012345678", nik: "3201234567890001", gender: "L", className: "1A", status: "active" },
            { fullName: "Siti Aminah", nis: "1002", nisn: "0012345679", nik: "3201234567890002", gender: "P", className: "1B", status: "active" },
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
             <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Import Data Siswa Massal</DialogTitle>
                    <DialogDescription>
                        Import data siswa dari file Excel (.xlsx). Pastikan format sesuai template.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6">
                    <div className="flex items-center gap-4 border-2 border-dashed border-muted rounded-xl p-6 justify-center flex-col">
                        <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={downloadTemplate}>
                                Download Template
                            </Button>
                            <div className="relative">
                                <Button>Pilih File Excel</Button>
                                <Input 
                                    type="file" 
                                    accept=".xlsx, .xls"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                        {file && <p className="text-sm font-medium text-emerald-600">{file.name}</p>}
                    </div>

                    {previewData.length > 0 && (
                        <div className="space-y-2">
                             <div className="flex items-center justify-between">
                                <Label>Preview Data ({previewData.length} baris)</Label>
                                <span className="text-xs text-muted-foreground">Periksa data sebelum import</span>
                            </div>
                            <ScrollArea className="h-64 border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nama</TableHead>
                                            <TableHead>NISN</TableHead>
                                            <TableHead>NIK</TableHead>
                                            <TableHead>JK</TableHead>
                                            <TableHead>Kelas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.slice(0, 50).map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{row.fullName || row.nama || "-"}</TableCell>
                                                <TableCell>{row.nisn || "-"}</TableCell>
                                                <TableCell>{row.nik || "-"}</TableCell>
                                                <TableCell>{row.gender || row.jk || "-"}</TableCell>
                                                <TableCell>{row.className || row.kelas || "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button onClick={handleImport} disabled={!previewData.length || isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Import Sekarang
                    </Button>
                </DialogFooter>
             </DialogContent>
        </Dialog>
    );
}
