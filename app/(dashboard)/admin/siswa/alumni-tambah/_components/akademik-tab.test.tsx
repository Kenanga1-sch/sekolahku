// Tes jaring pengaman untuk AlumniAkademikTab (alumni-tambah) — mengunci field
// status/akademik dan blok kondisional per status siswa (tanpa blok alumni-tracking).
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { AlumniAkademikTab } from "./akademik-tab";

function Harness({ entryType, studentStatus }: { entryType: "tk" | "mutasi"; studentStatus: string }) {
  const { register, watch, setValue, formState: { errors } } = useForm<any>();
  return (
    <AlumniAkademikTab
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
      entryType={entryType}
      setEntryType={() => {}}
      studentStatus={studentStatus}
    />
  );
}

describe("AlumniAkademikTab (tambah)", () => {
  it("menampilkan judul langkah 2 dan field akademik", () => {
    render(<Harness entryType="tk" studentStatus="active" />);
    expect(screen.getByText("Langkah 2: Riwayat Akademik & Status Siswa")).toBeTruthy();
    expect(screen.getByLabelText(/Tahun Masuk/)).toBeTruthy();
    expect(screen.getByLabelText(/Kelas Saat Ini/)).toBeTruthy();
    expect(screen.getByLabelText(/Buku Induk Fisik No/)).toBeTruthy();
  });

  it("menampilkan field TK atau mutasi sesuai entryType", () => {
    const { rerender } = render(<Harness entryType="tk" studentStatus="active" />);
    expect(screen.getByLabelText("TK Asal / Sumber")).toBeTruthy();
    rerender(<Harness entryType="mutasi" studentStatus="active" />);
    expect(screen.getByLabelText("Nama Sekolah Asal")).toBeTruthy();
  });

  it("menampilkan blok kelulusan hanya saat graduated", () => {
    const { unmount } = render(<Harness entryType="tk" studentStatus="graduated" />);
    expect(screen.getByLabelText(/Tahun Lulus/)).toBeTruthy();
    unmount();
    render(<Harness entryType="tk" studentStatus="active" />);
    expect(screen.queryByLabelText(/Tahun Lulus/)).toBeNull();
  });

  it("tidak menampilkan blok penelusuran alumni (tak ada di form tambah)", () => {
    render(<Harness entryType="tk" studentStatus="active" />);
    expect(screen.queryByText("Penelusuran Alumni")).toBeNull();
  });
});
