/**
 * letter-image.ts — Util pemuatan gambar untuk renderer dokumen (DOCX).
 *
 * `ImageRun` dari pustaka `docx` membutuhkan buffer biner (Uint8Array), bukan
 * URL. File ini mengambil URL/data-URL gambar dan mengubahnya menjadi buffer
 * yang siap dipakai. Hasil di-cache per-URL agar gambar yang berulang (mis.
 * logo) tidak diunduh berulang kali.
 *
 * Hanya aman dipanggil di browser (memakai fetch).
 */

/** Cache buffer gambar per-URL (data-URL maupun URL absolut). */
const imageCache = new Map<string, Uint8Array>();

/** Hasil pemuatan gambar. */
export interface LoadedImage {
  buffer: Uint8Array;
  /** MIME type (dari header Content-Type atau data-URL). */
  contentType: string;
}

/**
 * Mengambil sebuah URL gambar menjadi buffer biner.
 * Mendukung data: URL (langsung didekode) dan http(s)/path (melalui fetch).
 * Mengembalikan null bila gagal (mis. CSP memblokir atau bukan gambar).
 */
export async function loadImageBuffer(url: string): Promise<LoadedImage | null> {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const cached = imageCache.get(trimmed);
  if (cached) {
    return { buffer: cached, contentType: guessContentType(trimmed) };
  }

  try {
    let buffer: Uint8Array;
    let contentType = "";

    if (trimmed.startsWith("data:")) {
      // data:[<mediatype>][;base64],<data>
      const commaIdx = trimmed.indexOf(",");
      if (commaIdx < 0) return null;
      const meta = trimmed.slice(5, commaIdx);
      const isBase64 = meta.split(";").includes("base64");
      const payload = trimmed.slice(commaIdx + 1);
      contentType = meta.split(";")[0] || "image/png";
      if (isBase64) {
        const bin = atob(payload);
        buffer = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
      } else {
        buffer = new TextEncoder().encode(decodeURIComponent(payload));
      }
    } else {
      const res = await fetch(trimmed, { credentials: "include" });
      if (!res.ok) return null;
      contentType = res.headers.get("content-type") || "";
      const ab = await res.arrayBuffer();
      buffer = new Uint8Array(ab);
    }

    imageCache.set(trimmed, buffer);
    return { buffer, contentType: contentType || guessContentType(trimmed) };
  } catch {
    return null;
  }
}

/** Menebak MIME type dari ekstensi URL (fallback). */
function guessContentType(url: string): string {
  const m = /\.(\w+)(?:\?|#|$)/.exec(url.split("?")[0]);
  const ext = (m?.[1] || "").toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

/** Mengubah ImageRun `transformation` (lebar/tinggi) dari piksel ke EMU-toleran. */
export function imageRunSize(widthPx: number, heightPx: number): { width: number; height: number } {
  return { width: widthPx, height: heightPx };
}
