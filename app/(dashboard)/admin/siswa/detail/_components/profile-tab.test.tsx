// Tes jaring pengaman untuk ProfileTab — mengunci kartu data pribadi, alamat,
// orang tua/wali, dan periodik yang dirender dari props student + meta.
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ProfileTab } from "./profile-tab";

const student = {
  fullName: "Budi Santoso",
  gender: "L",
  nisn: "1234567890",
  nis: "001",
  nik: "3201",
  birthPlace: "Bandung",
  birthDate: "2012-05-01",
  religion: "Islam",
  kip: "KIP-1",
  address: "Jl. Merdeka 1",
  parentPhone: "08123",
  fatherName: "Ayah Budi",
  motherName: "Ibu Budi",
  guardianName: "",
};

const meta = {
  rt: "01",
  rw: "02",
  dusun: "Mekar",
  kelurahan: "Sukamaju",
  kodePos: "40123",
  jenisTinggal: "Bersama orang tua",
  alatTransportasi: "Sepeda",
  teleponRumah: "021-123",
  email: "budi@example.com",
  fatherNik: "F-NIK",
  fatherBirthYear: "1980",
  fatherEducation: "SMA",
  fatherJob: "Petani",
  fatherIncome: "2-3 juta",
  motherNik: "M-NIK",
  motherBirthYear: "1982",
  motherEducation: "SMP",
  motherJob: "Ibu Rumah Tangga",
  motherIncome: "-",
  tinggiBadan: "150",
  beratBadan: "40",
  lingkarKepala: "52",
  jarakSekolah: "1 km",
  waktuTempuh: "15 menit",
  jumlahSaudara: 2,
};

describe("ProfileTab", () => {
  it("menampilkan kartu Data Pribadi", () => {
    render(<ProfileTab student={student} meta={meta} />);
    expect(screen.getByText("Data Pribadi")).toBeInTheDocument();
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Laki-laki")).toBeInTheDocument();
  });

  it("menampilkan kartu Alamat & Kontak dengan RT/RW", () => {
    render(<ProfileTab student={student} meta={meta} />);
    expect(screen.getByText("Alamat & Kontak")).toBeInTheDocument();
    expect(screen.getByText(/RT 01 \/ RW 02/)).toBeInTheDocument();
    expect(screen.getByText("Jl. Merdeka 1")).toBeInTheDocument();
  });

  it("menampilkan detail ayah & ibu", () => {
    render(<ProfileTab student={student} meta={meta} />);
    expect(screen.getByText("Detail Ayah Kandung")).toBeInTheDocument();
    expect(screen.getByText("Detail Ibu Kandung")).toBeInTheDocument();
    expect(screen.getByText("Ayah Budi")).toBeInTheDocument();
    expect(screen.getByText("Ibu Budi")).toBeInTheDocument();
  });

  it("tidak menampilkan section wali bila guardianName kosong", () => {
    render(<ProfileTab student={student} meta={meta} />);
    expect(screen.queryByText("Detail Wali")).not.toBeInTheDocument();
  });

  it("menampilkan section wali bila guardianName ada", () => {
    render(
      <ProfileTab student={{ ...student, guardianName: "Pak Wali" }} meta={meta} />,
    );
    expect(screen.getByText("Detail Wali")).toBeInTheDocument();
    expect(screen.getByText("Pak Wali")).toBeInTheDocument();
  });

  it("menampilkan data periodik dengan satuan", () => {
    render(<ProfileTab student={student} meta={meta} />);
    expect(screen.getByText("Data Periodik & Longitudinal")).toBeInTheDocument();
    expect(screen.getByText("150 cm")).toBeInTheDocument();
    expect(screen.getByText("40 kg")).toBeInTheDocument();
    expect(screen.getByText("2 orang")).toBeInTheDocument();
  });

  it("memakai '-' untuk field meta yang kosong", () => {
    render(<ProfileTab student={student} meta={{}} />);
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });
});
