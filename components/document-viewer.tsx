import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, ExternalLink, FileText, Image as ImageIcon, File } from "lucide-react";
import { DOCUMENT_LABELS } from "@/lib/spmb";

interface DocumentViewerProps {
    url: string;
    filename: string; // The raw filename/path
    displayName?: string; // Optional friendly name
    subtitle?: string;
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
    if (type === "image") return <ImageIcon className="h-4 w-4 text-purple-600" />;
    if (type === "pdf") return <FileText className="h-4 w-4 text-orange-600" />;
    return <File className="h-4 w-4 text-gray-600" />;
}

// Helper to clean up filenames (remove /uploads/spmb/ prefix)
function getCleanFilename(path: string) {
    if (!path) return "Unknown File";
    const parts = path.split("/");
    return parts[parts.length - 1];
}

export function DocumentViewer({ url, filename, displayName, subtitle, trigger }: DocumentViewerProps) {
    const cleanName = getCleanFilename(filename);
    const showName = displayName || cleanName;

    if (trigger) {
        return (
            <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="cursor-pointer hover:opacity-80 transition-opacity block"
                title={`Open ${showName} in new tab`}
            >
                {trigger}
            </a>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "group flex w-full items-center justify-start h-auto py-3 px-4 bg-white hover:bg-slate-50 border-slate-200"
            )}
            title={`Open ${showName} in new tab`}
        >
            <div className="mr-3 bg-slate-100 p-2 rounded-md group-hover:bg-white transition-colors">
                {getFileIcon(filename)}
            </div>
            <div className="flex-1 overflow-hidden text-left">
                <p className="font-medium text-sm text-slate-900 truncate">{showName}</p>
                {subtitle && (
                    <p className="text-xs text-slate-500 truncate">{subtitle}</p>
                )}
                {!subtitle && showName !== cleanName && (
                    <p className="text-xs text-slate-400 truncate font-mono">{cleanName}</p>
                )}
            </div>
            <ExternalLink className="h-3 w-3 text-slate-400 ml-2 flex-shrink-0" />
        </a>
    );
}

// Simple document list component with viewer integration
interface DocumentItem {
    path: string;
    type?: string;
    originalName?: string;
}

interface DocumentListProps {
    documents: (string | DocumentItem)[];
    getUrl: (path: string) => string;
}

export function DocumentList({ documents, getUrl }: DocumentListProps) {
    if (!documents || documents.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-8 italic border border-dashed rounded-lg bg-muted/20">
                Tidak ada dokumen dilampirkan
            </p>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-1">
            {documents.map((doc, index) => {
                const isString = typeof doc === 'string';
                const path = isString ? doc : doc.path;
                const type = !isString ? doc.type : undefined;
                
                // Determine label
                let label = isString ? undefined : (doc.type && DOCUMENT_LABELS[doc.type]);
                if (!label && !isString && doc.originalName) {
                    label = doc.originalName;
                }
                
                const subtitle = label ? getCleanFilename(path) : undefined;

                return (
                    <DocumentViewer
                        key={index}
                        url={getUrl(path)}
                        filename={path}
                        displayName={label}
                        subtitle={subtitle}
                    />
                );
            })}
        </div>
    );
}
