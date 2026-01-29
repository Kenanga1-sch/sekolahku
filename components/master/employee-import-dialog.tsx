"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileCode, CheckCircle, AlertCircle, Loader2, Download } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface EmployeeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EmployeeImportDialog({ open, onOpenChange, onSuccess }: EmployeeImportDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "processing">("upload");
  const [fileData, setFileData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
            showError("File kosong atau format salah");
            return;
        }
        
        // Basic validation of columns
        const row = data[0] as any;
        if (!row.Email || !row.NamaLengkap) {
             showError("Format header tidak sesuai. Gunakan Template.");
             return;
        }

        setFileData(data);
        setStep("preview");
      } catch (error) {
        showError("Gagal membaca file");
        console.error(error);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const headers = [
      { 
        "NamaLengkap": "Budi Santoso", 
        "Email": "budi@sekolahku.id", 
        "Role": "guru", 
        "NIP": "199001012020011001", 
        "NUPTK": "1234567890123456",
        "NIK": "3201010101900001",
        "StatusKepegawaian": "PNS",
        "JenisPTK": "Guru Kelas",
        "NoHP": "08123456789",
        "TanggalMasuk": "2020-01-01"
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_GTK.xlsx");
  };

  const handleProcess = async () => {
    setIsLoading(true);
    setStep("processing");
    try {
        const res = await fetch("/api/master/employees/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: fileData }),
        });

        const json = await res.json();
        
        if (!res.ok) throw new Error(json.error || "Gagal import");

        if (json.errors && json.errors.length > 0) {
            setValidationErrors(json.errors);
            showError(`${json.successCount} berhasil, ${json.errors.length} gagal.`);
        } else {
            showSuccess(`Berhasil import ${json.successCount} data pegawai.`);
            onSuccess();
            onOpenChange(false);
            setStep("upload");
            setFileData([]);
        }
    } catch (error: any) {
        showError(error.message);
        setStep("preview"); // Go back to allow retry
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Import Data GTK (Excel/CSV)</DialogTitle>
          <DialogDescription>
            Import banyak data sekaligus. Pastikan format sesuai template.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/50 gap-4">
                <div className="p-4 bg-primary/10 rounded-full">
                    <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                    <p className="font-semibold">Upload file .xlsx atau .csv</p>
                    <p className="text-sm text-muted-foreground">Drag & drop atau klik untuk browse</p>
                </div>
                <Input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
                <div className="flex gap-2">
                    <Button variant="outline" onClick={downloadTemplate}>
                        <Download className="mr-2 h-4 w-4" /> Download Template
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()}>
                        Pilih File
                    </Button>
                </div>
            </div>
        )}

        {step === "preview" && (
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div className="text-sm">
                        <span className="font-semibold">{fileData.length}</span> data siap diproses.
                    </div>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => {
                        setFileData([]);
                        setStep("upload");
                    }}>
                        Batal
                    </Button>
                </div>
                
                <ScrollArea className="h-[300px] border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>No</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fileData.map((row, i) => (
                                <TableRow key={i}>
                                    <TableCell>{i + 1}</TableCell>
                                    <TableCell>{row.NamaLengkap}</TableCell>
                                    <TableCell>{row.Email}</TableCell>
                                    <TableCell>{row.Role}</TableCell>
                                    <TableCell>{row.StatusKepegawaian}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
             </div>
        )}

        {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                 {isLoading ? (
                    <>
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        <p>Memproses data, mohon tunggu...</p>
                    </>
                 ) : (
                    validationErrors.length > 0 && (
                        <div className="w-full text-left space-y-4">
                            <div className="flex items-center gap-2 text-amber-600 font-semibold">
                                <AlertCircle className="w-5 h-5" />
                                <span>Import Selesai dengan Catatan</span>
                            </div>
                            <ScrollArea className="h-[200px] w-full border rounded p-2 bg-amber-50">
                                <ul className="list-disc pl-4 text-sm space-y-1">
                                    {validationErrors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </ScrollArea>
                        </div>
                    )
                 )}
            </div>
        )}

        <DialogFooter>
             {step === "preview" && (
                 <Button onClick={handleProcess} disabled={isLoading}>
                    Proses Import
                 </Button>
             )}
             { (step === "processing" && !isLoading) && (
                 <Button onClick={() => { onSuccess(); onOpenChange(false); setStep("upload"); }}>
                    Tutup
                 </Button>
             )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
