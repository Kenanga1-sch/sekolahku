"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Download, Trash2, Pencil, ChevronLeft, ChevronRight, Calendar, FolderOpen, Maximize } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  createdAt: string;
}

interface ImageLightboxProps {
  item: GalleryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (item: GalleryItem) => void;
  onDelete: (id: string) => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export function ImageLightbox({
  item,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: ImageLightboxProps) {
  if (!item) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = item.imageUrl;
    link.download = item.title;
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
        <DialogTitle className="sr-only">{item.title}</DialogTitle>
        
        {/* Close Button */}
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 rounded-full"
          onClick={onClose}
          aria-label="Tutup galeri"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Navigation Arrows */}
        {hasPrev && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 rounded-full h-12 w-12"
            onClick={onPrev}
            aria-label="Gambar sebelumnya"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}
        {hasNext && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 rounded-full h-12 w-12"
            onClick={onNext}
            aria-label="Gambar selanjutnya"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}

        <div className="flex flex-col h-full">
          {/* Image Container */}
          <div className="flex-1 relative flex items-center justify-center p-8">
            <div className="relative w-full h-full">
              <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Info Bar */}
          <div className="bg-zinc-900/90 backdrop-blur-sm border-t border-white/10 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">{item.title}</h2>
                <div className="flex items-center gap-4 text-sm text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <FolderOpen className="h-4 w-4" />
                    <Badge variant="secondary" className="capitalize bg-white/10 text-white border-none">
                      {item.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(item.createdAt), "d MMMM yyyy", { locale: id })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white border-white/20 hover:bg-white/10"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white border-white/20 hover:bg-white/10"
                  onClick={() => {
                    onClose();
                    onEdit(item);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onDelete(item.id);
                    onClose();
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
