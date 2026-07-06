import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-";
  try {
    return format(new Date(date), "dd MMMM yyyy", { locale: id });
  } catch (error) {
    return "-";
  }
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return "-";
  try {
    return format(new Date(date), "dd MMMM yyyy HH:mm", { locale: id });
  } catch (error) {
    return "-";
  }
}

export function formatDistance(km: number) {
  return `${km.toFixed(2)} km`;
}

export function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const formatCurrency = formatRupiah;

export function getStatusLabel(status: string) {
  switch (status) {
    case "draft": return "Draft";
    case "submitted": return "Menunggu Verifikasi";
    case "verified": return "Terverifikasi";
    case "accepted": return "Diterima";
    case "rejected": return "Ditolak";
    case "enrolled": return "Terdaftar Ulang";
    default: return status;
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case "draft": return "bg-gray-100 text-gray-800";
    case "submitted": return "bg-amber-100 text-amber-800";
    case "verified": return "bg-blue-100 text-blue-800";
    case "accepted": return "bg-green-100 text-green-800";
    case "rejected": return "bg-red-100 text-red-800";
    case "enrolled": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export function getGenderLabel(gender: string) {
    if (gender === "L") return "Laki-laki";
    if (gender === "P") return "Perempuan";
    return gender;
}

export async function compressImage(file: File, maxWidth = 1024, quality = 0.85): Promise<File> {
  if (typeof window === "undefined") return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/webp",
          quality
        );
      };
    };
    reader.onerror = () => resolve(file);
  });
}

export function normalizePublicPath(path: string | null | undefined): string {
  if (!path) return "";
  let normalized = path.replace(/\\/g, "/");
  if (!normalized.startsWith("/") && !normalized.startsWith("http://") && !normalized.startsWith("https://") && !normalized.startsWith("blob:")) {
    normalized = "/" + normalized;
  }
  return normalized;
}

export function extractFilename(path: string | null | undefined): string {
  if (!path) return "";
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || "";
}

