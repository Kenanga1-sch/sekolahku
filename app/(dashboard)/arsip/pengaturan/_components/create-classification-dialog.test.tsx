// Tes jaring pengaman untuk CreateClassificationDialog — mengunci judul, field,
// dan callback onSubmit/onOpenChange.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreateClassificationDialog } from "./create-classification-dialog";

function props(over: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    createCode: "",
    setCreateCode: vi.fn(),
    createName: "",
    setCreateName: vi.fn(),
    createDescription: "",
    setCreateDescription: vi.fn(),
    isCreating: false,
    onSubmit: vi.fn(),
    ...over,
  };
}

describe("CreateClassificationDialog", () => {
  it("menampilkan judul dan deskripsi", () => {
    render(<CreateClassificationDialog {...props()} />);
    expect(screen.getByText("Tambah Klasifikasi Dinas")).toBeInTheDocument();
  });

  it("menampilkan field kode, nama, dan deskripsi", () => {
    render(<CreateClassificationDialog {...props()} />);
    expect(screen.getByPlaceholderText("Contoh: 400.3.5.02 atau 421.1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Contoh: Kepegawaian (PTK) atau Kurikulum")).toBeInTheDocument();
  });

  it("mengubah kode memanggil setCreateCode", () => {
    const setCreateCode = vi.fn();
    render(<CreateClassificationDialog {...props({ setCreateCode })} />);
    fireEvent.change(screen.getByPlaceholderText("Contoh: 400.3.5.02 atau 421.1"), {
      target: { value: "421.1" },
    });
    expect(setCreateCode).toHaveBeenCalledWith("421.1");
  });

  it("submit form memanggil onSubmit", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<CreateClassificationDialog {...props({ onSubmit })} />);
    fireEvent.submit(document.querySelector("form")!);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("menampilkan tombol Batal yang memanggil onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<CreateClassificationDialog {...props({ onOpenChange })} />);
    fireEvent.click(screen.getByText("Batal"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("menampilkan label tombol simpan saat proses", () => {
    render(<CreateClassificationDialog {...props({ isCreating: true })} />);
    expect(screen.getByText("Menyimpan...")).toBeInTheDocument();
  });
});
