"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Image as ImageIcon, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface DocumentFormProps {
  documents: File[];
  onDocumentsChange: (files: File[]) => void;
}

const MAX_FILES = 5;
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
  return <File className="h-5 w-5 text-gray-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentForm({
  documents,
  onDocumentsChange,
}: DocumentFormProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = [...documents, ...acceptedFiles].slice(0, MAX_FILES);
      onDocumentsChange(newFiles);
    },
    [documents, onDocumentsChange]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_TYPES,
      maxSize: MAX_SIZE,
      maxFiles: MAX_FILES - documents.length,
    });

  const removeFile = (index: number) => {
    const newFiles = documents.filter((_, i) => i !== index);
    onDocumentsChange(newFiles);
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <Upload className="h-4 w-4" />
        <AlertDescription>
          <strong>Dokumen yang diperlukan:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Kartu Keluarga (KK)</li>
            <li>Akta Kelahiran</li>
            <li>Pas Foto terbaru</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Format: JPG, PNG, PDF. Maksimal 2MB per file.
          </p>
        </AlertDescription>
      </Alert>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          documents.length >= MAX_FILES && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} disabled={documents.length >= MAX_FILES} />
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-primary">Lepaskan file di sini...</p>
        ) : documents.length >= MAX_FILES ? (
          <p className="text-muted-foreground">Maksimal {MAX_FILES} file tercapai</p>
        ) : (
          <div>
            <p className="font-medium">
              Drag & drop file di sini, atau{" "}
              <span className="text-primary">browse</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {MAX_FILES - documents.length} slot tersisa
            </p>
          </div>
        )}
      </div>

      {/* File Rejections */}
      {fileRejections.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {fileRejections.map(({ file, errors }) => (
              <div key={file.name}>
                <strong>{file.name}:</strong>{" "}
                {errors.map((e) => e.message).join(", ")}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Uploaded Files List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">File yang diupload:</h4>
          <div className="space-y-2">
            {documents.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(file.type)}
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Message */}
      {documents.length === 0 && (
        <p className="text-sm text-amber-600">
          ⚠️ Upload minimal 1 dokumen untuk melanjutkan
        </p>
      )}
    </div>
  );
}
