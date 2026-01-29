"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  X,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface DocumentViewerProps {
  document: {
    id: string;
    fileName: string;
    filePath: string;
    mimeType: string | null;
    documentNumber: string | null;
    issueDate: string | null;
    verificationStatus: string;
    notes: string | null;
    documentType: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
  open: boolean;
  onClose: () => void;
}

const statusConfig = {
  pending: { label: "Menunggu Verifikasi", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  verified: { label: "Terverifikasi", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  rejected: { label: "Ditolak", icon: XCircle, color: "bg-red-100 text-red-700" },
};

export function DocumentViewer({ document, open, onClose }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const isImage = document.mimeType?.startsWith("image/");
  const isPdf = document.mimeType === "application/pdf";
  
  const status = statusConfig[document.verificationStatus as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  const handleDownload = () => {
    window.open(`/api/alumni/documents/${document.id}/download`, "_blank");
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isImage ? (
                <ImageIcon className="h-5 w-5 text-blue-600" />
              ) : (
                <FileText className="h-5 w-5 text-red-600" />
              )}
              <div>
                <DialogTitle className="text-base">
                  {document.documentType?.name || document.fileName}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">{document.fileName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={status.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Document Info */}
        <div className="px-4 py-2 border-b bg-muted/10 flex flex-wrap gap-4 text-sm">
          {document.documentNumber && (
            <div>
              <span className="text-muted-foreground">No. Dokumen:</span>{" "}
              <span className="font-medium">{document.documentNumber}</span>
            </div>
          )}
          {document.issueDate && (
            <div>
              <span className="text-muted-foreground">Tanggal Terbit:</span>{" "}
              <span className="font-medium">{document.issueDate}</span>
            </div>
          )}
          {document.notes && (
            <div>
              <span className="text-muted-foreground">Catatan:</span>{" "}
              <span className="font-medium">{document.notes}</span>
            </div>
          )}
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto bg-zinc-900/95 min-h-[400px] max-h-[60vh] relative">
          {isImage ? (
            <div className="flex items-center justify-center p-4 h-full">
              <div
                style={{ transform: `scale(${zoom})`, transition: "transform 0.2s" }}
                className="origin-center"
              >
                <img
                  src={document.filePath}
                  alt={document.fileName}
                  className="max-w-full max-h-[55vh] object-contain rounded shadow-lg"
                />
              </div>
            </div>
          ) : isPdf ? (
            <iframe
              src={document.filePath}
              className="w-full h-[55vh] border-0"
              title={document.fileName}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileText className="h-20 w-20 text-zinc-500 mb-4" />
              <p className="text-zinc-400 mb-4">
                Preview tidak tersedia untuk tipe file ini
              </p>
              <Button onClick={handleDownload} variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                Download untuk melihat
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isImage && (
              <>
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {Math.round(zoom * 100)}%
                </span>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(document.filePath, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Buka di Tab Baru
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
