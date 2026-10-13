// Tes jaring pengaman untuk PayHutangDialog — mengunci detail hutang, metode
// pembayaran, saldo tabungan (mode tabungan), tombol Set Maksimal, & callback.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PayHutangDialog } from "./pay-hutang-dialog";
import type { Hutang } from "./types";

function makeHutang(over: Partial<Hutang> = {}): Hutang {
  return {
    id: "h1",
    siswaId: "s1",
    namaBarang: "Buku Paket",
    kategori: "buku",
    nominal: 50000,
    jumlah: 3,
    terbayar: 50000,
    status: "aktif",
    tanggalAmbil: "2024-06-01",
    catatan: null,
    tahunAjaran: "2024/2025",
    siswa: { id: "s1", nama: "Budi Santoso", nisn: "1234567890", kelas: "4A" },
    ...over,
  };
}

function renderDialog(over: Partial<React.ComponentProps<typeof PayHutangDialog>> = {}) {
  const props = {
    hutang: makeHutang(),
    savingsBalance: 200000,
    paymentMethod: "cash" as const,
    payAmount: "",
    isPaying: false,
    onPaymentMethodChange: vi.fn(),
    onPayAmountChange: vi.fn(),
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  const utils = render(<PayHutangDialog {...props} />);
  return { ...utils, props };
}

describe("PayHutangDialog — detail & judul", () => {
  it("menampilkan judul, nama siswa, dan detail hutang", () => {
    renderDialog();
    expect(screen.getByText("Form Pembayaran Cicilan")).toBeInTheDocument();
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Buku Paket")).toBeInTheDocument();
    expect(screen.getByText(/Total Tagihan \(3x\)/)).toBeInTheDocument();
  });

  it("hutang null → isi form tidak dirender (dialog tertutup)", () => {
    renderDialog({ hutang: null });
    expect(screen.queryByText("Form Pembayaran Cicilan")).toBeNull();
  });

  it("mengklik metode 'Potong Tabungan' memanggil onPaymentMethodChange('tabungan')", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Potong Tabungan"));
    expect(props.onPaymentMethodChange).toHaveBeenCalledWith("tabungan");
  });
});

describe("PayHutangDialog — mode tabungan (saldo)", () => {
  it("metode cash → blok saldo tabungan tidak tampil", () => {
    renderDialog({ paymentMethod: "cash" });
    expect(screen.queryByText("Saldo Tabungan Siswa:")).toBeNull();
  });

  it("metode tabungan → menampilkan saldo & format rupiah", () => {
    renderDialog({ paymentMethod: "tabungan", savingsBalance: 200000 });
    expect(screen.getByText("Saldo Tabungan Siswa:")).toBeInTheDocument();
    expect(screen.getByText(/200\.000/)).toBeInTheDocument();
  });

  it("saldo kurang dari sisa → peringatan 'Saldo Kurang untuk Pelunasan'", () => {
    // sisa = 50000*3 - 50000 = 100000; saldo 50000 < 100000
    renderDialog({ paymentMethod: "tabungan", savingsBalance: 50000 });
    expect(screen.getByText("Saldo Kurang untuk Pelunasan")).toBeInTheDocument();
  });
});

describe("PayHutangDialog — Set Maksimal / Lunas", () => {
  it("metode cash → set ke sisa tagihan (100000)", () => {
    const { props } = renderDialog({ paymentMethod: "cash" });
    fireEvent.click(screen.getByText("Set Maksimal / Lunas"));
    expect(props.onPayAmountChange).toHaveBeenCalledWith("100000");
  });

  it("metode tabungan → set ke min(sisa, saldo)", () => {
    const { props } = renderDialog({ paymentMethod: "tabungan", savingsBalance: 40000 });
    fireEvent.click(screen.getByText("Set Maksimal / Lunas"));
    expect(props.onPayAmountChange).toHaveBeenCalledWith("40000");
  });
});

describe("PayHutangDialog — footer & submit", () => {
  it("Batal memanggil onClose", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Batal"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("submit form memanggil onSubmit", () => {
    const { props } = renderDialog();
    fireEvent.submit(screen.getByRole("button", { name: /Proses Bayar/ }).closest("form")!);
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("isPaying → tombol Proses Bayar disabled", () => {
    renderDialog({ isPaying: true });
    expect(screen.getByRole("button", { name: /Proses Bayar/ })).toBeDisabled();
  });
});
