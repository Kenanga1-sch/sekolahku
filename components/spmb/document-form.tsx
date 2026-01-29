"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Image as ImageIcon, File as FileIcon, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { DocumentFormValues } from "@/types/spmb";

interface DocumentFormProps {
  documents: DocumentFormValues | null;
  onDocumentsChange: (docs: DocumentFormValues) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
};

function getFileIcon(type: string) {
  if (type.startsWith("image/")) {
    return <ImageIcon className="h-5 w-5 text-blue-500" />;
  }
  if (type === "application/pdf") {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  return <FileIcon className="h-5 w-5 text-gray-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SingleUploadProps {
  label: string;
  description?: string;
  required?: boolean;
  value?: File;
  onChange: (file: File | undefined) => void;
  accept?: Record<string, string[]>;
}

function SingleUpload({ label, description, required, value, onChange, accept = ACCEPTED_TYPES }: SingleUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onChange(acceptedFiles[0]);
      }
    },
    [onChange]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept,
      maxSize: MAX_SIZE,
      maxFiles: 1,
      multiple: false,
    });

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {value && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Terupload</span>}
      </div>
      
      {description && <p className="text-[0.8rem] text-muted-foreground">{description}</p>}

      {!value ? (
        <>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors text-sm",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              {isDragActive ? (
                <p className="text-primary font-medium">Lepaskan file...</p>
              ) : (
                <p className="text-muted-foreground">
                  <span className="text-primary font-medium">Klik upload</span> atau drag file
                </p>
              )}
            </div>
          </div>
          {fileRejections.length > 0 && (
             <p className="text-destructive text-xs mt-1">
               {fileRejections[0].errors[0].message}
             </p>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
          <div className="flex items-center gap-3 overflow-hidden">
            {getFileIcon(value.type)}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{value.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(value.size)}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={removeFile}
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DocumentForm({
  documents,
  onDocumentsChange,
  activeTab,
  onTabChange,
}: DocumentFormProps) {
  
  // Safe accessor if documents is null
  const updateFile = (key: keyof DocumentFormValues, file: File | undefined) => {
    // If documents is null, create new object. If file is undefined, we might deleting.
    // However, DocumentFormValues expects required fields to be present eventually.
    // We can cast partial updates.
    
    // We need to permit partial object during editing
    const current = documents || {} as DocumentFormValues;
    
    // If file is undefined, we delete the key or set to undefined
    if (!file) {
      const next = { ...current };
      delete next[key];
      // If object becomes empty, should we set to null? Maybe keep empty object.
      // But type expects keys. Validation handles missing keys.
      onDocumentsChange(next as DocumentFormValues);
    } else {
      onDocumentsChange({
        ...current,
        [key]: file,
      } as DocumentFormValues);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
        <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          <strong>Perhatian:</strong> Pastikan dokumen yang diupload terbaca dengan jelas. 
          Format yang diterima: JPG, PNG, PDF. Maksimal 2MB per file.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="required">Dokumen Wajib</TabsTrigger>
          <TabsTrigger value="optional">Dokumen Pendukung</TabsTrigger>
        </TabsList>

        <TabsContent value="required" className="space-y-6 pt-6">
          <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-100 dark:border-amber-900 mb-6">
             <h3 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <FileIcon className="h-5 w-5" /> Dokumen Wajib
             </h3>
             <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
               Harus diisi untuk melanjutkan pendaftaran.
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SingleUpload
              label="Kartu Keluarga (KK)"
              required
              value={documents?.kk}
              onChange={(f) => updateFile("kk", f)}
            />
            
            <SingleUpload
              label="Akta Kelahiran"
              required
              value={documents?.akte}
              onChange={(f) => updateFile("akte", f)}
            />

            <SingleUpload
              label="KTP Ayah"
              required
              value={documents?.ktp_ayah}
              onChange={(f) => updateFile("ktp_ayah", f)}
            />

            <SingleUpload
              label="KTP Ibu"
              required
              value={documents?.ktp_ibu}
              onChange={(f) => updateFile("ktp_ibu", f)}
            />
          </div>
        </TabsContent>

        <TabsContent value="optional" className="space-y-6 pt-6">
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800 mb-6">
             <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FileText className="h-5 w-5" /> Dokumen Pendukung
             </h3>
             <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
               Boleh dikosongkan jika belum tersedia.
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SingleUpload
              label="Pas Foto"
              description="Latar belakang merah/biru (3x4)"
              value={documents?.pas_foto}
              onChange={(f) => updateFile("pas_foto", f)}
              accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] }}
            />

            <SingleUpload
              label="Ijazah / SKL"
              description="Jika belum ada, bisa menyusul"
              value={documents?.ijazah}
              onChange={(f) => updateFile("ijazah", f)}
            />

            <SingleUpload
              label="Kartu Indonesia Pintar (KIP)"
              description="Jika memiliki KIP"
              value={documents?.kip}
              onChange={(f) => updateFile("kip", f)}
            />

            <SingleUpload
              label="Kartu Perlindungan Sosial (KPS/PKH)"
              description="Jika memiliki KPS/PKH"
              value={documents?.kps}
              onChange={(f) => updateFile("kps", f)}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
