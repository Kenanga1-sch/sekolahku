// Tes jaring pengaman untuk UserProfileDialog — mengunci konten detail akun,
// keadaan kosong, dan tombol aksi. Plus test helper formatCreatedDate.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserProfileDialog } from "./user-profile-dialog";
import { formatCreatedDate } from "./user-helpers";
import type { User } from "@/types";

function makeUser(over: Partial<User> = {}): User {
  return {
    id: "u1",
    created: "2024-03-15T00:00:00Z",
    updated: "2024-03-15T00:00:00Z",
    name: "Budi Santoso",
    email: "budi@sekolah.id",
    username: "budi",
    phone: "08123456789",
    role: "guru",
    isActive: true,
    mustChangePassword: false,
    ...over,
  };
}

function renderDialog(over: Partial<React.ComponentProps<typeof UserProfileDialog>> = {}) {
  const props = {
    user: makeUser(),
    open: true,
    onOpenChange: vi.fn(),
    onEdit: vi.fn(),
    ...over,
  };
  const utils = render(<UserProfileDialog {...props} />);
  return { ...utils, props };
}

describe("formatCreatedDate — ISO → tanggal lokal id-ID", () => {
  it("kosong → '-'", () => {
    expect(formatCreatedDate(undefined)).toBe("-");
    expect(formatCreatedDate("")).toBe("-");
  });

  it("string tak valid → '-'", () => {
    expect(formatCreatedDate("bukan-tanggal")).toBe("-");
  });

  it("tanggal valid → tidak '-' dan memuat tahun", () => {
    const out = formatCreatedDate("2024-03-15T00:00:00Z");
    expect(out).not.toBe("-");
    expect(out).toMatch(/2024/);
  });
});

describe("UserProfileDialog — konten", () => {
  it("tertutup (open=false) → judul tidak tampil", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Detail Akun Pengguna")).toBeNull();
  });

  it("terbuka: menampilkan judul, nama, email, role, username, telepon", () => {
    renderDialog();
    expect(screen.getByText("Detail Akun Pengguna")).toBeInTheDocument();
    expect(screen.getAllByText("Budi Santoso").length).toBeGreaterThan(0);
    expect(screen.getByText("budi@sekolah.id")).toBeInTheDocument();
    expect(screen.getByText("guru")).toBeInTheDocument();
    expect(screen.getByText("budi")).toBeInTheDocument();
    expect(screen.getByText("08123456789")).toBeInTheDocument();
  });

  it("status aktif → 'Aktif'; nonaktif → 'Nonaktif'", () => {
    renderDialog({ user: makeUser({ isActive: true }) });
    expect(screen.getByText("Aktif")).toBeInTheDocument();
  });

  it("user null → isi detail tidak dirender (tetap ada tombol Tutup)", () => {
    renderDialog({ user: null });
    expect(screen.queryByText("budi@sekolah.id")).toBeNull();
    expect(screen.getByText("Tutup")).toBeInTheDocument();
  });

  it("mustChangePassword → baris 'Wajib ganti password' tampil", () => {
    renderDialog({ user: makeUser({ mustChangePassword: true }) });
    expect(screen.getByText("Wajib ganti password")).toBeInTheDocument();
  });

  it("tidak mustChangePassword → baris 'Wajib ganti password' tidak tampil", () => {
    renderDialog({ user: makeUser({ mustChangePassword: false }) });
    expect(screen.queryByText("Wajib ganti password")).toBeNull();
  });

  it("inisial avatar 2 huruf pertama nama (uppercase)", () => {
    renderDialog({ user: makeUser({ name: "Budi Santoso" }) });
    expect(screen.getByText("BU")).toBeInTheDocument();
  });
});

describe("UserProfileDialog — aksi", () => {
  it("Tutup memanggil onOpenChange(false)", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Tutup"));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Edit Profil memanggil onEdit(user) lalu menutup", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Edit Profil"));
    expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
});
