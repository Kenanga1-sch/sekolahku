// Tes jaring pengaman untuk AssignDialog — mengunci judul, daftar kelas
// (format "Kelas …"), keadaan kosong, dan callback toggle/save/close.
// Ditulis SEBELUM pemecahan file tab-paket agar ekstraksi tak mengubah perilaku.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssignDialog } from "./assign-dialog";
import type { ClassItem, QuestionSet } from "./types";

function makeSet(over: Partial<QuestionSet> = {}): QuestionSet {
  return {
    id: "set-1",
    name: "Penilaian Bab 1",
    bankId: "bank-1",
    mode: "ujian",
    shuffleQuestions: false,
    shuffleOptions: false,
    resultVisible: true,
    ...over,
  };
}

const classes: ClassItem[] = [
  { id: "c1", name: "1" },
  { id: "c2", name: "Kelas 2A" },
];

function renderDialog(over: Partial<React.ComponentProps<typeof AssignDialog>> = {}) {
  const props = {
    assigningSet: makeSet(),
    classes,
    assignSelected: new Set<string>(),
    isAssignSaving: false,
    onToggle: vi.fn(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  const utils = render(<AssignDialog {...props} />);
  return { ...utils, props };
}

describe("AssignDialog — judul & deskripsi", () => {
  it("menampilkan judul dan nama paket di deskripsi", () => {
    renderDialog();
    expect(screen.getByText("Tugaskan Ujian ke Kelas")).toBeInTheDocument();
    expect(screen.getByText(/Penilaian Bab 1/)).toBeInTheDocument();
  });

  it("tertutup (assigningSet null) → judul tidak tampil", () => {
    renderDialog({ assigningSet: null });
    expect(screen.queryByText("Tugaskan Ujian ke Kelas")).toBeNull();
  });
});

describe("AssignDialog — daftar kelas", () => {
  it("kelas tanpa prefix 'Kelas' diformat; yang sudah berprefix dibiarkan", () => {
    renderDialog();
    expect(screen.getByText("Kelas 1")).toBeInTheDocument(); // "1" → "Kelas 1"
    expect(screen.getByText("Kelas 2A")).toBeInTheDocument(); // "Kelas 2A" tetap
  });

  it("tanpa kelas → pesan 'Belum ada kelas'", () => {
    renderDialog({ classes: [] });
    expect(screen.getByText("Belum ada kelas")).toBeInTheDocument();
  });

  it("kelas yang dipilih tampil; klik memanggil onToggle dengan id", () => {
    const onToggle = vi.fn();
    renderDialog({ assignSelected: new Set(["c1"]), onToggle });
    fireEvent.click(screen.getByText("Kelas 2A"));
    expect(onToggle).toHaveBeenCalledWith("c2");
  });
});

describe("AssignDialog — footer", () => {
  it("Batal memanggil onClose", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Batal"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("Simpan Penugasan memanggil onSave", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Simpan Penugasan"));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("saat menyimpan → tombol jadi 'Menyimpan...' & disabled", () => {
    renderDialog({ isAssignSaving: true });
    const btn = screen.getByText("Menyimpan...");
    expect(btn).toBeInTheDocument();
    expect(btn.closest("button")).toBeDisabled();
  });
});
