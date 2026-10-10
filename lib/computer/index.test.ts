import { describe, it, expect } from "vitest";
import {
  formatCountdown,
  remainingSeconds,
  minutesFromSeconds,
  bookingStatusLabel,
  reportStatusLabel,
  isSessionExpired,
} from "./index";

describe("formatCountdown", () => {
  it("memformat detik menjadi MM:SS", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(5)).toBe("00:05");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(3599)).toBe("59:59");
  });

  it("membulatkan ke atas dan menangani negatif/non-finite", () => {
    expect(formatCountdown(0.4)).toBe("00:01");
    expect(formatCountdown(-10)).toBe("00:00");
    expect(formatCountdown(NaN)).toBe("00:00");
    expect(formatCountdown(Infinity)).toBe("00:00");
  });
});

describe("remainingSeconds", () => {
  const now = Date.parse("2026-01-01T10:00:00Z");
  it("menghitung sisa detik dari deadline ISO", () => {
    expect(remainingSeconds("2026-01-01T10:05:00Z", now)).toBe(300);
  });
  it("menghitung sisa detik dari deadline epoch ms", () => {
    expect(remainingSeconds(now + 90_000, now)).toBe(90);
  });
  it("mengembalikan 0 bila sudah lewat atau tidak valid", () => {
    expect(remainingSeconds("2026-01-01T09:59:00Z", now)).toBe(0);
    expect(remainingSeconds("bukan-tanggal", now)).toBe(0);
  });
});

describe("minutesFromSeconds", () => {
  it("membulatkan ke bawah", () => {
    expect(minutesFromSeconds(59)).toBe(0);
    expect(minutesFromSeconds(60)).toBe(1);
    expect(minutesFromSeconds(150)).toBe(2);
  });
  it("menangani negatif/non-finite", () => {
    expect(minutesFromSeconds(-5)).toBe(0);
    expect(minutesFromSeconds(NaN)).toBe(0);
  });
});

describe("bookingStatusLabel", () => {
  it("menerjemahkan status", () => {
    expect(bookingStatusLabel("booked")).toBe("Terjadwal");
    expect(bookingStatusLabel("active")).toBe("Sedang Dipakai");
    expect(bookingStatusLabel("expired")).toBe("Kedaluwarsa");
  });
  it("fallback ke nilai asli bila tak dikenal", () => {
    expect(bookingStatusLabel("aneh" as any)).toBe("aneh");
  });
});

describe("reportStatusLabel", () => {
  it("menerjemahkan status laporan", () => {
    expect(reportStatusLabel("pending")).toBe("Menunggu Verifikasi");
    expect(reportStatusLabel("approved")).toBe("Disetujui");
    expect(reportStatusLabel("rejected")).toBe("Ditolak");
  });
});

describe("isSessionExpired", () => {
  const now = Date.parse("2026-01-01T10:00:00Z");
  it("true bila sudah lewat deadline", () => {
    expect(isSessionExpired("2026-01-01T09:59:59Z", now)).toBe(true);
    expect(isSessionExpired(now, now)).toBe(true);
  });
  it("false bila masih ada waktu", () => {
    expect(isSessionExpired("2026-01-01T10:00:01Z", now)).toBe(false);
  });
  it("true bila tanggal tidak valid", () => {
    expect(isSessionExpired("nonsense", now)).toBe(true);
  });
});
