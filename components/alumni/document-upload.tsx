"use client";

import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface DocumentType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  maxFileSizeMb: number | null;
}

interface DocumentUploadProps {
  alumniId: string;
  onUploadComplete?: () => void;
}

export function DocumentUpload({ alumniId, onUploadComplete }: DocumentUploadProps) {
  const [open, setOpen] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const response = await fetch("/api/alumni/document-types");
        const data = await response.json();
        setDocumentTypes(data);
      } catch (err) {
        console.error("Error fetching document types:", err);
      }
    };

    if (open) {
      fetchDocumentTypes();
    }
  }, [open]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
  });

  const handleUpload = async () => {
    if (!file || !selectedType) {
      setError("Pilih jenis dokumen dan file terlebih dahulu");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentTypeId", selectedType);
      if (documentNumber) formData.append("documentNumber", documentNumber);
      if (issueDate) formData.append("issueDate", issueDate);
      if (notes) formData.append("notes", notes);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`/api/alumni/${alumniId}/documents`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Upload failed");
      }

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        resetForm();
        onUploadComplete?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengupload dokumen");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setSelectedType("");
    setDocumentNumber("");
    setIssueDate("");
    setNotes("");
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
  };

  const removeFile = () => {
    setFile(null);
  };

  const selectedTypeData = documentTypes.find((t) => t.id === selectedType);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="h-4 w-4 mr-1" />
          Upload Dokumen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Dokumen Alumni</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Dokumen berhasil diupload!</AlertDescription>
            </Alert>
          )}

          {/* Document Type Selection */}
          <div className="space-y-2">
            <Label>Jenis Dokumen *</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis dokumen" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTypeData?.description && (
              <p className="text-xs text-muted-foreground">
                {selectedTypeData.description}
              </p>
            )}
          </div>

          {/* File Drop Zone */}
          <div className="space-y-2">
            <Label>File *</Label>
            {!file ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-primary"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {isDragActive
                    ? "Lepaskan file di sini..."
                    : "Drag & drop atau klik untuk memilih file"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPG, PNG (Maks. {selectedTypeData?.maxFileSizeMb || 5}MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeFile}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Document Number */}
          <div className="space-y-2">
            <Label htmlFor="documentNumber">Nomor Dokumen</Label>
            <Input
              id="documentNumber"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Contoh: nomor ijazah"
            />
          </div>

          {/* Issue Date */}
          <div className="space-y-2">
            <Label htmlFor="issueDate">Tanggal Terbit</Label>
            <Input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              rows={2}
            />
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-xs text-center text-muted-foreground">
                Mengupload... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={uploading}
            >
              Batal
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !file || !selectedType}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
