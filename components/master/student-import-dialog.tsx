
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/data-table";
import { Loader2, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { showSuccess, showError, showWarning } from "@/lib/toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { goPost } from "@/lib/api-client";

interface StudentImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

// Normalisasi nama kolom: lowercase, tanpa spasi/underscore
const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

// Kolom wajib di header file Excel (harus ada minimal fullName)
const REQUIRED_HEADERS = ["fullName"];

// Alias kolom (dinormalisasi) -> kunci kanonik yang dikirim ke backend
const COLUMN_ALIASES: Record<string, string> = {
    fullname: "fullName",
    nama: "fullName",
    namalengkap: "fullName",
    nis: "nis",
    nisn: "nisn",
    nik: "nik",
    kip: "kip",
    gender: "gender",
    jeniskelamin: "gender",
    jk: "gender",
    kelamin: "gender",
    classname: "className",
    kelas: "className",
    status: "status",
    birthplace: "birthPlace",
    tempatlahir: "birthPlace",
    birthdate: "birthDate",
    tanggallahir: "birthDate",
    religion: "religion",
    agama: "religion",
    address: "address",
    alamat: "address",
    parentname: "parentName",
    namaorangtua: "parentName",
    fathername: "fatherName",
    namaayah: "fatherName",
    fathernik: "fatherNik",
    nikayah: "fatherNik",
    mothername: "motherName",
    namaibu: "motherName",
    mothernik: "motherNik",
    nikibu: "motherNik",
    guardianname: "guardianName",
    namawali: "guardianName",
    guardiannik: "guardianNik",
    nikwali: "guardianNik",
    guardianjob: "guardianJob",
    pekerjaanwali: "guardianJob",
    parentphone: "parentPhone",
    nohp: "parentPhone",
    nohape: "parentPhone",
};

// Konversi nilai gender -> L/P. Konversi TUNGGAL (backend sudah handle L/P via prefix).
function toGenderCode(raw: unknown): string {
    const g = String(raw ?? "").trim().toUpperCase();
    if (!g) return "";
    // PRIA dicek sebelum prefix "P" (PRIA = laki-laki)
    if (g.startsWith("L") || g === "PRIA" || g === "M" || g === "MALE" || g === "COWOK") return "L";
    if (g.startsWith("P") || g.startsWith("W") || g === "F" || g === "FEMALE" || g === "CEWEK") return "P";
    return "";
}

// Serial Excel -> yyyy-mm-dd via komponen UTC, tanpa toISOString offset
function excelSerialToISO(serial: number): string {
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return d.getUTCFullYear() + "-" +
        String(d.getUTCMonth() + 1).padStart(2, "0") + "-" +
        String(d.getUTCDate()).padStart(2, "0");
}

export function StudentImportDialog({ open, onOpenChange, onSuccess }: StudentImportDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setImportErrors([]);
        parseExcel(selectedFile);
    };

    const parseExcel = async (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = e.target?.result;
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(data, { type: "binary", cellDates: true });
            const sheetName = workbook.SheetNames[0]; // First sheet
            const sheet = workbook.Sheets[sheetName];
            const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: "yyyy-mm-dd" });

            // Validasi header: minimal ada kolom nama lengkap (atau aliasnya, mis. "Nama Lengkap")
            const headerCanonicals = jsonData.length
                ? Object.keys(jsonData[0]).map(k => COLUMN_ALIASES[norm(k)] ?? norm(k))
                : [];
            const missing = REQUIRED_HEADERS.filter(h => !headerCanonicals.includes(h));
            if (missing.length) {
                setPreviewData([]);
                showError(
                    "Header kolom tidak valid",
                    `Kolom wajib tidak ditemukan: ${missing.join(", ")}. Download template untuk format yang benar.`
                );
                return;
            }

            // Remap kolom ke kunci kanonik + normalisasi nilai
            const mappedData = jsonData.map((row: any) => {
                const out: Record<string, any> = {};
                for (const [key, value] of Object.entries(row)) {
                    const canonical = COLUMN_ALIASES[norm(key)];
                    if (canonical) out[canonical] = value;
                }
                return out;
            });

            // Gender: konversi tunggal di frontend -> L/P; kumpulkan baris yang tidak dikenali
            const genderIssues: string[] = [];
            mappedData.forEach((row: any, i: number) => {
                if ("gender" in row) {
                    const code = toGenderCode(row.gender);
                    if (!code && String(row.gender ?? "").trim() !== "") {
                        genderIssues.push(String(i + 2)); // +2: baris Excel = header + 1-index
                    }
                    row.gender = code;
                }
            });
            if (genderIssues.length) {
                showWarning(
                    `Gender tidak dikenali (baris Excel: ${genderIssues.slice(0, 10).join(", ")}${genderIssues.length > 10 ? ", ..." : ""})`,
                    "Gunakan L/Laki-laki/Pria atau P/Perempuan/Wanita. Gender baris tersebut dikosongkan."
                );
            }

            // BirthDate: Date obj -> yyyy-mm-dd lokal; serial number -> via UTC (tanpa offset)
            mappedData.forEach((row: any) => {
                const raw = row.birthDate;
                if (!raw) return;
                if (raw instanceof Date) {
                    row.birthDate = raw.getFullYear() + "-" +
                        String(raw.getMonth() + 1).padStart(2, "0") + "-" +
                        String(raw.getDate()).padStart(2, "0");
                } else if (!isNaN(Number(raw))) {
                    row.birthDate = excelSerialToISO(Number(raw));
                }
            });

            setPreviewData(mappedData);
        };
        reader.readAsBinaryString(file);
    };

    const handleImport = async () => {
        if (!previewData.length) return;

        setIsLoading(true);
        try {
            const result: any = await goPost("/api/master/students/bulk", { students: previewData });

            // Backend mengembalikan { count, errors[] } — tampilkan keduanya
            const rowErrors: string[] = result.errors ?? [];
            setImportErrors(rowErrors);
            onSuccess();

            if (rowErrors.length === 0) {
                showSuccess(`Berhasil import ${result.count} data siswa!`);
                onOpenChange(false);
            } else if (result.count > 0) {
                showWarning(
                    `Import sebagian: ${result.count} berhasil, ${rowErrors.length} gagal`,
                    "Lihat daftar baris yang gagal di bawah sebelum menutup dialog."
                );
                // Dialog tetap terbuka agar user bisa lihat baris yang gagal
            } else {
                showError(
                    `Semua baris gagal diimport (${rowErrors.length} baris)`,
                    rowErrors.slice(0, 5).join("\n") + (rowErrors.length > 5 ? `\n...dan ${rowErrors.length - 5} lainnya (lihat detail di bawah)` : "")
                );
            }
        } catch (error: any) {
            showError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTemplate = async () => {
        const XLSX = await import("xlsx");
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
                            <div className="max-h-64 overflow-y-auto">
                                <DataTable
                                    data={previewData.slice(0, 50)}
                                    getRowId={(row, i) => String(row.nis ?? row.nisn ?? `row-${i}`)}
                                    columns={Object.keys(previewData[0]).map((col): Column<Record<string, unknown>> => ({
                                        key: col,
                                        header: col,
                                        card: col === "fullName"
                                            ? "title"
                                            : ["nis", "nisn", "gender", "className"].includes(col)
                                                ? "field"
                                                : "hidden",
                                        render: (row) => {
                                            const value = row[col];
                                            return value !== undefined && value !== null && value !== ""
                                                ? String(value)
                                                : "-";
                                        },
                                    }))}
                                />
                            </div>
                        </div>
                    )}
                    {importErrors.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-red-600">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="font-medium">Baris yang gagal ({importErrors.length})</span>
                            </div>
                            <ScrollArea className="h-24 max-h-32 border rounded p-2 bg-red-50">
                                {importErrors.map((err, i) => (
                                    <div key={i} className="text-sm text-red-700 py-0.5">{err}</div>
                                ))}
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
