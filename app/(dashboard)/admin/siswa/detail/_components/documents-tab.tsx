"use client";

import React from "react";
import { Upload, Trash2, Eye, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export interface StudentDoc {
    id: string;
    title: string;
    type: string;
    uploadedAt: string;
    fileUrl: string;
}

export interface DocumentsTabProps {
    documents: StudentDoc[];
    docTitle: string;
    setDocTitle: (v: string) => void;
    docType: string;
    setDocType: (v: string) => void;
    setUploadFile: (v: File | null) => void;
    isUploading: boolean;
    onUpload: (e: React.FormEvent) => void;
    onDelete: (docId: string) => void;
}

export function DocumentsTab({
    documents,
    docTitle,
    setDocTitle,
    docType,
    setDocType,
    setUploadFile,
    isUploading,
    onUpload,
    onDelete,
}: DocumentsTabProps) {

    return (
      <>
        {/* Upload Section */}
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Upload Dokumen Baru
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={onUpload} className="flex flex-col md:flex-row gap-4 item-end">
                    <div className="flex-1 space-y-2">
                        <Label>Judul Dokumen</Label>
                        <Input 
                            placeholder="Contoh: Kartu Keluarga 2024" 
                            value={docTitle}
                            onChange={(e) => setDocTitle(e.target.value)}
                            required 
                        />
                    </div>
                    <div className="w-[200px] space-y-2">
                        <Label>Jenis</Label>
                        <Select value={docType} onValueChange={setDocType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="kk">Kartu Keluarga (KK)</SelectItem>
                                <SelectItem value="akta">Akta Kelahiran</SelectItem>
                                <SelectItem value="kip">KIP / Bansos</SelectItem>
                                <SelectItem value="ijazah_tk">Ijazah TK</SelectItem>
                                <SelectItem value="foto">Pas Foto</SelectItem>
                                <SelectItem value="lainnya">Lainnya</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 space-y-2">
                        <Label>File (Max 5MB)</Label>
                        <Input 
                            type="file" 
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                            accept=".pdf,.jpg,.jpeg,.png"
                        />
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" disabled={isUploading}>
                            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Upload
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>

        {/* Documents List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.length === 0 ? (
                <div className="col-span-full text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    Belum ada dokumen diupload
                </div>
            ) : (
                documents.map(doc => (
                    <Card key={doc.id} className="group hover:border-primary/50 transition-colors">
                        <CardContent className="p-4 flex items-start gap-3">
                            <div className="mt-1 h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate" title={doc.title}>{doc.title}</h4>
                                <p className="text-xs text-muted-foreground capitalize mb-2">{doc.type.replace('_', ' ')}</p>
                                <div className="text-xs text-muted-foreground">
                                    {format(new Date(doc.uploadedAt), "d MMM yyyy", { locale: id })}
                                </div>
                            </div>
                        </CardContent>
                        <div className="p-3 border-t bg-muted/20 flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" asChild>
                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                    <Eye className="h-3 w-3 mr-1" /> Lihat
                                </a>
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => onDelete(doc.id)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </Card>
                ))
            )}
        </div>
      </>
    );
}
