"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Camera,
  Upload,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  User,
} from "lucide-react";

interface PhotoUploadProps {
  alumniId: string;
  currentPhoto?: string | null;
  alumniName: string;
  onPhotoChange?: (newPhotoUrl: string | null) => void;
}

export function PhotoUpload({
  alumniId,
  currentPhoto,
  alumniName,
  onPhotoChange,
}: PhotoUploadProps) {
  const [photo, setPhoto] = useState<string | null>(currentPhoto || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Hanya file JPG, PNG, atau WebP yang diizinkan");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran foto maksimal 2MB");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(`/api/alumni/${alumniId}/photo`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Upload failed");
      }

      const result = await response.json();
      setPhoto(result.photo);
      setSuccess("Foto berhasil diupload");
      onPhotoChange?.(result.photo);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload foto");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm("Hapus foto alumni ini?")) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/alumni/${alumniId}/photo`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to remove photo");
      }

      setPhoto(null);
      setSuccess("Foto berhasil dihapus");
      onPhotoChange?.(null);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus foto");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar */}
      <div className="relative group">
        <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
          <AvatarImage src={photo || undefined} />
          <AvatarFallback className="text-4xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            {alumniName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Overlay */}
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : (
            <Camera className="h-8 w-8 text-white" />
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-1" />
          {photo ? "Ganti Foto" : "Upload Foto"}
        </Button>

        {photo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemovePhoto}
            disabled={uploading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Hapus
          </Button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="py-2 bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{success}</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Format: JPG, PNG, WebP (Maks. 2MB)
      </p>
    </div>
  );
}
