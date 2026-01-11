"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Camera, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

// Sample gallery data - in production, this would come from PocketBase
const galleryData = [
    {
        id: "1",
        category: "Upacara",
        title: "Upacara Bendera",
        description: "Upacara bendera setiap hari Senin",
        image: "https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&q=80",
    },
    {
        id: "2",
        category: "Olahraga",
        title: "Perlombaan Futsal",
        description: "Pertandingan futsal antar kelas",
        image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80",
    },
    {
        id: "3",
        category: "Akademik",
        title: "Kegiatan Belajar",
        description: "Suasana belajar di kelas",
        image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80",
    },
    {
        id: "4",
        category: "Kesenian",
        title: "Pentas Seni",
        description: "Penampilan tari tradisional",
        image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80",
    },
    {
        id: "5",
        category: "Akademik",
        title: "Laboratorium Komputer",
        description: "Praktik komputer",
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80",
    },
    {
        id: "6",
        category: "Olahraga",
        title: "Senam Pagi",
        description: "Senam pagi bersama",
        image: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80",
    },
    {
        id: "7",
        category: "Kesenian",
        title: "Paduan Suara",
        description: "Latihan paduan suara",
        image: "https://images.unsplash.com/photo-1506177820405-87f0e94c9c91?w=800&q=80",
    },
    {
        id: "8",
        category: "Akademik",
        title: "Perpustakaan",
        description: "Membaca di perpustakaan",
        image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
    },
];

const categories = ["Semua", "Akademik", "Olahraga", "Kesenian", "Upacara"];

export default function GalleryPage() {
    const [selectedCategory, setSelectedCategory] = useState("Semua");
    const [selectedImage, setSelectedImage] = useState<number | null>(null);

    const filteredImages = selectedCategory === "Semua"
        ? galleryData
        : galleryData.filter(img => img.category === selectedCategory);

    const openLightbox = (index: number) => {
        setSelectedImage(index);
    };

    const closeLightbox = () => {
        setSelectedImage(null);
    };

    const nextImage = () => {
        if (selectedImage !== null) {
            setSelectedImage((selectedImage + 1) % filteredImages.length);
        }
    };

    const prevImage = () => {
        if (selectedImage !== null) {
            setSelectedImage((selectedImage - 1 + filteredImages.length) % filteredImages.length);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
                        <Camera className="h-8 w-8" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight mb-4">
                        Galeri Foto
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Dokumentasi kegiatan dan momen berharga di sekolah kami
                    </p>
                </div>

                {/* Category Filters */}
                <div className="flex flex-wrap justify-center gap-2 mb-10">
                    {categories.map((category) => (
                        <Button
                            key={category}
                            variant={selectedCategory === category ? "default" : "outline"}
                            onClick={() => setSelectedCategory(category)}
                            className="rounded-full"
                        >
                            {category}
                        </Button>
                    ))}
                </div>

                {/* Gallery Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredImages.map((image, index) => (
                        <Card
                            key={image.id}
                            className="overflow-hidden group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                            onClick={() => openLightbox(index)}
                        >
                            <div className="relative aspect-[4/3] overflow-hidden">
                                <img
                                    src={image.image}
                                    alt={image.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="p-3 bg-white/90 rounded-full">
                                        <ZoomIn className="h-6 w-6 text-primary" />
                                    </div>
                                </div>
                                <Badge className="absolute top-3 left-3 bg-primary/90 text-primary-foreground">
                                    {image.category}
                                </Badge>
                            </div>
                            <CardContent className="p-4">
                                <h3 className="font-semibold mb-1">{image.title}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-1">{image.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Empty State */}
                {filteredImages.length === 0 && (
                    <Card className="p-12 text-center">
                        <Camera className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                        <p className="text-lg font-medium mb-2">Tidak ada foto</p>
                        <p className="text-muted-foreground">
                            Belum ada foto untuk kategori ini
                        </p>
                    </Card>
                )}

                {/* Lightbox Dialog */}
                <Dialog open={selectedImage !== null} onOpenChange={closeLightbox}>
                    <DialogContent className="max-w-5xl p-0 bg-black/95 border-none">
                        <DialogTitle className="sr-only">
                            {selectedImage !== null ? filteredImages[selectedImage].title : "Gallery Image"}
                        </DialogTitle>
                        {selectedImage !== null && (
                            <div className="relative">
                                <img
                                    src={filteredImages[selectedImage].image}
                                    alt={filteredImages[selectedImage].title}
                                    className="w-full max-h-[80vh] object-contain"
                                />
                                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                                    <h3 className="text-white text-xl font-semibold">{filteredImages[selectedImage].title}</h3>
                                    <p className="text-white/80">{filteredImages[selectedImage].description}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-4 right-4 text-white hover:bg-white/20"
                                    onClick={closeLightbox}
                                >
                                    <X className="h-6 w-6" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                                    onClick={prevImage}
                                >
                                    <ChevronLeft className="h-8 w-8" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                                    onClick={nextImage}
                                >
                                    <ChevronRight className="h-8 w-8" />
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
