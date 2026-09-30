import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Tes protokol korelasi worker DocStation.
 *
 * Menutup race lama: `onmessage` memakai antrean FIFO buta sehingga pesan
 * spontan INITIALIZED menukar hasil enhance dan membuat
 * `applyImageData(undefined)` meledak. Protokol baru mengorelasikan
 * requestId + mengabaikan INITIALIZED + timeout.
 */

interface FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  posted: { message: Record<string, unknown>; transfer?: Transferable[] }[];
  postMessage: (message: Record<string, unknown>, transfer?: Transferable[]) => void;
  terminate: () => void;
}

function createFakeWorker(): FakeWorker {
  const w: FakeWorker = {
    onmessage: null,
    onerror: null,
    posted: [],
    postMessage(message, transfer) {
      w.posted.push({ message, transfer });
    },
    terminate() {},
  };
  return w;
}

const instances: FakeWorker[] = [];
const RealWorker = globalThis.Worker;

function installFakeWorker() {
  instances.length = 0;
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        const w = createFakeWorker();
        instances.push(w);
        const self = this as unknown as FakeWorker;
        self.posted = w.posted;
        self.postMessage = w.postMessage.bind(w);
        self.terminate = w.terminate.bind(w);
        Object.defineProperty(self, "onmessage", {
          get: () => w.onmessage,
          set: (v) => {
            w.onmessage = v;
          },
        });
        Object.defineProperty(self, "onerror", {
          get: () => w.onerror,
          set: (v) => {
            w.onerror = v;
          },
        });
        (this as unknown as { __fake: FakeWorker }).__fake = w;
      }
    },
  );
}

function fakeOf(hook: { run: unknown }): FakeWorker {
  void hook;
  return instances[instances.length - 1];
}

function emit(w: FakeWorker, data: unknown) {
  w.onmessage?.({ data } as MessageEvent);
}

describe("useOpenCV protocol", () => {
  beforeEach(() => {
    installFakeWorker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (RealWorker) vi.stubGlobal("Worker", RealWorker);
    else vi.stubGlobal("Worker", undefined as unknown as typeof Worker);
  });

  async function loadHook() {
    const { useOpenCV } = await import(
      "@/app/(dashboard)/docstation/_hooks/use-opencv"
    );
    const { renderHook, act } = await import("@testing-library/react");
    const { result } = renderHook(() => useOpenCV());
    return { result, act };
  }

  it("mengabaikan INITIALIZED spontan dan mengorelasikan requestId", async () => {
    const { result, act } = await loadHook();
    let p1: Promise<unknown> | null = null;
    let p2: Promise<unknown> | null = null;
    act(() => {
      p1 = result.current.run({ type: "ENHANCE_BW", payload: {} });
      p2 = result.current.run({ type: "DESKEW", payload: {} });
    });
    const w = fakeOf(result.current);
    // INITIALIZED datang di tengah — tidak boleh menyelesaikan tugas mana pun.
    act(() => {
      emit(w, { type: "INITIALIZED", cvEngine: "pure-js" });
    });
    // Balasan datang terbalik (p2 dulu) — tetap terkirim ke peminta yang benar.
    const r2 = { type: "DESKEW_RESULT", requestId: 2, angle: 1.5 };
    const r1 = {
      type: "ENHANCE_RESULT",
      requestId: 1,
      imageData: new ArrayBuffer(8),
      width: 4,
      height: 2,
    };
    act(() => {
      emit(w, r2);
      emit(w, r1);
    });
    await expect(p1).resolves.toMatchObject({ type: "ENHANCE_RESULT" });
    await expect(p2).resolves.toMatchObject({ angle: 1.5 });
  });

  it("menolak promise saat timeout", async () => {
    const { result, act } = await loadHook();
    let p: Promise<unknown> | null = null;
    act(() => {
      p = result.current.run({ type: "ENHANCE_BG", payload: {} });
      // Jangan biarkan unhandled rejection menggagalkan suite sebelum majukan timer.
      p.catch(() => {});
    });
    // Majukan 120 dtk + toleransi.
    act(() => {
      vi.advanceTimersByTime(121000);
    });
    await expect(p).rejects.toThrow(/timeout/i);
  });

  it("menolak semua pending saat worker error", async () => {
    const { result, act } = await loadHook();
    let p: Promise<unknown> | null = null;
    act(() => {
      p = result.current.run({ type: "ENHANCE_BG", payload: {} });
      p.catch(() => {});
    });
    const w = fakeOf(result.current);
    act(() => {
      w.onerror?.(new Event("error"));
    });
    await expect(p).rejects.toThrow(/gagal/i);
  });
});
