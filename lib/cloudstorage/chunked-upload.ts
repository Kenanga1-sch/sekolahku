/**
 * Chunked upload untuk file besar.
 *
 * Cloudflare Tunnel membatasi ukuran body request ~100MB, jadi file lebih
 * besar daripada itu dipotong di klien (File.slice — bawaan browser, hemat
 * memori), tiap potongan diupload terpisah, dan backend menggabungnya lalu
 * mengirim ke Telegram sebagai SATU file utuh.
 *
 * Resumeable: progress (sessionId + potongan yang sudah masuk) disimpan di
 * IndexedDB. Saat aplikasi dibuka kembali, upload lanjut dari potongan
 * terakhir yang sukses — bukan dari awal. Ini penting untuk video ratusan MB
 * di koneksi HP yang sering putus.
 */

const API_BASE = "/api/cloud";
export const CHUNK_SIZE = 30 * 1024 * 1024; // 30MB — aman di bawah ~100MB tunnel
export const CHUNKED_THRESHOLD = 90 * 1024 * 1024; // di atas ini wajib chunked

function getCSRFToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export interface UploadSessionInfo {
  sessionId: string;
  totalChunks: number;
  chunkSize: number;
  totalSize: number;
  uploadedChunks: number[];
}
/** Store IndexedDB minimal: key = nama file+ukuran, value = info sesi. */
function openChunkDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open("cloud-uploads", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("sessions");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function dbKey(file: File): string {
  return `${file.name}:${file.size}`;
}

async function loadSession(file: File): Promise<UploadSessionInfo | null> {
  const db = await openChunkDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("sessions", "readonly");
      const req = tx.objectStore("sessions").get(dbKey(file));
      req.onsuccess = () => resolve((req.result as UploadSessionInfo) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

async function saveSession(file: File, info: UploadSessionInfo): Promise<void> {
  const db = await openChunkDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(info, dbKey(file));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}

/** Hapus state resume file (dipakai UI setelah upload selesai). */
export async function clearResumeState(file: File): Promise<void> {
  await clearSession(file);
}

async function clearSession(file: File): Promise<void> {
  const db = await openChunkDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").delete(dbKey(file));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}

export interface ChunkedUploadProgress {
  /** Persen 0..100 termasuk fase penggabungan (dibulatkan). */
  percent: number;
  /** Potongan yang sudah terupload. */
  uploadedChunks: number;
  totalChunks: number;
  /** Status backend: uploading | merging | done | failed. */
  status: string;
  message?: string;
}

/**
 * Upload file besar secara bertahap. onProgress dipanggil untuk setiap
 * kemajuan (potongan masuk maupun fase penggabungan).
 *
 * Alur:
 *   1. cek IndexedDB untuk sesi yang sama (resume)
 *   2. buat sesi baru bila tidak ada
 *   3. upload potongan yang belum masuk, satu per satu (urut, hemat HP)
 *   4. panggil complete → backend gabung + kirim Telegram secara async
 *   5. polling status sampai "done"; fase ini memakan waktu menit
 */
export async function uploadFileChunked(
  file: File,
  parentId: string | null,
  onProgress: (p: ChunkedUploadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  // 1. Coba resume sesi yang sama.
  let info = await loadSession(file);
  const mimeType = file.type || "application/octet-stream";

  // 2. Buat sesi baru bila belum ada (atau jumlah potongan berubah).
  if (!info || info.totalChunks !== totalChunks || info.chunkSize !== CHUNK_SIZE) {
    const res = await fetch(`${API_BASE}/upload-sessions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": getCSRFToken() || "" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType,
        parentId: parentId && parentId !== "root" ? parentId : null,
        totalSize: file.size,
        totalChunks,
        chunkSize: CHUNK_SIZE,
        encrypted: false,
      }),
      signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Gagal memulai upload bertahap");
    }
    const data = await res.json();
    info = {
      sessionId: data.data.id,
      totalChunks,
      chunkSize: CHUNK_SIZE,
      totalSize: file.size,
      uploadedChunks: [],
    };
  } else {
    // Resume: jangan percaya catatan lokal. Tanyakan ke server potongan mana
    // yang BENAR-BENAR ada (chunk bisa hilang bila /tmp dibersihkan, container
    // restart, atau sesi kedaluwarsa). Bila server tidak mengenal sesi ini,
    // mulai sesi baru dari awal.
    let resumeOk = false;
    try {
      const st = await fetch(`${API_BASE}/upload-sessions/${info.sessionId}/status`, {
        credentials: "include",
        signal,
      });
      if (st.ok) {
        const sd = await st.json();
        const stStatus: string = sd.data?.status || "";
        const serverIndexes: number[] = Array.isArray(sd.data?.uploaded_indexes)
          ? sd.data.uploaded_indexes
          : [];
        if (stStatus === "uploading") {
          info.uploadedChunks = serverIndexes;
          resumeOk = true;
        } else if (stStatus === "done") {
          // Sudah selesai sepenuhnya di server.
          await clearSession(file);
          onProgress({ percent: 100, uploadedChunks: totalChunks, totalChunks, status: "done" });
          return;
        }
        // merging/failed/status lain → tidak bisa dilanjutkan: resumeOk tetap false.
      }
      // 404/400 (sesi hilang) atau status lain → resumeOk tetap false.
    } catch {
      if (signal?.aborted) throw new Error("Dibatalkan");
      // Gagal menghubungi server saat verifikasi resume → jangan pertahankan
      // sesi lama; akan dibuat sesi baru di bawah.
    }

    if (!resumeOk) {
      // Sesi lama tidak valid/kedaluwarsa → lupakan agar tidak mengirim chunk
      // atau complete ke sesi yang sudah tidak ada.
      await clearSession(file);
      info = null as unknown as UploadSessionInfo;
    }

    if (!info) {
      const res = await fetch(`${API_BASE}/upload-sessions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCSRFToken() || "" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType,
          parentId: parentId && parentId !== "root" ? parentId : null,
          totalSize: file.size,
          totalChunks,
          chunkSize: CHUNK_SIZE,
          encrypted: false,
        }),
        signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Gagal memulai upload bertahap");
      }
      const data = await res.json();
      info = {
        sessionId: data.data.id,
        totalChunks,
        chunkSize: CHUNK_SIZE,
        totalSize: file.size,
        uploadedChunks: [],
      };
    }
  }

  const report = (uploaded: number, status: string, message?: string) =>
    onProgress({
      percent: Math.min(99, Math.round((uploaded / totalChunks) * 100)),
      uploadedChunks: uploaded,
      totalChunks,
      status,
      message,
    });

  // 3. Upload potongan yang belum masuk.
  for (let i = 0; i < totalChunks; i++) {
    if (info.uploadedChunks.includes(i)) continue;
    if (signal?.aborted) throw new Error("Dibatalkan");

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);

    const form = new FormData();
    form.append("index", String(i));
    form.append("chunk", blob, file.name);

    // Retry per potongan: koneksi HP bisa goyang. 3 upaya, jeda 1s.
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/upload-sessions/${info.sessionId}/chunks`, {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": getCSRFToken() || "" },
          body: form,
          signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || `Potongan ${i} gagal diunggah`);
        }
        const data = await res.json();
        // Utamakan daftar indeks nyata dari server. Fallback ke asumsi lama
        // (0..n-1) hanya bila field tidak ada (server versi lama).
        if (Array.isArray(data.data.uploadedIndexes)) {
          info.uploadedChunks = data.data.uploadedIndexes as number[];
        } else {
          info.uploadedChunks = Array.from({ length: data.data.uploadedChunks }, (_, n) => n);
        }
        await saveSession(file, info);
        lastErr = null;
        break;
      } catch (err) {
        if (signal?.aborted) throw new Error("Dibatalkan");
        lastErr = err instanceof Error ? err : new Error(String(err));
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (lastErr) throw lastErr;

    report(info.uploadedChunks.length, "uploading");
  }

  // 4. Minta backend menggabung + kirim ke Telegram (async).
  const completeRes = await fetch(`${API_BASE}/upload-sessions/${info.sessionId}/complete`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": getCSRFToken() || "" },
    signal,
  });
  if (!completeRes.ok) {
    const data = await completeRes.json().catch(() => null);
    throw new Error(data?.error || "Gagal memulai penggabungan");
  }

  // 5. Polling status sampai done/failed. Fase ini bisa menit (upload besar
  //    ke Telegram Bot API lokal). Long-poll ringan setiap 2 detik.
  for (;;) {
    if (signal?.aborted) throw new Error("Dibatalkan");
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${API_BASE}/upload-sessions/${info.sessionId}/status`, {
      credentials: "include",
      signal,
    });
    if (!res.ok) continue;
    const data = await res.json();
    const status: string = data.data?.status || "";
    if (status === "done") {
      await clearSession(file);
      onProgress({ percent: 100, uploadedChunks: totalChunks, totalChunks, status: "done" });
      return;
    }
    if (status === "failed") {
      throw new Error(data.data?.error || "Penggabungan gagal");
    }
    report(info.uploadedChunks.length, status === "merging" ? "merging" : "uploading");
  }
}

/** Batalkan sesi chunked yang tersimpan di IndexedDB (bila user urung). */
export async function abortChunkedUpload(file: File): Promise<void> {
  const info = await loadSession(file);
  if (!info) return;
  try {
    await fetch(`${API_BASE}/upload-sessions/${info.sessionId}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-Token": getCSRFToken() || "" },
    });
  } catch {
    // abaikan — sesi stagnan dibersihkan backend
  }
  await clearSession(file);
}
