// Tes jaring pengaman untuk DocumentsTab — mengunci form upload, daftar dokumen,
// tautan lihat, tombol hapus, dan callback onUpload/onDelete.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentsTab } from "./documents-tab";

function makeDoc(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    title: "Kartu Keluarga 2024",
    type: "kk",
    uploadedAt: "2024-01-05T00:00:00Z",
    fileUrl: "/uploads/kk.pdf",
    ...over,
  };
}

function baseProps(over: Record<string, unknown> = {}) {
  return {
    documents: [makeDoc()],
    docTitle: "",
    setDocTitle: vi.fn(),
    docType: "lainnya",
    setDocType: vi.fn(),
    setUploadFile: vi.fn(),
    isUploading: false,
    onUpload: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
}

describe("DocumentsTab", () => {
  it("menampilkan form Upload Dokumen Baru", () => {
    render(<DocumentsTab {...baseProps()} />);
    expect(screen.getByText("Upload Dokumen Baru")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Contoh: Kartu Keluarga 2024")).toBeInTheDocument();
  });

  it("menampilkan daftar dokumen dengan judul & tipe", () => {
    render(<DocumentsTab {...baseProps()} />);
    expect(screen.getByText("Kartu Keluarga 2024")).toBeInTheDocument();
    expect(screen.getByText("kk")).toBeInTheDocument();
  });

  it("menampilkan placeholder bila tidak ada dokumen", () => {
    render(<DocumentsTab {...baseProps({ documents: [] })} />);
    expect(screen.getByText("Belum ada dokumen diupload")).toBeInTheDocument();
  });

  it("tautan Lihat mengarah ke fileUrl", () => {
    render(<DocumentsTab {...baseProps()} />);
    const link = screen.getByText("Lihat").closest("a");
    expect(link).toHaveAttribute("href", "/uploads/kk.pdf");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("memanggil onDelete dengan id dokumen", () => {
    const onDelete = vi.fn();
    render(<DocumentsTab {...baseProps({ onDelete })} />);
    // tombol hapus adalah satu-satunya tombol tanpa teks di card aksi
    const buttons = screen.getAllByRole("button");
    // klik tombol terakhir (ikon trash) di area aksi
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onDelete).toHaveBeenCalledWith("d1");
  });

  it("mengubah judul memanggil setDocTitle", () => {
    const setDocTitle = vi.fn();
    render(<DocumentsTab {...baseProps({ setDocTitle })} />);
    fireEvent.change(screen.getByPlaceholderText("Contoh: Kartu Keluarga 2024"), {
      target: { value: "Akta" },
    });
    expect(setDocTitle).toHaveBeenCalledWith("Akta");
  });

  it("submit form memanggil onUpload", () => {
    const onUpload = vi.fn((e: React.FormEvent) => e.preventDefault());
    const { container } = render(<DocumentsTab {...baseProps({ onUpload })} />);
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    expect(onUpload).toHaveBeenCalled();
  });
});
