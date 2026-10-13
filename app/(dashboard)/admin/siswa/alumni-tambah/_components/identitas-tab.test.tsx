// Tes jaring pengaman untuk AlumniIdentitasTab (alumni-tambah) — mengunci field
// identitas inti yang dipakai form Tambah Buku Induk.
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { AlumniIdentitasTab } from "./identitas-tab";

function Harness() {
  const { register, watch, setValue, formState: { errors } } = useForm<any>();
  return (
    <AlumniIdentitasTab
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
      handleNumericInput={() => {}}
    />
  );
}

describe("AlumniIdentitasTab (tambah)", () => {
  it("menampilkan judul langkah 1 dan field inti identitas", () => {
    render(<Harness />);
    expect(screen.getByText("Langkah 1: Identitas Diri Siswa")).toBeTruthy();
    expect(screen.getByLabelText(/Nama Lengkap/)).toBeTruthy();
    expect(screen.getByLabelText(/Nama Panggilan/)).toBeTruthy();
    expect(screen.getByLabelText("NISN (10 Digit)")).toBeTruthy();
    expect(screen.getByLabelText("NIS (Nomor Induk)")).toBeTruthy();
    expect(screen.getByLabelText("NIK (16 Digit)")).toBeTruthy();
    expect(screen.getByLabelText("Tempat Lahir")).toBeTruthy();
    expect(screen.getByLabelText("Tanggal Lahir")).toBeTruthy();
  });

  it("menampilkan field jumlah saudara kandung/tiri/angkat", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Jumlah Sdr Kandung")).toBeTruthy();
    expect(screen.getByLabelText("Jumlah Sdr Tiri")).toBeTruthy();
    expect(screen.getByLabelText("Jumlah Sdr Angkat")).toBeTruthy();
  });
});
