// Klien API Cloud Storage (backend Go) di bawah /api/cloud/*.
//
// Setiap pengguna memiliki ruang penyimpanan pribadi (terisolasi di server).
// Endpoint dilindungi sesi JWT Sekolahku; karena upload mengirim FormData dan
// unduh mengembalikan binary (bukan JSON), kita tidak memakai `goFetch`,
// tetapi tetap menyertakan cookie sesi + CSRF token.

export interface CloudFile {
  id: string;
  owner_id: string;
  name: string;
  path?: string;
  parent_id?: string | null;
  is_folder: boolean;
  file_id?: string | null;
  message_id?: number | null;
  mime_type: string;
  size: number;
  encrypted: boolean;
  created_at: number;
  updated_at: number;
  deleted_at?: number | null;
  share_token?: string | null;
  share_expires_at?: number | null;
  is_starred: boolean;
  accessed_at?: number | null;
  sort_order: number;
  share_kind?: string | null;
}

export interface CloudUsage {
  used_bytes: number;
  file_count: number;
}

export interface CloudConfig {
  enabled: boolean;
  max_upload_size: number;
}

/** Sortir listing. `manual` = urutan hasil drag/atur sendiri. */
export type CloudSort = "name" | "size" | "date_desc" | "date_asc" | "manual";

/** Filter jenis berkas. */
export type CloudTypeFilter = "all" | "folder" | "image" | "video" | "audio" | "pdf" | "doc" | "other";

/** View khusus lintas folder. */
export type CloudView = "files" | "starred" | "recent" | "large" | "trash";

export interface ListFilesParams {
  parentId?: string | null;
  sort?: CloudSort;
  type?: CloudTypeFilter;
  starred?: boolean;
  view?: "starred" | "recent" | "large";
  limit?: number;
  offset?: number;
}

const API_BASE = "/api/cloud";

function getCSRFToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function mutationHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const csrf = getCSRFToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return headers;
}

async function parseError(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => null);
  const err = new Error((data && data.error) || fallback);
  (err as any).status = res.status;
  return err;
}

export async function fetchConfig(): Promise<CloudConfig> {
  const res = await fetch(`${API_BASE}/config`, { credentials: "include" });
  if (!res.ok) throw await parseError(res, "Gagal memuat konfigurasi");
  const data = await res.json();
  return { enabled: !!data.enabled, max_upload_size: data.max_upload_size ?? 0 };
}

export async function fetchUsage(): Promise<CloudUsage> {
  const res = await fetch(`${API_BASE}/usage`, { credentials: "include" });
  if (!res.ok) throw await parseError(res, "Gagal memuat pemakaian");
  const data = await res.json();
  return { used_bytes: data.used_bytes ?? 0, file_count: data.file_count ?? 0 };
}

export async function listFiles(parentId?: string | null): Promise<CloudFile[]> {
  const qs = parentId ? `?parent_id=${encodeURIComponent(parentId)}` : "";
  const res = await fetch(`${API_BASE}/files${qs}`, { credentials: "include" });
  if (!res.ok) throw await parseError(res, "Gagal memuat berkas");
  return res.json();
}

/** Listing dengan sortir/filter/view lanjutan. */
export async function listFiles2(params: ListFilesParams = {}): Promise<CloudFile[]> {
  const q = new URLSearchParams();
  if (params.parentId) q.set("parent_id", params.parentId);
  if (params.sort) q.set("sort", params.sort);
  if (params.type && params.type !== "all") q.set("type", params.type);
  if (params.starred) q.set("starred", "1");
  if (params.view) q.set("view", params.view);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  const res = await fetch(`${API_BASE}/files${qs ? `?${qs}` : ""}`, { credentials: "include" });
  if (!res.ok) throw await parseError(res, "Gagal memuat berkas");
  return res.json();
}

/** Menyalakan/mematikan favorit. */
export async function setStar(id: string, starred: boolean): Promise<CloudFile> {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(id)}/star`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ starred }),
  });
  if (!res.ok) throw await parseError(res, "Gagal mengubah favorit");
  return res.json();
}

/** Menetapkan urutan manual item dalam satu folder. */
export async function reorderFiles(ids: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/files/reorder`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw await parseError(res, "Gagal menyimpan urutan");
}

/** Membuat catatan teks baru. */
export async function createNote(name: string, content: string, parentId?: string | null): Promise<CloudFile> {
  const res = await fetch(`${API_BASE}/notes`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name, content, parent_id: parentId ?? null }),
  });
  if (!res.ok) throw await parseError(res, "Gagal membuat catatan");
  return res.json();
}

/** Mengganti isi berkas teks. */
export async function updateTextContent(id: string, content: string): Promise<CloudFile> {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(id)}/content`, {
    method: "PUT",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw await parseError(res, "Gagal menyimpan catatan");
  return res.json();
}

/** Memuat isi berkas teks sebagai string (untuk editor). */
export async function fetchTextContent(id: string): Promise<string> {
  const res = await fetch(fileDownloadUrl(id), { credentials: "include" });
  if (!res.ok) throw await parseError(res, "Gagal memuat isi berkas");
  return res.text();
}

/** Memutar gambar 90/180/270 derajat. */
export async function rotateImage(id: string, deg: number): Promise<CloudFile> {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(id)}/rotate`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ deg }),
  });
  if (!res.ok) throw await parseError(res, "Gagal memutar gambar");
  return res.json();
}

/** Mengunduh sekumpulan item sebagai ZIP (memakai fetch + blob). */
export async function downloadZip(ids: string[], fallbackName = "cloud-storage"): Promise<void> {
  const res = await fetch(`${API_BASE}/files/zip`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw await parseError(res, "Gagal membuat arsip ZIP");
  const blob = await res.blob();
  const name = filenameFromDisposition(res.headers.get("Content-Disposition")) || `${fallbackName}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Mengambil nama berkas dari header Content-Disposition. */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const m = /filename="?([^";]+)"?/.exec(header);
  return m ? m[1] : null;
}

export async function createFolder(name: string, parentId?: string | null): Promise<CloudFile> {
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name, parent_id: parentId ?? null }),
  });
  if (!res.ok) throw await parseError(res, "Gagal membuat folder");
  return res.json();
}

export async function renameFile(id: string, name: string): Promise<CloudFile> {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw await parseError(res, "Gagal mengganti nama");
  return res.json();
}

export async function trashFile(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: mutationHeaders(),
  });
  if (!res.ok) throw await parseError(res, "Gagal menghapus");
}

export async function moveFiles(ids: string[], targetId?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/files/move`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ids, target_id: targetId ?? null }),
  });
  if (!res.ok) throw await parseError(res, "Gagal memindahkan");
}

export async function copyFiles(ids: string[], targetId?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/files/copy`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ids, target_id: targetId ?? null }),
  });
  if (!res.ok) throw await parseError(res, "Gagal menyalin");
}

export async function listTrash(): Promise<CloudFile[]> {
  const res = await fetch(`${API_BASE}/trash`, { credentials: "include" });
  if (!res.ok) throw await parseError(res, "Gagal memuat trash");
  return res.json();
}

export async function restoreFile(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/trash/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders(),
  });
  if (!res.ok) throw await parseError(res, "Gagal memulihkan");
}

export async function restoreAll(): Promise<void> {
  const res = await fetch(`${API_BASE}/trash/restore-all`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders(),
  });
  if (!res.ok) throw await parseError(res, "Gagal memulihkan semua");
}

export async function permanentDelete(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/trash/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: mutationHeaders(),
  });
  if (!res.ok) throw await parseError(res, "Gagal menghapus permanen");
}

export async function emptyTrash(): Promise<void> {
  const res = await fetch(`${API_BASE}/trash`, {
    method: "DELETE",
    credentials: "include",
    headers: mutationHeaders(),
  });
  if (!res.ok) throw await parseError(res, "Gagal mengosongkan trash");
}

export async function searchFiles(q: string): Promise<CloudFile[]> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
  if (!res.ok) throw await parseError(res, "Gagal mencari");
  return res.json();
}

export async function createShare(id: string): Promise<string> {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(id)}/share`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders(),
  });
  if (!res.ok) throw await parseError(res, "Gagal membuat tautan");
  const data = await res.json();
  return data.share_token as string;
}

export async function revokeShare(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(id)}/share`, {
    method: "DELETE",
    credentials: "include",
    headers: mutationHeaders(),
  });
  if (!res.ok) throw await parseError(res, "Gagal mencabut tautan");
}

/** URL streaming untuk pratinjau/unduh. */
export function fileDownloadUrl(id: string, download = false): string {
  const qs = download ? "?dl=1" : "";
  return `${API_BASE}/files/${encodeURIComponent(id)}/download${qs}`;
}

export function fileThumbUrl(id: string): string {
  return `${API_BASE}/files/${encodeURIComponent(id)}/thumb`;
}

export function shareUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/s?t=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// Share publik (halaman /s — tanpa login)
// ---------------------------------------------------------------------------

export interface SharedEntry {
  id: string;
  name: string;
  is_folder: boolean;
  size: number;
  mime_type: string;
}

export interface SharedInfo {
  name: string;
  size: number;
  mime_type: string;
  is_folder: boolean;
  expires_at?: number | null;
  entries?: SharedEntry[];
}

/** Metadata tautan share publik. Melempar error bila token invalid/kadaluarsa. */
export async function fetchSharedInfo(token: string): Promise<SharedInfo> {
  const res = await fetch(`${API_BASE}/s/${encodeURIComponent(token)}`, { credentials: "omit" });
  if (!res.ok) throw await parseError(res, "Tautan tidak valid atau sudah kadaluarsa");
  return res.json();
}

/** URL unduh publik sebuah berkas yang di-share. */
export function sharedDownloadUrl(token: string): string {
  return `${API_BASE}/s/${encodeURIComponent(token)}/download`;
}

/** URL penyajian (inline preview) berkas publik yang di-share. */
export function sharedFileUrl(token: string, fileId?: string): string {
  if (fileId) return `${API_BASE}/s/${encodeURIComponent(token)}/file/${encodeURIComponent(fileId)}`;
  return sharedDownloadUrl(token);
}

/** URL ZIP publik untuk folder yang di-share. */
export function sharedZipUrl(token: string): string {
  return `${API_BASE}/s/${encodeURIComponent(token)}/zip`;
}

/** True bila berkas dapat diedit sebagai teks (samakan dengan logika backend). */
export function isEditableText(file: CloudFile): boolean {
  if (file.is_folder) return false;
  const m = file.mime_type || "";
  if (m.startsWith("text/")) return true;
  if (["application/json", "application/xml", "application/javascript", "application/x-yaml"].includes(m)) return true;
  const ext = (file.name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
  return [".txt", ".md", ".markdown", ".json", ".csv", ".log", ".yml", ".yaml", ".xml", ".html", ".css", ".js", ".ts", ".ini", ".conf"].includes(ext);
}

/**
 * Upload via XMLHttpRequest untuk mendapatkan progres unggahan.
 */
export function uploadFileWithProgress(
  file: File,
  parentId: string | null,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<CloudFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/files`);
    xhr.withCredentials = true;
    const csrf = getCSRFToken();
    if (csrf) xhr.setRequestHeader("X-CSRF-Token", csrf);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Respons tidak valid"));
        }
        return;
      }
      let msg = "Gagal mengunggah";
      try {
        msg = JSON.parse(xhr.responseText).error || msg;
      } catch {
        /* abaikan */
      }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Kesalahan jaringan"));
    xhr.onabort = () => reject(new Error("Dibatalkan"));

    if (signal) {
      signal.addEventListener("abort", () => xhr.abort());
    }

    const form = new FormData();
    form.append("file", file);
    if (parentId) form.append("parent_id", parentId);
    xhr.send(form);
  });
}

/** Format ukuran byte ke string ringkas. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Ikon MIME sederhana (dipakai untuk pemilihan ikon di UI). */
export function fileKind(file: CloudFile): "folder" | "image" | "video" | "audio" | "pdf" | "doc" | "other" {
  if (file.is_folder) return "folder";
  const m = file.mime_type || "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("text/") || m.includes("word") || m.includes("document")) return "doc";
  return "other";
}
