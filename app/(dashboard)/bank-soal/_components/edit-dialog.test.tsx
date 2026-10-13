// Tes jaring pengaman untuk EditDialog — mengunci bidang yang tampil sesuai mode
// (latihan vs ujian), nilai form, dan callback onChange/onSave/onClose.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditDialog, type EditForm } from "./edit-dialog";
import type { QuestionSet } from "./types";

function makeSet(over: Partial<QuestionSet> = {}): QuestionSet {
  return {
    id: "set-1",
    name: "Paket A",
    bankId: "bank-1",
    mode: "ujian",
    shuffleQuestions: false,
    shuffleOptions: false,
    resultVisible: true,
    ...over,
  };
}

function makeForm(over: Partial<EditForm> = {}): EditForm {
  return {
    name: "Paket A",
    mode: "latihan",
    timerMinutes: "",
    maxAttempts: "",
    availableFrom: "",
    availableUntil: "",
    resultVisible: true,
    shuffleQuestions: false,
    shuffleOptions: false,
    ...over,
  };
}

function renderDialog(over: Partial<React.ComponentProps<typeof EditDialog>> = {}) {
  const props = {
    editingSet: makeSet(),
    editForm: makeForm(),
    onChange: vi.fn(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  const utils = render(<EditDialog {...props} />);
  return { ...utils, props };
}

describe("EditDialog — judul & bidang dasar", () => {
  it("menampilkan judul dan nama paket di input", () => {
    renderDialog();
    expect(screen.getByText("Edit Paket Soal")).toBeInTheDocument();
    expect((screen.getByPlaceholderText("Nama paket") as HTMLInputElement).value).toBe("Paket A");
  });

  it("tertutup (editingSet null) → judul tidak tampil", () => {
    renderDialog({ editingSet: null });
    expect(screen.queryByText("Edit Paket Soal")).toBeNull();
  });

  it("mengubah nama memanggil onChange dengan form baru", () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByPlaceholderText("Nama paket"), { target: { value: "Paket B" } });
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Paket B" }));
  });
});

describe("EditDialog — bidang khusus mode ujian", () => {
  it("mode latihan: tanpa Maks Percobaan / jadwal / Tampilkan Hasil", () => {
    renderDialog({ editForm: makeForm({ mode: "latihan" }) });
    expect(screen.queryByText("Maks Percobaan (Opsional)")).toBeNull();
    expect(screen.queryByText("Mulai (Opsional)")).toBeNull();
    expect(screen.queryByText("Tampilkan Hasil ke Siswa")).toBeNull();
  });

  it("mode ujian: menampilkan Maks Percobaan, jadwal, Tampilkan Hasil", () => {
    renderDialog({ editForm: makeForm({ mode: "ujian" }) });
    expect(screen.getByText("Maks Percobaan (Opsional)")).toBeInTheDocument();
    expect(screen.getByText("Mulai (Opsional)")).toBeInTheDocument();
    expect(screen.getByText("Selesai (Opsional)")).toBeInTheDocument();
    expect(screen.getByText("Tampilkan Hasil ke Siswa")).toBeInTheDocument();
  });

  it("opsi acak selalu tampil (mode latihan pun)", () => {
    renderDialog({ editForm: makeForm({ mode: "latihan" }) });
    expect(screen.getByText("Acak Urutan Soal")).toBeInTheDocument();
    expect(screen.getByText("Acak Pilihan Jawaban")).toBeInTheDocument();
  });
});

describe("EditDialog — footer", () => {
  it("Batal memanggil onClose; Simpan memanggil onSave", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Batal"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Simpan"));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });
});
