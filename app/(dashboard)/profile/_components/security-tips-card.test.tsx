// Tes jaring pengaman untuk SecurityTipsCard — mengunci judul & 4 tips statis.
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { SecurityTipsCard } from "./security-tips-card";

describe("SecurityTipsCard", () => {
  it("menampilkan judul kartu", () => {
    render(<SecurityTipsCard />);
    expect(screen.getByText("Tips Keamanan Akun")).toBeInTheDocument();
  });

  it("menampilkan 4 tips keamanan", () => {
    render(<SecurityTipsCard />);
    expect(screen.getByText(/kombinasi huruf besar/i)).toBeInTheDocument();
    expect(screen.getByText(/Ganti sandi secara berkala/i)).toBeInTheDocument();
    expect(screen.getByText(/Hindari menggunakan password yang sama/i)).toBeInTheDocument();
    expect(screen.getByText(/Jangan membagikan kredensial login/i)).toBeInTheDocument();
  });
});
