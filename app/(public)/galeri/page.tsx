"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { Loader2, Image as ImageIcon, ZoomIn, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const categories = [
  { id: "all", label: "Semua" },
  { id: "kegiatan", label: "Kegiatan" },
  { id: "fasilitas", label: "Fasilitas" },
  { id: "prestasi", label: "Prestasi" },
  { id: "lainnya", label: "Lainnya" },
];

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const { data, error, isLoading } = useSWR(`/api/gallery?category=${activeCategory}`, fetcher);
  const galleryItems = (data?.data as GalleryItem[]) || [];
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);

  // Filter items (redundant if API filters, but good for smooth transition if caching)
  // Actually we rely on API filter for "all" vs specific
  // But let's handle "all" client side if we wanted, but sticking to API is better for pagination later.

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      {/* Header */}
      <div className="pt-32 pb-12 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container px-4 md:px-6 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6"
            >
                <Camera className="h-8 w-8" />
            </motion.div>
            <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-zinc-900 dark:text-white"
            >
                Galeri Sekolah
            </motion.h1>
            <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-muted-foreground text-lg max-w-2xl mx-auto"
            >
                Dokumentasi kegiatan, fasilitas, dan prestasi siswa kami.
            </motion.p>
        </div>
      </div>

      <div className="container px-4 md:px-6 py-12">
        {/* Filters */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "outline"}
              onClick={() => setActiveCategory(cat.id)}
              className="rounded-full"
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Gallery Grid */}
        {isLoading ? (
            <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
        ) : galleryItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <ImageIcon className="h-12 w-12 mb-4 opacity-20" />
                <p>Belum ada foto untuk kategori ini.</p>
            </div>
        ) : (
            <motion.div 
                layout
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
            >
                <AnimatePresence mode="popLayout">
                    {galleryItems.map((item) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                            key={item.id}
                            className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 ring-1 ring-black/5 dark:ring-white/10"
                            onClick={() => setSelectedImage(item)}
                        >
                            <Image
                                src={item.imageUrl}
                                alt={item.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                                <p className="text-white font-medium text-lg translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                    {item.title}
                                </p>
                                <div className="flex items-center justify-between mt-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                                    <Badge variant="secondary" className="capitalize bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-sm">
                                        {item.category}
                                    </Badge>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>
        )}

        {/* Lightbox */}
        <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
            <DialogContent className="max-w-5xl w-full p-0 overflow-hidden bg-black/95 border-none shadow-2xl text-white">
                <DialogTitle className="sr-only">Detail Foto</DialogTitle>
                <div className="relative w-full h-[80vh] flex flex-col">
                     <div className="relative flex-1 w-full bg-black/50 backdrop-blur-sm">
                        {selectedImage && (
                            <Image
                                src={selectedImage.imageUrl}
                                alt={selectedImage.title}
                                fill
                                className="object-contain"
                            />
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full z-50"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X className="h-6 w-6" />
                        </Button>
                   </div>
                   {selectedImage && (
                       <div className="p-6 bg-zinc-900 border-t border-white/10 shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold">{selectedImage.title}</h3>
                                    <p className="text-zinc-400 capitalize text-sm mt-1">{selectedImage.category}</p>
                                </div>
                                <div className="hidden sm:block">
                                    <p className="text-xs text-zinc-500">
                                        Diupload pada {new Date(selectedImage.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                       </div>
                   )}
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
