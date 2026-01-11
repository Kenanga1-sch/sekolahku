"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Eye, X, FileText, Image as ImageIcon, File } from "lucide-react";

interface DocumentViewerProps {
    url: string;
    filename: string;
    trigger?: React.ReactNode;
}

function getFileType(filename: string): "image" | "pdf" | "other" {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext || "")) {
        return "image";
    }
    if (ext === "pdf") {
        return "pdf";
    }
    return "other";
}

function getFileIcon(filename: string) {
    const type = getFileType(filename);
    if (type === "image") return <ImageIcon className="h-4 w-4" />;
    if (type === "pdf") return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
}

export function DocumentViewer({ url, filename, trigger }: DocumentViewerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const fileType = getFileType(filename);

    const handleDownload = () => {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            {trigger ? (
                <div onClick={() => setIsOpen(true)} className="cursor-pointer">
                    {trigger}
                </div>
            ) : (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(true)}
                    className="gap-2 w-full justify-start"
                >
                    {getFileIcon(filename)}
                    <span className="truncate flex-1 text-left">{filename}</span>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                </Button>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
                    <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-base font-medium">
                            {getFileIcon(filename)}
                            <span className="truncate">{filename}</span>
                        </DialogTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleDownload}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="p-4 max-h-[calc(90vh-80px)] overflow-auto flex items-center justify-center bg-muted/30">
                        {fileType === "image" ? (
                            <img
                                src={url}
                                alt={filename}
                                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                            />
                        ) : fileType === "pdf" ? (
                            <iframe
                                src={url}
                                className="w-full h-[70vh] rounded-lg border"
                                title={filename}
                            />
                        ) : (
                            <div className="text-center p-8">
                                <File className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground mb-4">
                                    Preview tidak tersedia untuk file ini
                                </p>
                                <Button onClick={handleDownload}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download File
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// Simple document list component with viewer integration
interface DocumentListProps {
    documents: string[];
    getUrl: (doc: string) => string;
}

export function DocumentList({ documents, getUrl }: DocumentListProps) {
    if (!documents || documents.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-4">
                Tidak ada dokumen
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {documents.map((doc, index) => (
                <DocumentViewer
                    key={index}
                    url={getUrl(doc)}
                    filename={doc}
                />
            ))}
        </div>
    );
}
