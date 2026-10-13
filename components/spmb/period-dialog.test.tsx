// Tes jaring pengaman untuk PeriodDialog — mengunci judul (tambah/edit),
// nilai form, tombol Simpan/Batal, dan keadaan menyimpan.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodDialog, type PeriodFormData } from "./period-dialog";

function makeForm(over: Partial<PeriodFormData> = {}): PeriodFormData {
  return {
    name: "Gelombang 1",
    committeeName: "Budi",
    startDate: "2024-06-01",
    endDate: "2024-06-30",
    quota: "100",
    isActive: false,
    ...over,
  };
}

function renderDialog(over: Partial<React.ComponentProps<typeof PeriodDialog>> = {}) {
  const props = {
    open: true,
    editingPeriodId: null,
    formData: makeForm(),
    isSaving: false,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onOpenChange: vi.fn(),
    ...over,
  };
  const utils = render(<PeriodDialog {...props} />);
  return { ...utils, props };
}

describe("PeriodDialog — judul & mode", () => {
  it("tanpa editingPeriodId → judul 'Tambah Gelombang Pendaftaran'", () => {
    renderDialog({ editingPeriodId: null });
    expect(screen.getByText("Tambah Gelombang Pendaftaran")).toBeInTheDocument();
  });

  it("dengan editingPeriodId → judul 'Edit Gelombang Pendaftaran'", () => {
    renderDialog({ editingPeriodId: "p1" });
    expect(screen.getByText("Edit Gelombang Pendaftaran")).toBeInTheDocument();
  });

  it("tertutup (open=false) → isi tidak tampil", () => {
    renderDialog({ open: false });
    expect(screen.queryByText(/Gelombang Pendaftaran/)).toBeNull();
  });
});

describe("PeriodDialog — bidang form", () => {
  it("menampilkan nilai formData pada input", () => {
    renderDialog();
    expect((screen.getByLabelText("Nama Gelombang") as HTMLInputElement).value).toBe("Gelombang 1");
    expect((screen.getByLabelText("Panitia PPDB") as HTMLInputElement).value).toBe("Budi");
    expect((screen.getByLabelText("Tanggal Mulai") as HTMLInputElement).value).toBe("2024-06-01");
    expect((screen.getByLabelText("Tanggal Selesai") as HTMLInputElement).value).toBe("2024-06-30");
    expect((screen.getByLabelText("Kuota Siswa") as HTMLInputElement).value).toBe("100");
  });

  it("mengubah Nama Gelombang memanggil onChange dengan name baru", () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByLabelText("Nama Gelombang"), { target: { value: "Gelombang 2" } });
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Gelombang 2" }));
  });

  it("toggle 'Langsung Aktifkan' memanggil onChange dengan isActive", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByLabelText("Langsung Aktifkan"));
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });
});

describe("PeriodDialog — footer", () => {
  it("Batal memanggil onOpenChange(false)", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Batal"));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Simpan memanggil onSubmit", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Simpan"));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("saat isSaving → tombol Simpan disabled", () => {
    renderDialog({ isSaving: true });
    expect(screen.getByText("Simpan").closest("button")).toBeDisabled();
  });
});
