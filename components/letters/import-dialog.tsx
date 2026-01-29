"use client";

import { useState, useRef } from "react";
import { 
  Upload, 
  FileText,
  Download,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LETTER_VARIABLES } from "@/lib/config/letter-variables";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import mammoth from "mammoth";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"upload" | "guide">("upload");
  
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [paperSize, setPaperSize] = useState("A4");
  const [orientation, setOrientation] = useState("portrait");
  const [extractedVars, setExtractedVars] = useState<string[]>([]);
  
  const [importing, setImporting] = useState(false);

  // --- Actions ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.split('.').pop()?.toLowerCase();
      if (ext !== 'docx') {
          toast.error("Hanya file .docx yang didukung.");
          return;
      }
      setFile(selected);
      setName(selected.name.replace('.docx', ''));

      // Extract variables silently
      try {
          const arrayBuffer = await selected.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          const text = result.value;
          const regex = /{{(.*?)}}/g;
          const found = text.match(regex) || [];
          const clean = [...new Set(found.map(v => v.replace(/{{|}}/g, '').trim()))];
          setExtractedVars(clean);
          console.log("Extracted variables:", clean);
      } catch (err) {
          console.error("Failed to parse docx text:", err);
      }
    }
  };

  const handleRemoveFile = () => {
      setFile(null);
      setName("");
      setExtractedVars([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!file || !name) {
        toast.error("Mohon lengkapi data template");
        return;
    }

    setImporting(true);
    try {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("category", category);
        formData.append("paperSize", paperSize);
        formData.append("orientation", orientation);
        
        // Store extracted variables as JSON string in content
        // This is a workaround since we don't need HTML content anymore
        formData.append("content", JSON.stringify(extractedVars));
        
        formData.append("file", file);
        formData.append("type", "UPLOAD");

        const res = await fetch("/api/letters/templates", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) throw new Error("Gagal menyimpan import");

        toast.success("Template berhasil diupload!");
        onOpenChange(false);
        router.refresh();
        
        resetState();
    } catch (error) {
        console.error(error);
        toast.error("Terjadi kesalahan saat import");
    } finally {
        setImporting(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setName("");
    setExtractedVars([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
        
        {/* Header with Tabs */}
        <div className="p-0 border-b bg-zinc-50/50 dark:bg-zinc-900/50">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
                <div className="flex items-center justify-between px-6 py-4">
                   <DialogTitle>Import Template Baru</DialogTitle>
                   <TabsList>
                      <TabsTrigger value="upload">Upload Docx</TabsTrigger>
                      <TabsTrigger value="guide">Kamus Variabel</TabsTrigger>
                   </TabsList>
                </div>
            </Tabs>
        </div>

        <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 p-6">
            {tab === "guide" && (
                <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20 mb-6">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100">Panduan Variabel</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Gunakan kode variabel di bawah ini di dalam file Word Anda. <br/>
                            Contoh: <code>{"{{siswa_nama}}"}</code> akan diganti dengan nama siswa.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(LETTER_VARIABLES).map(([category, items]) => (
                            <div key={category} className="space-y-2">
                                <h4 className="text-sm font-medium text-muted-foreground">{category}</h4>
                                <ul className="space-y-1">
                                    {items.map(item => (
                                        <li key={item.value} className="text-xs flex flex-col p-2 bg-zinc-50 dark:bg-zinc-900 rounded border">
                                            <code className="font-mono text-blue-600 font-bold">{item.value}</code>
                                            <span className="text-muted-foreground">{item.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === "upload" && (
                <div className="h-full flex flex-col max-w-lg mx-auto justify-center">
                    {!file ? (
                        <div 
                            className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="h-20 w-20 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mb-6">
                                <Upload className="h-10 w-10" />
                            </div>
                            <h3 className="font-semibold text-xl mb-2">Upload File Word</h3>
                            <p className="text-sm text-muted-foreground">
                                Klik untuk memilih file <strong>.docx</strong>
                            </p>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".docx"
                                onChange={handleFileChange}
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-900 relative">
                                <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h4 className="font-medium truncate" title={file.name}>{file.name}</h4>
                                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="shrink-0 hover:bg-red-50 hover:text-red-500">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nama Template</Label>
                                    <Input 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)} 
                                        placeholder="Contoh: Surat Keterangan Baik"
                                    />
                                </div>
                                
                                {/* Simple Configs could go here if needed, keeping defaults for now */}
                            </div>

                            <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg" onClick={handleImport} disabled={importing}>
                                {importing ? "Mengupload..." : "Simpan Template"}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
