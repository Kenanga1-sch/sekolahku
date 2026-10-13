// Tes jaring pengaman untuk ProfileHeader — mengunci nama, role, email,
// username, dan label unggah foto.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ProfileHeader } from "./profile-header";

function props(over: Record<string, unknown> = {}) {
  return {
    profile: {
      name: "Budi",
      fullName: "Budi Santoso",
      username: "budis",
      email: "budi@example.com",
      image: "",
    },
    userRole: "admin",
    isUploading: false,
    resolveImageUrl: (p?: string) => p,
    onAvatarUpload: vi.fn(),
    ...over,
  };
}

describe("ProfileHeader", () => {
  it("menampilkan nama lengkap", () => {
    render(<ProfileHeader {...props()} />);
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
  });

  it("menampilkan role user", () => {
    render(<ProfileHeader {...props()} />);
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("menampilkan email & username", () => {
    render(<ProfileHeader {...props()} />);
    expect(screen.getByText("budi@example.com")).toBeInTheDocument();
    expect(screen.getByText("@budis")).toBeInTheDocument();
  });

  it("menyembunyikan username bila kosong", () => {
    render(<ProfileHeader {...props({ profile: { name: "Budi", fullName: "Budi Santoso", username: "", email: "budi@example.com", image: "" } })} />);
    expect(screen.queryByText("@Budi")).not.toBeInTheDocument();
    expect(screen.getByText("budi@example.com")).toBeInTheDocument();
  });

  it("menampilkan label 'Ubah Foto' saat tidak mengunggah", () => {
    render(<ProfileHeader {...props()} />);
    expect(screen.getByText("Ubah Foto")).toBeInTheDocument();
  });

  it("menampilkan label 'Mengunggah...' saat proses", () => {
    render(<ProfileHeader {...props({ isUploading: true })} />);
    expect(screen.getByText("Mengunggah...")).toBeInTheDocument();
  });

  it("memakai fallback 'User' bila fullName & name kosong", () => {
    render(<ProfileHeader {...props({ profile: { name: "", fullName: "", username: "", email: "x@y.z", image: "" } })} />);
    expect(screen.getByText("User")).toBeInTheDocument();
  });
});
