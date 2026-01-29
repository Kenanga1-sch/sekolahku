"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Image as ImageIcon,
  Download,
  Eye,
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  Trash2,
  Shield,
} from "lucide-react";
import { DocumentViewer } from "./document-viewer";

interface AlumniDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  verificationStatus: string;
  verifiedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  documentType: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface DocumentGalleryProps {
  documents: AlumniDocument[];
  onRefresh?: () => void;
}

const statusConfig = {
  pending: { label: "Menunggu", icon: Clock, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  verified: { label: "Terverifikasi", icon: CheckCircle, color: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "Ditolak", icon: XCircle, color: "bg-red-100 text-red-700 border-red-200" },
};

export function DocumentGallery({ documents, onRefresh }: DocumentGalleryProps) {
  const [selectedDocument, setSelectedDocument] = useState<AlumniDocument | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleView = (doc: AlumniDocument) => {
    setSelectedDocument(doc);
    setViewerOpen(true);
  };

  const handleDownload = (docId: string) => {
    window.open(`/api/alumni/documents/${docId}/download`, "_blank");
  };

  const handleVerify = async (docId: string, status: "verified" | "rejected") => {
    try {
      await fetch(`/api/alumni/documents/${docId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onRefresh?.();
    } catch (error) {
      console.error("Error verifying document:", error);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Hapus dokumen ini?")) return;
    try {
      await fetch(`/api/alumni/documents/${docId}`, { method: "DELETE" });
      onRefresh?.();
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-16 w-16 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">Belum ada dokumen</p>
        <p className="text-sm">Upload dokumen untuk menyimpan bukti otentik alumni</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => {
          const isImage = doc.mimeType?.startsWith("image/");
          const status = statusConfig[doc.verificationStatus as keyof typeof statusConfig] || statusConfig.pending;
          const StatusIcon = status.icon;

          return (
            <Card key={doc.id} className="group hover:shadow-md transition-shadow overflow-hidden">
              {/* Thumbnail / Preview */}
              <div 
                className="relative h-40 bg-zinc-100 dark:bg-zinc-800 cursor-pointer overflow-hidden"
                onClick={() => handleView(doc)}
              >
                {isImage ? (
                  <img
                    src={doc.filePath}
                    alt={doc.fileName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <FileText className="h-16 w-16 text-red-500/70" />
                    <span className="text-xs text-muted-foreground mt-2 uppercase">
                      {doc.mimeType?.split("/")[1] || "Dokumen"}
                    </span>
                  </div>
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button size="sm" variant="secondary">
                    <Eye className="h-4 w-4 mr-1" />
                    Lihat
                  </Button>
                </div>

                {/* Status Badge */}
                <Badge className={`absolute top-2 right-2 ${status.color} border text-xs`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>

              {/* Info */}
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {doc.documentType?.name || "Dokumen"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatFileSize(doc.fileSize)}
                      {doc.documentNumber && ` • No: ${doc.documentNumber}`}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(doc)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Lihat Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(doc.id)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      {doc.verificationStatus === "pending" && (
                        <>
                          <DropdownMenuItem onClick={() => handleVerify(doc.id, "verified")}>
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            Verifikasi
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleVerify(doc.id, "rejected")}>
                            <XCircle className="h-4 w-4 mr-2 text-red-600" />
                            Tolak
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem 
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          open={viewerOpen}
          onClose={() => {
            setViewerOpen(false);
            setSelectedDocument(null);
          }}
        />
      )}
    </>
  );
}
