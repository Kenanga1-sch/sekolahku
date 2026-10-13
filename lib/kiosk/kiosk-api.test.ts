// Tes jaring pengaman untuk API helper kiosk bersama — mengunci endpoint,
// payload, dan opsi skipRetry agar refactor tidak mengubah permintaan.
import { describe, it, expect, vi } from "vitest";
import { goPost } from "@/lib/api-client";
import {
  apiSmartScanComplete,
  apiBorrowBook,
  apiReturnBook,
  apiReturnByItem,
  apiAttendanceScan,
  apiSavingsLookup,
  apiSavingsDeposit,
} from "./kiosk-api";

vi.mock("@/lib/api-client", () => ({
  goPost: vi.fn().mockResolvedValue({ ok: true }),
  goGet: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("kiosk-api — endpoint & payload", () => {
  it("apiSmartScanComplete → POST /api/kiosk/scan-complete + skipRetry", async () => {
    await apiSmartScanComplete("QR123");
    expect(goPost).toHaveBeenCalledWith("/api/kiosk/scan-complete", { code: "QR123" }, { skipRetry: true });
  });

  it("apiBorrowBook → type borrow", async () => {
    await apiBorrowBook("m1", "item1");
    expect(goPost).toHaveBeenCalledWith(
      "/api/kiosk/transaction",
      { type: "borrow", memberId: "m1", itemId: "item1" },
      { skipRetry: true },
    );
  });

  it("apiReturnBook → type return", async () => {
    await apiReturnBook("loan1");
    expect(goPost).toHaveBeenCalledWith(
      "/api/kiosk/transaction",
      { type: "return", loanId: "loan1" },
      { skipRetry: true },
    );
  });

  it("apiReturnByItem → type return-by-item", async () => {
    await apiReturnByItem("item9");
    expect(goPost).toHaveBeenCalledWith(
      "/api/kiosk/transaction",
      { type: "return-by-item", itemId: "item9" },
      { skipRetry: true },
    );
  });

  it("apiAttendanceScan → POST /api/kiosk/attendance + skipRetry", async () => {
    await apiAttendanceScan("QR-ATD");
    expect(goPost).toHaveBeenCalledWith("/api/kiosk/attendance", { qrCode: "QR-ATD" }, { skipRetry: true });
  });

  it("apiSavingsLookup → GET /api/kiosk/savings-lookup?qrCode=... + skipRetry", async () => {
    const { goGet } = await import("@/lib/api-client");
    await apiSavingsLookup("ABC 123");
    expect(vi.mocked(goGet)).toHaveBeenCalledWith(
      "/api/kiosk/savings-lookup?qrCode=ABC%20123",
      { skipRetry: true },
    );
  });

  it("apiSavingsDeposit → POST dengan qrCode & nominal + skipRetry", async () => {
    await apiSavingsDeposit("QR9", 50000);
    expect(goPost).toHaveBeenCalledWith(
      "/api/kiosk/savings-deposit",
      { qrCode: "QR9", nominal: 50000 },
      { skipRetry: true },
    );
  });
});
