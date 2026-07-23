
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { goPost } from "@/lib/api-client";

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
            const workbook = XLSX.read(data, { type: "binary", cellDates: true });
            const sheetName = workbook.SheetNames[0]; // First sheet
            const sheet = workbook.Sheets[sheetName];
            let jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: "yyyy-mm-dd" });
            
            jsonData = jsonData.map((row: any) => {
                const mappedRow = { ...row };
                
                // Helper to find key dynamically
                const findKey = (keywords: string[]) => {
                    return Object.keys(mappedRow).find(k => {
                        const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return keywords.some(kw => normalized.includes(kw));
                    });
                };

                // Cek birthDate atau tanggal_lahir
                const dateKey = findKey(['birth', 'lahir']);
                if (dateKey && mappedRow[dateKey]) {
                    const dateStr = String(mappedRow[dateKey]);
                    let formattedDate = dateStr;
                    if (!isNaN(Number(dateStr))) {
                        const serial = Number(dateStr);
                        const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
                        if (!isNaN(dateObj.getTime())) {
                            formattedDate = dateObj.toISOString().split('T')[0];
                        }
                    } else {
                        const parsed = new Date(dateStr);
                        if (!isNaN(parsed.getTime())) {
                            formattedDate = parsed.toISOString().split('T')[0];
                        }
                    }
                    mappedRow.birthDate = formattedDate;
                }

                // Cek gender atau jk
                const genderKey = findKey(['gender', 'jk', 'kelamin']);
                if (genderKey && mappedRow[genderKey]) {
                    const g = String(mappedRow[genderKey]).trim().toUpperCase();
                    if (g === "L" || g.startsWith("LAKI")) {
                        mappedRow.gender = "Laki-laki";
                    } else if (g === "P" || g.startsWith("PEREMPUAN")) {
                        mappedRow.gender = "Perempuan";
                    } else {
                        mappedRow.gender = mappedRow[genderKey];
                    }
                }
                
                return mappedRow;
            });

            setPreviewData(jsonData);
        };
        reader.readAsBinaryString(file);
    };

    const handleImport = async () => {
        if (!previewData.length) return;

        setIsLoading(true);
        try {
            const result: any = await goPost("/api/master/students/bulk", { students: previewData });

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
            { 
                fullName: "Budi Santoso", 
                nis: "1001", 
                nisn: "0012345678", 
                nik: "3201234567890001", 
                gender: "L", 
                className: "1A", 
                status: "active",
                birthPlace: "Jakarta",
                birthDate: "2015-05-20",
                religion: "Islam",
                address: "Jl. Merdeka No. 1",
                fatherName: "Agus Santoso",
                fatherNik: "3201000000000001",
                motherName: "Siti Rahma",
                motherNik: "3201000000000002",
                guardianName: "",
                guardianNik: "",
                guardianJob: "",
                parentPhone: "081234567890"
            },
            { 
                fullName: "Siti Aminah", 
                nis: "1002", 
                nisn: "0012345679", 
                nik: "3201234567890002", 
                gender: "P", 
                className: "1B", 
                status: "active",
                birthPlace: "Bandung",
                birthDate: "2015-08-15",
                religion: "Islam",
                address: "Jl. Sudirman No. 5",
                fatherName: "Bambang",
                fatherNik: "3201000000000011",
                motherName: "Ratna",
                motherNik: "3201000000000012",
                guardianName: "",
                guardianNik: "",
                guardianJob: "",
                parentPhone: "081234567891"
            },
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
             <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                            <div className="border rounded-md overflow-hidden">
                                <ScrollArea className="h-64 max-w-[85vw] w-full whitespace-nowrap">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {previewData.length > 0 && Object.keys(previewData[0]).map((col) => (
                                                    <TableHead key={col} className="whitespace-nowrap px-4">{col}</TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.slice(0, 50).map((row, i) => (
                                                <TableRow key={i}>
                                                    {Object.keys(previewData[0]).map((col) => (
                                                        <TableCell key={col} className="whitespace-nowrap px-4">{row[col] !== undefined && row[col] !== null && row[col] !== "" ? String(row[col]) : "-"}</TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </div>
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
