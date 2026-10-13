// Tes jaring pengaman untuk DeleteClassificationDialog — mengunci judul konfirmasi,
// rincian kode, dan callback onConfirm/onOpenChange.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteClassificationDialog } from "./delete-classification-dialog";

function props(over: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    classToDelete: { code: "400.3.5.02", name: "Kepegawaian" },
    isDeleting: false,
    onConfirm: vi.fn(),
    ...over,
  };
}

describe("DeleteClassificationDialog", () => {
  it("menampilkan judul konfirmasi hapus", () => {
    render(<DeleteClassificationDialog {...props()} />);
    expect(screen.getByText("Hapus Klasifikasi?")).toBeInTheDocument();
  });

  it("menampilkan kode & nama yang akan dihapus", () => {
    render(<DeleteClassificationDialog {...props()} />);
    expect(screen.getByText("400.3.5.02")).toBeInTheDocument();
    expect(screen.getByText(/\(Kepegawaian\)/)).toBeInTheDocument();
  });

  it("menampilkan peringatan pengarsipan", () => {
    render(<DeleteClassificationDialog {...props()} />);
    expect(screen.getByText(/Perhatian Pengarsipan/)).toBeInTheDocument();
  });

  it("tombol Ya, Hapus memanggil onConfirm", () => {
    const onConfirm = vi.fn();
    render(<DeleteClassificationDialog {...props({ onConfirm })} />);
    fireEvent.click(screen.getByText("Ya, Hapus"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("tombol Batal memanggil onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<DeleteClassificationDialog {...props({ onOpenChange })} />);
    fireEvent.click(screen.getByText("Batal"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("menampilkan label tombol proses saat menghapus", () => {
    render(<DeleteClassificationDialog {...props({ isDeleting: true })} />);
    expect(screen.getByText("Menghapus...")).toBeInTheDocument();
  });
});
