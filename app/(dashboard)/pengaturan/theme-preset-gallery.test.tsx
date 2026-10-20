import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemePresetGallery from "./theme-preset-gallery";
import { LOCAL_PRESETS, TEAL_CLASSIC } from "@/lib/theme-presets";

// Subset kecil agar tes tetap cepat; katalog penuh diuji di
// lib/theme-presets.test.ts (jumlah, id unik, kontras).
const FIXTURE = [
  LOCAL_PRESETS[0], // Teal Classic (aktif)
  LOCAL_PRESETS[1], // Green Classic (Hijau)
  LOCAL_PRESETS[2], // Blue Fresh (Biru)
  LOCAL_PRESETS.find((p) => p.id === "palette-educational-app")!,
  LOCAL_PRESETS.find((p) => p.id === "palette-magazine-blog")!,
  LOCAL_PRESETS.find((p) => p.id === "palette-kids-learning-abc-math")!,
];

describe("ThemePresetGallery", () => {
  const setup = (overrides: Partial<React.ComponentProps<typeof ThemePresetGallery>> = {}) => {
    const onApply = vi.fn();
    const onSaveCurrent = vi.fn();
    const { container } = render(
      <ThemePresetGallery
        presets={FIXTURE}
        activeTheme={TEAL_CLASSIC}
        onApply={onApply}
        onSaveCurrent={onSaveCurrent}
        {...overrides}
      />,
    );
    return { onApply, onSaveCurrent, container };
  };

  const countText = (container: HTMLElement) => {
    const node = Array.from(container.querySelectorAll("p")).find((p) =>
      /preset\. Ketuk preset/.test(p.textContent ?? ""),
    );
    return node?.textContent ?? "";
  };

  it("menampilkan jumlah preset yang difilter dan total", () => {
    const { container } = setup();
    expect(countText(container)).toContain("6 dari 6 preset.");
  });

  it("mencari preset berdasarkan nama", () => {
    const { container } = setup();
    fireEvent.change(screen.getByLabelText("Cari preset tema"), {
      target: { value: "educational" },
    });
    expect(countText(container)).toContain("1 dari 6 preset.");
  });

  it("memfilter berdasarkan keluarga warna", () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Biru" }));
    expect(countText(container)).toContain("3 dari 6 preset.");
  });

  it("menandai preset yang sedang aktif", () => {
    setup();
    expect(screen.getByRole("button", { name: /Teal Classic/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Educational App/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("memanggil onApply saat kartu diklik", () => {
    const { onApply } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Educational App/ }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: "palette-educational-app" }));
  });

  it("memanggil onSaveCurrent dari tombol simpan", () => {
    const { onSaveCurrent } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Simpan preset ini/ }));
    expect(onSaveCurrent).toHaveBeenCalled();
  });

  it("menampilkan pesan kosong bila tidak ada hasil", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Cari preset tema"), {
      target: { value: "zzz-tidak-ada" },
    });
    expect(
      screen.getByText("Tidak ada preset yang cocok. Coba kata kunci lain."),
    ).toBeInTheDocument();
  });
});
