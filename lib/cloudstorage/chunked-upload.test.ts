import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { uploadFileChunked, abortChunkedUpload, CHUNK_SIZE, CHUNKED_THRESHOLD } from "./chunked-upload";

// --- Fake IndexedDB (persisten dalam-memory per test) ---
function makeFakeIDB() {
  const store = new Map<string, unknown>();
  const db = {
    transaction: (name: string, mode: string) => {
      const tx: { oncomplete?: () => void; objectStore: (s: string) => object } = {
        objectStore: () => ({
          get: (k: string) => {
            const req: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = { result: store.get(k) };
            queueMicrotask(() => req.onsuccess?.());
            return req;
          },
          put: (v: unknown, k: string) => {
            store.set(k, v);
            queueMicrotask(() => tx.oncomplete?.());
            return {};
          },
          delete: (k: string) => {
            store.delete(k);
            queueMicrotask(() => tx.oncomplete?.());
            return {};
          },
        }),
      };
      return tx;
    },
    close: () => {},
  };
  return { db, store };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeFile(size: number, name = "video.mp4"): File {
  const bytes = new Uint8Array(size).fill(65);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "video/mp4" });
  return new File([blob], name, { type: "video/mp4" });
}

// Backend fake: record request ke /api/cloud/upload-sessions/*
interface Call { method: string; url: string; body?: unknown; formIndex?: string }
function stubFetch(log: Call[]) {
  const state = { uploaded: 0, totalChunks: 0 };
  return vi.fn(async (url: string, opts?: RequestInit) => {
    const method = opts?.method || "GET";
    if (url.includes("/upload-sessions") && method === "POST" && !url.includes("/chunks") && !url.includes("/complete")) {
      const body = JSON.parse(opts!.body as string);
      state.totalChunks = body.totalChunks;
      state.uploaded = 0;
      log.push({ method, url });
      return { ok: true, json: async () => ({ data: { id: "sess-1" } }) };
    }
    if (url.includes("/chunks")) {
      const form = opts!.body as FormData;
      log.push({ method, url, formIndex: form.get("index") as string });
      state.uploaded++;
      return { ok: true, json: async () => ({ data: { uploadedChunks: state.uploaded } }) };
    }
    if (url.includes("/complete")) {
      log.push({ method, url });
      return { ok: true, json: async () => ({ data: { status: "merging" } }) };
    }
    if (url.includes("/status")) {
      log.push({ method, url });
      return { ok: true, json: async () => ({ data: { status: "done" } }) };
    }
    if (method === "DELETE") {
      log.push({ method, url });
      return { ok: true, json: async () => ({}) };
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
}

beforeEach(() => {
  const { db } = makeFakeIDB();
  vi.stubGlobal("indexedDB", { open: () => { throw new Error("no"); } });
  vi.stubGlobal("indexedDB", undefined as unknown as IDBFactory);
  void db;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chunked upload", () => {
  it("nilai konstanta sesuai desain", () => {
    expect(CHUNK_SIZE).toBe(30 * 1024 * 1024);
    expect(CHUNKED_THRESHOLD).toBe(90 * 1024 * 1024);
  });

  it("file kecil: dipecah jadi 1 potongan dan selesai", async () => {
    // Fake IDB yang berfungsi
    const store = new Map<string, unknown>();
    vi.stubGlobal("indexedDB", {
      open: () => {
        const db = {
          transaction: () => {
            const tx: { oncomplete?: () => void; objectStore: (s: string) => object } = {
              oncomplete: undefined,
              objectStore: () => ({
              get: (k: string) => {
                const req: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = { result: store.get(k) };
                queueMicrotask(() => req.onsuccess?.());
                return req;
              },
              put: (v: unknown, k: string) => {
                store.set(k, v);
                return {};
              },
              delete: (k: string) => { store.delete(k); return {}; },
              }),
            };
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
          },
          close: () => {},
        };
        const req: { result?: unknown; onsuccess?: () => void; onupgradeneeded?: () => void } = { result: db };
        queueMicrotask(() => req.onsuccess?.());
        return req;
      },
    });

    const log: Call[] = [];
    const fetchMock = stubFetch(log);
    vi.stubGlobal("fetch", fetchMock);

    const file = makeFile(1024); // 1 KB → 1 chunk
    const progress: number[] = [];
    await uploadFileChunked(file, null, (p) => progress.push(p.percent));

    // create + 1 chunk + complete + status
    expect(log.filter((c) => c.method === "POST").length).toBeGreaterThanOrEqual(3);
    expect(log.some((c) => c.url.includes("/chunks"))).toBe(true);
    expect(log.some((c) => c.url.includes("/complete"))).toBe(true);
    expect(progress[progress.length - 1]).toBe(100);
    await flush();
  });

  it("abortChunkedUpload menghapus state dan memanggil DELETE bila ada sesi", async () => {
    const store = new Map<string, unknown>();
    store.set("video.mp4:1024", { sessionId: "sess-9", totalChunks: 1, chunkSize: 1024, totalSize: 1024, uploadedChunks: [] });
    vi.stubGlobal("indexedDB", {
      open: () => {
        const db = {
          transaction: () => {
            const tx: { oncomplete?: () => void; objectStore: (s: string) => object } = {
              oncomplete: undefined,
              objectStore: () => ({
              get: (k: string) => {
                const req: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = { result: store.get(k) };
                queueMicrotask(() => req.onsuccess?.());
                return req;
              },
              put: (v: unknown, k: string) => { store.set(k, v); return {}; },
              delete: (k: string) => { store.delete(k); return {}; },
              }),
            };
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
          },
          close: () => {},
        };
        const req: { result?: unknown; onsuccess?: () => void; onupgradeneeded?: () => void } = { result: db };
        queueMicrotask(() => req.onsuccess?.());
        return req;
      },
    });

    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => ({}) };
    }));

    const file = makeFile(1024);
    await abortChunkedUpload(file);
    await flush();
    expect(calls.some((u) => u.includes("sess-9") && u.includes("upload-sessions"))).toBe(true);
    expect(store.has("video.mp4:1024")).toBe(false);
  });
});
