// Tes jaring pengaman untuk AlumniKeluargaTab (alumni-tambah) — mengunci blok
// orang tua/wali dan kartu alamat & kontak utama.
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { AlumniKeluargaTab } from "./keluarga-tab";

function Harness() {
  const { register, watch } = useForm<any>();
  return <AlumniKeluargaTab register={register} watch={watch} handleNumericInput={() => {}} />;
}

describe("AlumniKeluargaTab (tambah)", () => {
  it("menampilkan blok ayah, ibu, dan wali", () => {
    render(<Harness />);
    expect(screen.getByText("Data Ayah")).toBeTruthy();
    expect(screen.getByText("Data Ibu")).toBeTruthy();
    expect(screen.getByText("Data Wali (Jika Ada)")).toBeTruthy();
    expect(screen.getByLabelText("Nama Lengkap Ayah")).toBeTruthy();
    expect(screen.getByLabelText("Nama Lengkap Ibu")).toBeTruthy();
    expect(screen.getByLabelText("Nama Wali")).toBeTruthy();
  });

  it("menampilkan kartu alamat rumah & kontak utama", () => {
    render(<Harness />);
    expect(screen.getByText("Alamat Rumah & Telepon Kontak Utama")).toBeTruthy();
    expect(screen.getByLabelText(/Nama Kontak Utama/)).toBeTruthy();
    expect(screen.getByLabelText(/Alamat Lengkap Rumah/)).toBeTruthy();
  });
});
