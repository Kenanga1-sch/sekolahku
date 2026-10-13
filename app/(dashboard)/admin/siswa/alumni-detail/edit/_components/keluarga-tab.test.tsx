// Tes jaring pengaman untuk KeluargaTab — mengunci blok orang tua kandung
// (ayah/ibu/wali) dan kartu alamat rumah & kontak utama.
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { KeluargaTab } from "./keluarga-tab";

function Harness() {
  const { register, watch } = useForm<any>();
  return <KeluargaTab register={register} watch={watch} handleNumericInput={() => {}} />;
}

describe("KeluargaTab", () => {
  it("menampilkan blok data ayah, ibu, dan wali", () => {
    render(<Harness />);
    expect(screen.getByText("Data Ayah")).toBeTruthy();
    expect(screen.getByText("Data Ibu")).toBeTruthy();
    expect(screen.getByText("Data Wali (Jika Ada)")).toBeTruthy();
    expect(screen.getByLabelText("Nama Lengkap Ayah")).toBeTruthy();
    expect(screen.getByLabelText("NIK Ayah")).toBeTruthy();
    expect(screen.getByLabelText("Nama Lengkap Ibu")).toBeTruthy();
    expect(screen.getByLabelText("Nama Wali")).toBeTruthy();
    expect(screen.getByLabelText("Hubungan Keluarga")).toBeTruthy();
  });

  it("menampilkan kartu alamat rumah & kontak utama", () => {
    render(<Harness />);
    expect(screen.getByText("Alamat Rumah & Telepon Kontak Utama")).toBeTruthy();
    expect(screen.getByLabelText(/Nama Kontak Utama/)).toBeTruthy();
    expect(screen.getByLabelText(/No Telepon Kontak Utama/)).toBeTruthy();
    expect(screen.getByLabelText(/Alamat Lengkap Rumah/)).toBeTruthy();
    expect(screen.getByLabelText(/Catatan Penting Lain-lain/)).toBeTruthy();
  });
});
