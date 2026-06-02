import { describe, it, expect, vi, beforeEach } from "vitest";
import { loginAction, logoutAction } from "./auth";
import { goPost } from "@/lib/api-client";

// Mock the API client
vi.mock("@/lib/api-client", () => ({
  goPost: vi.fn(),
  goGet: vi.fn(),
}));

describe("Auth Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cookies
    if (typeof document !== "undefined") {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    }
  });

  describe("loginAction", () => {
    it("should return success when API returns success", async () => {
      vi.mocked(goPost).mockResolvedValueOnce({ success: true });

      const result = await loginAction("test@example.com", "password123");

      expect(result).toEqual({ success: true });
      expect(goPost).toHaveBeenCalledWith("/api/auth/login", {
        email: "test@example.com",
        password: "password123",
      });
    });

    it("should return error message when API returns error", async () => {
      vi.mocked(goPost).mockResolvedValueOnce({ success: false, error: "Invalid credentials" });

      const result = await loginAction("test@example.com", "wrong");

      expect(result).toEqual({ error: "Invalid credentials" });
    });

    it("should handle exceptions gracefully", async () => {
      vi.mocked(goPost).mockRejectedValueOnce(new Error("Network Error"));

      const result = await loginAction("test@example.com", "password");

      expect(result.error).toBe("Network Error");
    });
  });

  describe("logoutAction", () => {
    it("should call logout API and clear cookies", async () => {
      vi.mocked(goPost).mockResolvedValueOnce({ message: "OK" });
      
      // Set a fake cookie
      document.cookie = "session=fake-token; path=/";

      await logoutAction();

      expect(goPost).toHaveBeenCalledWith("/api/auth/logout", {});
      // In JS-DOM/Vitest environment, we can check document.cookie
      // Note: logoutAction in code clears session cookie
      expect(document.cookie).not.toContain("session=fake-token");
    });
  });
});
