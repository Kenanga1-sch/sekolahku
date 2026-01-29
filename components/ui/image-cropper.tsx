"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Area, Point } from "react-easy-crop";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import getCroppedImg from "@/lib/crop-image"; 
// We will need a utility function for this

interface ImageCropperProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedImageBlob: Blob) => void;
}

export function ImageCropper({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteCallback = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    setLoading(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      // croppedImage is a Blob or string url. Let's assume Blob for upload.
      if (croppedImage) {
         onCropComplete(croppedImage);
         onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!imageSrc) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
            <DialogTitle>Sesuaikan Foto</DialogTitle>
            <DialogDescription>
                Geser dan sesuaikan ukuran foto agar pas di tampilan.
            </DialogDescription>
        </DialogHeader>
        
        <div className="relative w-full h-80 bg-black rounded-md overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={3 / 4} // Standard aspect ratio for portraits
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteCallback}
            onZoomChange={onZoomChange}
          />
        </div>

        <div className="space-y-2 py-4">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Zoom</span>
                <span>{(zoom * 100).toFixed(0)}%</span>
            </div>
            <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(val: number[]) => setZoom(val[0])}
            />
        </div>

        <DialogFooter>
            <Button variant="outline" onClick={onClose}>Batal</Button>
            <Button onClick={handleSave} disabled={loading}>
                {loading ? "Memproses..." : "Simpan & Gunakan"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
