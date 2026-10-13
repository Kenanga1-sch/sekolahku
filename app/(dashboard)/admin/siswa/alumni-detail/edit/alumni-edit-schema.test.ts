// Tes jaring pengaman untuk skema form edit alumni — mengunci aturan validasi
// kritis: nama min 3, coercing angka, dan tahun lulus wajib saat status graduated.
import { describe, it, expect } from "vitest";
import { alumniFormSchema } from "./alumni-edit-schema";

describe("alumniFormSchema", () => {
  it("menolak nama kurang dari 3 karakter", () => {
    const res = alumniFormSchema.safeParse({ fullName: "ab", status: "active" });
    expect(res.success).toBe(false);
  });

  it("menerima data minimal dengan status aktif", () => {
    const res = alumniFormSchema.safeParse({ fullName: "Budi Santoso", status: "active" });
    expect(res.success).toBe(true);
  });

  it("menolak status graduated tanpa tahun lulus", () => {
    const res = alumniFormSchema.safeParse({ fullName: "Budi Santoso", status: "graduated" });
    expect(res.success).toBe(false);
  });

  it("menerima status graduated bila tahun lulus diisi", () => {
    const res = alumniFormSchema.safeParse({
      fullName: "Budi Santoso",
      status: "graduated",
      graduationYear: "2026",
    });
    expect(res.success).toBe(true);
  });

  it("meng-coerce string kosong siblingKandung menjadi 0", () => {
    const res = alumniFormSchema.safeParse({ fullName: "Budi Santoso", status: "active", siblingKandung: "" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.siblingKandung).toBe(0);
  });

  it("menolak email tidak valid", () => {
    const res = alumniFormSchema.safeParse({
      fullName: "Budi Santoso",
      status: "active",
      currentEmail: "bukan-email",
    });
    expect(res.success).toBe(false);
  });
});
