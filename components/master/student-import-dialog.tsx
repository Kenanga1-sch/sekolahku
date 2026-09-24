
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/data-table";
import { Loader2, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { showSuccess, showError, showWarning } from "@/lib/toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { goPost, goGet } from "@/lib/api-client";

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
    const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importSummary, setImportSummary] = useState<{ inserted: number; updated: number } | null>(null);
    const [preserveStatus, setPreserveStatus] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

    // Muat daftar kelas nyata: dipakai untuk contoh template & validasi preview.
    useEffect(() => {
        if (!open) return;
        goGet("/api/academic/classes")
            .then((data: any) => setClasses(Array.isArray(data) ? data : []))
            .catch(() => setClasses([]));
    }, [open]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setImportErrors([]);
        setPreviewWarnings([]);
        setImportSummary(null);
        parseExcel(selectedFile);
    };

    const parseExcel = async (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = e.target?.result;
            const XLSX = await import("@e965/xlsx");
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

            // Peringatan dini: baris tanpa NISN/NIS berisiko terduplikasi karena
            // pencocokan siswa existing memakai NISN/NIS (lalu NIK).
            const noIdentity: string[] = [];
            const noClass: string[] = [];
            const unknownClass: string[] = [];
            const validClassNames = new Set(classes.map((c) => c.name.trim().toLowerCase()));
            mappedData.forEach((row: any, i: number) => {
                const hasId = [row.nisn, row.nis].some((v) => String(v ?? "").trim() !== "");
                if (!hasId) noIdentity.push(String(i + 2));
                const cls = String(row.className ?? "").trim();
                if (cls === "") {
                    noClass.push(String(i + 2));
                } else if (validClassNames.size > 0 && !validClassNames.has(cls.toLowerCase())) {
                    // Hanya validasi bila daftar kelas berhasil dimuat.
                    unknownClass.push(String(i + 2));
                }
            });
            const warns: string[] = [];
            if (noIdentity.length) {
                warns.push(
                    `${noIdentity.length} baris tanpa NISN/NIS (baris Excel: ${noIdentity.slice(0, 10).join(", ")}${noIdentity.length > 10 ? ", ..." : ""}) — baris ini berisiko dibuat ganda.`
                );
            }
            if (noClass.length) {
                warns.push(
                    `${noClass.length} baris tanpa kolom kelas — siswa tidak akan masuk kelas mana pun.`
                );
            }
            if (unknownClass.length) {
                warns.push(
                    `${unknownClass.length} baris memakai kelas yang tidak terdaftar (baris Excel: ${unknownClass.slice(0, 10).join(", ")}${unknownClass.length > 10 ? ", ..." : ""}) — kelas harus sama persis dengan daftar kelas. Baris ini akan GAGAL saat import.`
                );
            }
            setPreviewWarnings(warns);

            setPreviewData(mappedData);
        };
        reader.readAsBinaryString(file);
    };

    const handleImport = async () => {
        if (!previewData.length) return;

        setIsLoading(true);
        try {
            const result: any = await goPost("/api/master/students/bulk", {
                students: previewData,
                updateStatus: !preserveStatus,
            });

            // Backend mengembalikan { count, inserted, updated, errors[] }
            const rowErrors: string[] = result.errors ?? [];
            const inserted: number = result.inserted ?? result.count ?? 0;
            const updated: number = result.updated ?? 0;
            setImportErrors(rowErrors);
            setImportSummary({ inserted, updated });
            onSuccess();

            const total = inserted + updated;
            if (rowErrors.length === 0) {
                showSuccess(
                    `Import berhasil: ${inserted} siswa baru, ${updated} siswa diperbarui.`
                );
                onOpenChange(false);
            } else if (total > 0) {
                showWarning(
                    `Import sebagian: ${inserted} baru + ${updated} diperbarui berhasil, ${rowErrors.length} gagal`,
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
        const XLSX = await import("@e965/xlsx");

        // Contoh kelas memakai kelas NYATA dari master (agar tidak langsung
        // ditolak oleh validasi kelas). Bila daftar kelas gagal dimuat,
        // biarkan kosong dan user wajib mengisi sesuai daftar kelas.
        const class1 = classes[0]?.name ?? "";
        const class2 = classes[1]?.name ?? classes[0]?.name ?? "";

        // Header & contoh memakai istilah Indonesia (semua dikenali oleh
        // pemetaan alias di parseExcel). Kolom: Nama wajib; sisanya opsional.
        const ws = XLSX.utils.json_to_sheet([
            {
                "Nama": "Budi Santoso",
                "NIS": "1001",
                "NISN": "0012345678",
                "NIK": "3201234567890001",
                "KIP": "",
                "Jenis Kelamin": "L",
                "Kelas": class1,
                "Status": "active",
                "Tempat Lahir": "Jakarta",
                "Tanggal Lahir": "2015-05-20",
                "Agama": "Islam",
                "Alamat": "Jl. Merdeka No. 1",
                "Nama Orang Tua": "Agus Santoso",
                "Nama Ayah": "Agus Santoso",
                "NIK Ayah": "3201000000000001",
                "Nama Ibu": "Siti Rahma",
                "NIK Ibu": "3201000000000002",
                "Nama Wali": "",
                "NIK Wali": "",
                "Pekerjaan Wali": "",
                "No HP": "081234567890",
            },
            {
                "Nama": "Siti Aminah",
                "NIS": "1002",
                "NISN": "0012345679",
                "NIK": "3201234567890002",
                "KIP": "",
                "Jenis Kelamin": "P",
                "Kelas": class2,
                "Status": "active",
                "Tempat Lahir": "Bandung",
                "Tanggal Lahir": "2015-08-15",
                "Agama": "Islam",
                "Alamat": "Jl. Sudirman No. 5",
                "Nama Orang Tua": "Bambang",
                "Nama Ayah": "Bambang",
                "NIK Ayah": "3201000000000011",
                "Nama Ibu": "Ratna",
                "NIK Ibu": "3201000000000012",
                "Nama Wali": "",
                "NIK Wali": "",
                "Pekerjaan Wali": "",
                "No HP": "081234567891",
            },
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");

        // Lembar keterangan: bantu operator memahami aturan pengisian.
        const classList = classes.length ? classes.map((c) => c.name).join(", ") : "(muat daftar kelas dari menu Akademik)";
        const noteRows = [
            ["Petunjuk Pengisian Template Import Siswa"],
            [""],
            ["- Kolom \"Nama\" WAJIB diisi. Kolom lain opsional."],
            ["- Kolom \"Kelas\" harus sama persis dengan salah satu nama kelas berikut:"],
            ["  " + classList],
            ["- Kolom \"Jenis Kelamin\": isi L (Laki-laki) atau P (Perempuan)."],
            ["- Kolom \"Tanggal Lahir\": format YYYY-MM-DD (contoh: 2015-05-20)."],
            ["- Kolom \"Status\": active / inactive (boleh dikosongkan)."],
            ["- Siswa yang sudah ada (dicocokkan via NISN/NIS/NIK) akan DIPERBARUI."],
            ["- Baris dengan nama kosong atau kelas tidak dikenal akan dilewati & dilaporkan."],
            [""],
            ["Hapus dua baris contoh (Budi Santoso & Siti Aminah) sebelum mengisi data asli."],
        ];
        const noteSheet = XLSX.utils.aoa_to_sheet(noteRows);
        XLSX.utils.book_append_sheet(wb, noteSheet, "Petunjuk");

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
                        {classes.length > 0 && (
                            <p className="text-xs text-muted-foreground text-center max-w-lg">
                                Kelas yang tersedia: <b>{classes.map((c) => c.name).join(", ")}</b>. Kolom Kelas harus
                                sama persis dengan salah satu nama di atas.
                            </p>
                        )}
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
                        <Checkbox
                            id="preserve-status"
                            checked={preserveStatus}
                            onCheckedChange={(v) => setPreserveStatus(v === true)}
                        />
                        <div className="grid gap-1">
                            <Label htmlFor="preserve-status" className="cursor-pointer">
                                Jangan ubah status siswa yang sudah ada
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Bila dicentang, siswa yang sudah ada dan tidak mencantumkan kolom status tidak akan
                                diubah status keaktifannya. Berguna agar siswa non-aktif tidak ikut aktif kembali.
                            </p>
                        </div>
                    </div>

                    {previewWarnings.length > 0 && (
                        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            {previewWarnings.map((w, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
                                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>{w}</span>
                                </div>
                            ))}
                        </div>
                    )}

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
                    {importSummary && (
                        <div className="text-sm rounded-lg border p-3 bg-emerald-50 text-emerald-800">
                            Hasil import: <b>{importSummary.inserted}</b> siswa baru, <b>{importSummary.updated}</b> siswa diperbarui.
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
