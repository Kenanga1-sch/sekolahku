import { describe, expect, it, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePageVisible } from "./use-page-visible";

afterEach(() => {
  // Kembalikan ke keadaan terlihat agar test lain tidak terpengaruh.
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  Object.defineProperty(document, "visibilityState", {
    value: hidden ? "hidden" : "visible",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePageVisible", () => {
  it("true secara default saat dokumen terlihat", () => {
    setHidden(false);
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(true);
  });

  it("false saat tab disembunyikan, kembali true saat terlihat", () => {
    setHidden(false);
    const { result } = renderHook(() => usePageVisible());

    act(() => setHidden(true));
    expect(result.current).toBe(false);

    act(() => setHidden(false));
    expect(result.current).toBe(true);
  });

  it("nilai awal mengikuti keadaan dokumen saat mount (sudah hidden)", () => {
    setHidden(true);
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(false);
    setHidden(false);
  });

  it("berhenti mendengarkan setelah unmount", () => {
    setHidden(false);
    const { unmount, result } = renderHook(() => usePageVisible());
    unmount();
    // Tidak error walau event tetap dikirim setelah unmount.
    act(() => setHidden(true));
    expect(result.current).toBe(true);
    setHidden(false);
  });
});
