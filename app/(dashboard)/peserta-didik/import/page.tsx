"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; name: string; error: string }[];
  message: string;
}

export default function ImportSiswaPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
      ];
      if (!validTypes.includes(selectedFile.type) && 
          !selectedFile.name.endsWith(".xlsx") && 
          !selectedFile.name.endsWith(".xls") &&
          !selectedFile.name.endsWith(".csv")) {
        toast.error("Format file tidak valid. Gunakan file Excel (.xlsx, .xls) atau CSV");
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/students/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Gagal mengimport data");
        return;
      }

      setResult(data);
      
      if (data.success > 0 && data.failed === 0) {
        toast.success(data.message);
      } else if (data.success > 0) {
        toast.warning(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat mengimport");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Create template data
    const templateData = [
      {
        "NISN": "0012345678",
        "NIS": "12345",
        "Nama Lengkap": "Contoh Nama Siswa",
        "Jenis Kelamin": "L",
        "Kelas": "1A",
        "Tempat Lahir": "Jakarta",
        "Tanggal Lahir": "2018-01-15",
        "Alamat": "Jl. Contoh No. 123",
        "Nama Orang Tua": "Nama Orang Tua",
        "No HP Orang Tua": "08123456789",
      },
    ];

    // Dynamic import xlsx
    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      
      // Set column widths
      ws["!cols"] = [
        { wch: 12 }, // NISN
        { wch: 10 }, // NIS
        { wch: 25 }, // Nama
        { wch: 12 }, // JK
        { wch: 8 },  // Kelas
        { wch: 15 }, // TTL
        { wch: 12 }, // TGL
        { wch: 30 }, // Alamat
        { wch: 20 }, // Ortu
        { wch: 15 }, // HP
      ];
      
      XLSX.writeFile(wb, "template_import_siswa.xlsx");
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Peserta Didik</h1>
          <p className="text-muted-foreground">
            Import data siswa dari file Excel atau CSV
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload File
            </CardTitle>
            <CardDescription>
              Pilih file Excel (.xlsx) atau CSV untuk mengimport data siswa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Klik atau drag file ke sini</p>
                  <p className="text-sm text-muted-foreground">
                    Format: .xlsx, .xls, .csv
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleImport}
                disabled={!file || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Mengimport...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Panduan Import</CardTitle>
            <CardDescription>
              Format kolom yang didukung
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="font-medium">Kolom</div>
                <div className="font-medium">Keterangan</div>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">NISN</code>
                <span className="text-muted-foreground">Opsional, harus unik</span>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">NIS</code>
                <span className="text-muted-foreground">Opsional, harus unik</span>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Nama Lengkap</code>
                <span className="text-muted-foreground">
                  <Badge variant="destructive" className="text-[10px]">Wajib</Badge>
                </span>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Jenis Kelamin</code>
                <span className="text-muted-foreground">L / P</span>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Kelas</code>
                <span className="text-muted-foreground">1A, 2B, dst</span>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Tempat Lahir</code>
                <span className="text-muted-foreground">Opsional</span>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Tanggal Lahir</code>
                <span className="text-muted-foreground">YYYY-MM-DD</span>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Alamat</code>
                <span className="text-muted-foreground">Opsional</span>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Nama Orang Tua</code>
                <span className="text-muted-foreground">Opsional</span>
                
                <code className="text-xs bg-muted px-1 py-0.5 rounded">No HP Orang Tua</code>
                <span className="text-muted-foreground">Opsional</span>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Catatan</AlertTitle>
              <AlertDescription>
                QR code akan dibuat otomatis untuk setiap siswa yang berhasil diimport.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : result.success > 0 ? (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Hasil Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-700">
                  {result.success} Berhasil
                </Badge>
              </div>
              {result.failed > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">
                    {result.failed} Gagal
                  </Badge>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Baris</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.slice(0, 20).map((err, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{err.row}</TableCell>
                        <TableCell>{err.name}</TableCell>
                        <TableCell className="text-red-600">{err.error}</TableCell>
                      </TableRow>
                    ))}
                    {result.errors.length > 20 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          ... dan {result.errors.length - 20} error lainnya
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {result.success > 0 && (
              <Button onClick={() => router.push("/peserta-didik")} variant="outline">
                Lihat Daftar Siswa
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
