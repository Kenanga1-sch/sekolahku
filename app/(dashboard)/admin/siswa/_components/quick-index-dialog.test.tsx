// Tes jaring pengaman untuk QuickIndexDialog — mengunci field form, label,
// dan callback onSubmit/onOpenChange.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickIndexDialog } from "./quick-index-dialog";
import type { QuickIndexForm } from "../alumni-types";

function props(over: Record<string, unknown> = {}) {
  const form: QuickIndexForm = {
    fullName: "",
    nisn: "",
    graduationYear: "",
    bukuFisikNo: "",
    registerNo: "",
  };
  return {
    open: true,
    onOpenChange: vi.fn(),
    quickIndexForm: form,
    setQuickIndexForm: vi.fn(),
    quickIndexSaving: false,
    onSubmit: vi.fn(),
    ...over,
  };
}

describe("QuickIndexDialog", () => {
  it("menampilkan judul dialog", () => {
    render(<QuickIndexDialog {...props()} />);
    expect(screen.getByText("Index Cepat Arsip Fisik")).toBeInTheDocument();
  });

  it("menampilkan semua field form", () => {
    render(<QuickIndexDialog {...props()} />);
    expect(screen.getByPlaceholderText("Nama sesuai buku induk fisik")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("mis. 1995")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Opsional")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("mis. VI")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("mis. 1421")).toBeInTheDocument();
  });

  it("mengubah nama memicu setQuickIndexForm dengan updater fungsi", () => {
    const setQuickIndexForm = vi.fn();
    render(<QuickIndexDialog {...props({ setQuickIndexForm })} />);
    fireEvent.change(screen.getByPlaceholderText("Nama sesuai buku induk fisik"), {
      target: { value: "Budi" },
    });
    expect(setQuickIndexForm).toHaveBeenCalled();
    const updater = setQuickIndexForm.mock.calls.at(-1)![0];
    expect(typeof updater).toBe("function");
    // updater mempertahankan seluruh key form
    const result = updater({ fullName: "", nisn: "x", graduationYear: "2020", bukuFisikNo: "VI", registerNo: "9" });
    expect(Object.keys(result).sort()).toEqual(
      ["bukuFisikNo", "fullName", "graduationYear", "nisn", "registerNo"],
    );
  });

  it("tombol Simpan Index memanggil onSubmit", () => {
    const onSubmit = vi.fn();
    render(<QuickIndexDialog {...props({ onSubmit })} />);
    fireEvent.click(screen.getByText("Simpan Index"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("tombol Batal memanggil onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<QuickIndexDialog {...props({ onOpenChange })} />);
    fireEvent.click(screen.getByText("Batal"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("menampilkan label proses saat menyimpan", () => {
    render(<QuickIndexDialog {...props({ quickIndexSaving: true })} />);
    expect(screen.getByText("Menyimpan...")).toBeInTheDocument();
  });
});
