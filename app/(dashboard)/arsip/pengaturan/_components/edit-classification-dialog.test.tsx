// Tes jaring pengaman untuk EditClassificationDialog — mengunci kode terpilih,
// field, switch status aktif, dan callback.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditClassificationDialog } from "./edit-classification-dialog";

function props(over: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    selectedClass: { code: "400.3.5.02" },
    editCode: "400.3.5.02",
    setEditCode: vi.fn(),
    editName: "Kepegawaian",
    setEditName: vi.fn(),
    editDescription: "Deskripsi",
    setEditDescription: vi.fn(),
    editIsActive: true,
    setEditIsActive: vi.fn(),
    isUpdating: false,
    onSubmit: vi.fn(),
    ...over,
  };
}

describe("EditClassificationDialog", () => {
  it("menampilkan judul dan kode klasifikasi terpilih", () => {
    render(<EditClassificationDialog {...props()} />);
    expect(screen.getByText("Edit Klasifikasi Dinas")).toBeInTheDocument();
    expect(screen.getByText("400.3.5.02")).toBeInTheDocument();
  });

  it("mengubah nama memanggil setEditName", () => {
    const setEditName = vi.fn();
    render(<EditClassificationDialog {...props({ setEditName })} />);
    fireEvent.change(screen.getByPlaceholderText("Contoh: Kepegawaian (PTK)"), {
      target: { value: "Kurikulum" },
    });
    expect(setEditName).toHaveBeenCalledWith("Kurikulum");
  });

  it("menampilkan switch status aktif", () => {
    render(<EditClassificationDialog {...props()} />);
    expect(screen.getByText("Status Aktif")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("submit form memanggil onSubmit", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<EditClassificationDialog {...props({ onSubmit })} />);
    fireEvent.submit(document.querySelector("form")!);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("tombol Batal memanggil onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<EditClassificationDialog {...props({ onOpenChange })} />);
    fireEvent.click(screen.getByText("Batal"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("menampilkan label tombol simpan saat proses", () => {
    render(<EditClassificationDialog {...props({ isUpdating: true })} />);
    expect(screen.getByText("Menyimpan...")).toBeInTheDocument();
  });
});
