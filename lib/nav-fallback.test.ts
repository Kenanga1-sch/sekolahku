import { afterEach, describe, expect, it, vi } from "vitest";
import { goBackOrHome, hasHistory, homeFallback, isAuthenticatedClient } from "@/lib/nav-fallback";

function setCookie(value: string) {
  Object.defineProperty(document, "cookie", { configurable: true, writable: true, value });
}

describe("nav-fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setCookie("");
  });

  it("isAuthenticatedClient true bila cookie user_info ada", () => {
    setCookie("csrf_token=abc; user_info=%7B%7D");
    expect(isAuthenticatedClient()).toBe(true);
  });

  it("isAuthenticatedClient false tanpa cookie user_info", () => {
    setCookie("csrf_token=abc");
    expect(isAuthenticatedClient()).toBe(false);
  });

  it("homeFallback login-aware", () => {
    setCookie("user_info=x");
    expect(homeFallback()).toBe("/");
    setCookie("");
    expect(homeFallback()).toBe("/login");
  });

  it("hasHistory true bila idx > 0", () => {
    window.history.pushState({ idx: 2 }, "");
    expect(hasHistory()).toBe(true);
  });

  it("goBackOrHome memakai history.back bila ada riwayat", () => {
    window.history.pushState({ idx: 1 }, "");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    expect(goBackOrHome()).toBe("__back__");
    expect(back).toHaveBeenCalled();
  });

  it("goBackOrHome mengarah ke /login tanpa riwayat & tanpa login", () => {
    window.history.replaceState({ idx: 0 }, "");
    Object.defineProperty(document, "referrer", { configurable: true, value: "" });
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign },
    });
    expect(goBackOrHome()).toBe("/login");
    expect(assign).toHaveBeenCalledWith("/login");
  });
});
