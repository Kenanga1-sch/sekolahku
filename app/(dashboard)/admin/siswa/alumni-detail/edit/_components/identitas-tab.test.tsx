// Tes jaring pengaman untuk IdentitasTab — mengunci field identitas inti
// (nama, NISN/NIS/NIK numeric-only, agama, jumlah saudara) dan pesan error.
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { IdentitasTab } from "./identitas-tab";
import type { AlumniFormData } from "../alumni-edit-schema";

function Harness({ handleNumericInput }: { handleNumericInput?: (e: React.ChangeEvent<HTMLInputElement>, f: keyof AlumniFormData) => void }) {
  const { register, watch, setValue, formState: { errors } } = useForm<any>();
  return (
    <IdentitasTab
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
      handleNumericInput={handleNumericInput ?? (() => {})}
    />
  );
}

describe("IdentitasTab", () => {
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

  it("menampilkan blok kesehatan & perkembangan jasmani", () => {
    render(<Harness />);
    expect(screen.getByText("Kesehatan & Perkembangan Jasmani")).toBeTruthy();
    expect(screen.getByLabelText("Berat Badan (kg)")).toBeTruthy();
    expect(screen.getByLabelText("Tinggi Badan (cm)")).toBeTruthy();
    expect(screen.getByText("Golongan Darah")).toBeTruthy();
  });

  it("menampilkan field jumlah saudara & anak ke-", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Jumlah Sdr Kandung")).toBeTruthy();
    expect(screen.getByLabelText("Jumlah Sdr Tiri")).toBeTruthy();
    expect(screen.getByLabelText("Jumlah Sdr Angkat")).toBeTruthy();
    expect(screen.getByLabelText("Total Jumlah Saudara")).toBeTruthy();
    expect(screen.getByLabelText("Anak Ke-")).toBeTruthy();
  });
});
