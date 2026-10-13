// Tes jaring pengaman untuk TransaksiDialog — mengunci judul (tambah/ubah),
// mode sampah (Berat/Harga per Kg), dan callback onChange/onSave/onOpenChange.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransaksiDialog, type TxForm } from "./transaksi-dialog";
import type { FinanceUnit, FinanceCategory } from "@/lib/keuangan";

function makeForm(over: Partial<TxForm> = {}): TxForm {
  return {
    id: "",
    unitId: "u1",
    categoryId: "",
    direction: "in",
    amount: 1000,
    description: "penjualan",
    txDate: "2024-06-01",
    party: "Budi",
    quantity: "",
    unitPrice: 0,
    reference: "",
    ...over,
  };
}

const units: FinanceUnit[] = [
  { id: "u1", name: "Kantin", type: "generic" },
  { id: "u2", name: "Bank Sampah", type: "sampah" },
] as unknown as FinanceUnit[];

const categories: FinanceCategory[] = [
  { id: "c1", name: "Makanan", unitId: "u1", direction: "in" },
] as unknown as FinanceCategory[];

function renderDialog(over: Partial<React.ComponentProps<typeof TransaksiDialog>> = {}) {
  const props = {
    open: true,
    form: makeForm(),
    units,
    formCategories: categories,
    sampahMode: false,
    saving: false,
    onChange: vi.fn(),
    onSave: vi.fn(),
    onOpenChange: vi.fn(),
    ...over,
  };
  const utils = render(<TransaksiDialog {...props} />);
  return { ...utils, props };
}

describe("TransaksiDialog — judul & dasar", () => {
  it("tanpa id → judul 'Tambah Transaksi'; dengan id → 'Ubah Transaksi'", () => {
    renderDialog({ form: makeForm({ id: "" }) });
    expect(screen.getByText("Tambah Transaksi")).toBeInTheDocument();
  });

  it("dengan id → judul 'Ubah Transaksi'", () => {
    renderDialog({ form: makeForm({ id: "t1" }) });
    expect(screen.getByText("Ubah Transaksi")).toBeInTheDocument();
  });

  it("tertutup → judul tidak tampil", () => {
    renderDialog({ open: false });
    expect(screen.queryByText(/Transaksi/)).toBeNull();
  });

  it("opsi unit & kategori dirender", () => {
    renderDialog();
    expect(screen.getByText(/Kantin/)).toBeInTheDocument();
    expect(screen.getByText("Makanan")).toBeInTheDocument();
  });
});

describe("TransaksiDialog — mode sampah", () => {
  it("sampahMode=false → tanpa 'Berat (Kg)' & 'Harga / Kg'", () => {
    renderDialog({ sampahMode: false });
    expect(screen.queryByText("Berat (Kg)")).toBeNull();
    expect(screen.queryByText("Harga / Kg")).toBeNull();
    expect(screen.getByText("Pihak")).toBeInTheDocument();
  });

  it("sampahMode=true → menampilkan 'Berat (Kg)' & 'Harga / Kg' & label pihak berubah", () => {
    renderDialog({ sampahMode: true });
    expect(screen.getByText("Berat (Kg)")).toBeInTheDocument();
    expect(screen.getByText("Harga / Kg")).toBeInTheDocument();
    expect(screen.getByText("Pengepul / Pembeli")).toBeInTheDocument();
  });
});

describe("TransaksiDialog — callback", () => {
  it("ubah Uraian memanggil onChange dengan description", () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByPlaceholderText("Keterangan transaksi..."), { target: { value: "beli alat" } });
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ description: "beli alat" }));
  });

  it("Batal memanggil onOpenChange(false)", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Batal"));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Simpan memanggil onSave", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Simpan"));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("saving=true → tombol Simpan & Batal disabled", () => {
    renderDialog({ saving: true });
    expect(screen.getByText("Simpan").closest("button")).toBeDisabled();
    expect(screen.getByText("Batal").closest("button")).toBeDisabled();
  });
});
