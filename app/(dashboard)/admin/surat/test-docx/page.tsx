"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { generateDocument } from "@/lib/docx";
import { toast } from "sonner";
import { FileUp, Download, RefreshCw } from "lucide-react";

const INITIAL_DATA = {
    nomor_surat: "421.2/099-SD/I/2026",
    kepsek_nama: "Hj. RASINIH, S.Pd.SD",
    kepsek_nip: "19640101 198410 2 006",
    siswa_nama: "AHMAD DANI",
    siswa_kelas: "VI (Enam)",
    siswa_jk: "Laki-laki",
    siswa_nisn: "0123456789",
    siswa_tmp_lahir: "Indramayu",
    siswa_tgl_lahir: "12 Agustus 2014",
    siswa_wali: "BADRUDIN",
    tgl_surat: "27 Januari 2026"
};

export default function DocxTestPage() {
    const [file, setFile] = useState<File | null>(null);
    const [jsonData, setJsonData] = useState(JSON.stringify(INITIAL_DATA, null, 4));
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleGenerate = async () => {
        if (!file) {
            toast.error("Pilih file template .docx terlebih dahulu");
            return;
        }

        try {
            setLoading(true);
            const parsedData = JSON.parse(jsonData);
            
            // Create object URL for the uploaded file
            const fileUrl = URL.createObjectURL(file);
            
            await generateDocument(fileUrl, parsedData, `Output_${parsedData.siswa_nama || "Dokumen"}.docx`);
            
            toast.success("Dokumen berhasil digenerate!");
            
            // Clean up
            URL.revokeObjectURL(fileUrl);
        } catch (error) {
            console.error(error);
            toast.error("Gagal generate dokumen. Periksa format JSON atau Template.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-8 max-w-3xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Docx Generator Test</h1>
                <p className="text-muted-foreground">Uji coba generate dokumen Word dengan `docxtemplater`.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>1. Upload Template</CardTitle>
                    <CardDescription>Upload file .docx yang berisi placeholder variables (contoh: &#123;siswa_nama&#125;).</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="template">Template Word (.docx)</Label>
                        <Input id="template" type="file" accept=".docx" onChange={handleFileChange} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>2. Data JSON</CardTitle>
                    <CardDescription>Edit data di bawah ini untuk melihat hasil yang berbeda.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea 
                        className="font-mono h-[300px]" 
                        value={jsonData} 
                        onChange={(e) => setJsonData(e.target.value)} 
                    />
                    <div className="mt-2 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setJsonData(JSON.stringify(INITIAL_DATA, null, 4))}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Reset Default
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button size="lg" onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
                    {loading ? "Generating..." : (
                        <>
                            <Download className="mr-2 h-4 w-4" /> Generate & Download Word
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
