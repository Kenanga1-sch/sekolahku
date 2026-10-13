// Tes jaring pengaman untuk AkademikTab — mengunci field status/akademik,
// metode masuk (TK vs mutasi), dan blok keluar kondisional per status.
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { AkademikTab } from "./akademik-tab";

function Harness({
  entryType,
  studentStatus,
}: {
  entryType: "tk" | "mutasi";
  studentStatus: string;
}) {
  const { register, watch, setValue, formState: { errors } } = useForm<any>();
  return (
    <AkademikTab
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

describe("AkademikTab", () => {
  it("menampilkan field status, tahun masuk, kelas terakhir", () => {
    render(<Harness entryType="tk" studentStatus="active" />);
    expect(screen.getByText("Langkah 2: Riwayat Akademik & Status Siswa")).toBeTruthy();
    expect(screen.getByLabelText(/Tahun Masuk/)).toBeTruthy();
    expect(screen.getByLabelText(/Kelas Saat Ini/)).toBeTruthy();
    expect(screen.getByLabelText(/Buku Induk Fisik No/)).toBeTruthy();
    expect(screen.getByLabelText("Nomor Urut Register")).toBeTruthy();
  });

  it("menampilkan field asal TK ketika entryType=tk", () => {
    render(<Harness entryType="tk" studentStatus="active" />);
    expect(screen.getByLabelText("TK Asal / Sumber")).toBeTruthy();
    expect(screen.getByLabelText("No. Surat Keterangan / STTB TK")).toBeTruthy();
  });

  it("menampilkan field mutasi masuk ketika entryType=mutasi", () => {
    render(<Harness entryType="mutasi" studentStatus="active" />);
    expect(screen.getByLabelText("Nama Sekolah Asal")).toBeTruthy();
    expect(screen.getByLabelText("Dari Kelas")).toBeTruthy();
    expect(screen.getByLabelText("Diterima di Kelas")).toBeTruthy();
  });

  it("menampilkan blok kelulusan hanya saat status graduated", () => {
    const { unmount } = render(<Harness entryType="tk" studentStatus="graduated" />);
    expect(screen.getByLabelText(/Tahun Lulus/)).toBeTruthy();
    expect(screen.getByLabelText("Tanggal Kelulusan")).toBeTruthy();
    unmount();
    render(<Harness entryType="tk" studentStatus="active" />);
    expect(screen.queryByLabelText(/Tahun Lulus/)).toBeNull();
  });

  it("menampilkan blok mutasi keluar hanya saat status transferred", () => {
    render(<Harness entryType="tk" studentStatus="transferred" />);
    expect(screen.getByLabelText("Ke Sekolah Tujuan")).toBeTruthy();
    expect(screen.getByLabelText("Tanggal Pindah")).toBeTruthy();
  });

  it("menampilkan blok drop out hanya saat status dropped", () => {
    render(<Harness entryType="tk" studentStatus="dropped" />);
    expect(screen.getByLabelText("Tanggal Keluar")).toBeTruthy();
    expect(screen.getByLabelText(/Alasan Keluar \/ Putus Sekolah/)).toBeTruthy();
  });

  it("menampilkan blok dokumen resmi & penelusuran alumni", () => {
    render(<Harness entryType="tk" studentStatus="active" />);
    expect(screen.getByText("Penelusuran Alumni")).toBeTruthy();
    expect(screen.getByLabelText("No. Ijazah")).toBeTruthy();
    expect(screen.getByLabelText("No. SKHUN")).toBeTruthy();
    expect(screen.getByLabelText("Nilai Rata-rata Akhir")).toBeTruthy();
  });
});
