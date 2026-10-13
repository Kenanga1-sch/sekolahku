// Tes jaring pengaman untuk QuotasTab — mengunci kartu jatah kelas,
// daftar kuota siswa, dan dialog Atur.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuotasTab } from "./quotas-tab";
import type { QuotaPolicy, ComputerTimeQuota } from "@/lib/computer";

vi.mock("@/lib/computer", () => ({
  listQuotaPolicies: vi.fn(),
  setQuotaPolicy: vi.fn(),
  listQuotas: vi.fn(),
  setStudentQuota: vi.fn(),
}));

const { listQuotaPolicies, setQuotaPolicy, listQuotas, setStudentQuota } = await import(
  "@/lib/computer"
);

const policies: QuotaPolicy[] = [
  { className: "", minutes: 30 },
  { className: "VII-A", minutes: 60 },
];

const quotas: ComputerTimeQuota[] = [
  {
    studentId: "q1",
    studentName: "Budi",
    className: "VII-A",
    remainingMinutes: 20,
    totalMinutes: 60,
    usedMinutes: 40,
  } as ComputerTimeQuota,
];

beforeEach(() => {
  vi.clearAllMocks();
  (listQuotaPolicies as any).mockResolvedValue(policies);
  (listQuotas as any).mockResolvedValue(quotas);
});

describe("QuotasTab", () => {
  it("menampilkan kartu jatah menit per kelas", async () => {
    render(<QuotasTab />);
    await waitFor(() =>
      expect(screen.getByText("Jatah Menit per Kelas")).toBeInTheDocument(),
    );
  });

  it("menampilkan badge kebijakan (default & kelas)", async () => {
    render(<QuotasTab />);
    await waitFor(() => expect(screen.getByText("Default: 30 menit")).toBeInTheDocument());
    expect(screen.getByText("VII-A: 60 menit")).toBeInTheDocument();
  });

  it("menyimpan kebijakan baru lewat setQuotaPolicy", async () => {
    (setQuotaPolicy as any).mockResolvedValue(undefined);
    render(<QuotasTab />);
    await waitFor(() => expect(screen.getByText("Default: 30 menit")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("(default) atau VII-A"), {
      target: { value: "VIII-B" },
    });
    fireEvent.click(screen.getByText("Simpan"));
    await waitFor(() => expect(setQuotaPolicy).toHaveBeenCalledWith("VIII-B", 60));
  });

  it("menampilkan daftar kuota siswa", async () => {
    render(<QuotasTab />);
    await waitFor(() => expect(screen.getByText((t) => t.includes("Budi"))).toBeInTheDocument());
    expect(screen.getByText("VII-A")).toBeInTheDocument();
    expect(screen.getByText("Atur")).toBeInTheDocument();
  });

  it("membuka dialog Atur dengan total menit terisi", async () => {
    render(<QuotasTab />);
    await waitFor(() => expect(screen.getByText((t) => t.includes("Budi"))).toBeInTheDocument());
    fireEvent.click(screen.getByText("Atur"));
    await waitFor(() =>
      expect(screen.getByText("Atur Kuota Budi")).toBeInTheDocument(),
    );
    expect(document.querySelector("#es-min")).toHaveValue(60);
    expect(
      screen.getByText((t) => t.includes("Terpakai saat ini") && t.includes("40")),
    ).toBeInTheDocument();
  });

  it("menyimpan kuota siswa lewat setStudentQuota", async () => {
    (setStudentQuota as any).mockResolvedValue({} as ComputerTimeQuota);
    render(<QuotasTab />);
    await waitFor(() => expect(screen.getByText((t) => t.includes("Budi"))).toBeInTheDocument());
    fireEvent.click(screen.getByText("Atur"));
    await waitFor(() => expect(screen.getByText("Atur Kuota Budi")).toBeInTheDocument());
    const esMin = document.querySelector("#es-min") as HTMLInputElement;
    fireEvent.change(esMin, { target: { value: "90" } });
    const simpanButtons = screen.getAllByText("Simpan");
    fireEvent.click(simpanButtons[simpanButtons.length - 1]);
    await waitFor(() => expect(setStudentQuota).toHaveBeenCalledWith("q1", 90));
  });
});
