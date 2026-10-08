import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Calendar } from "@/components/ui/calendar";

describe("Calendar — navigasi bulan (navLayout=around)", () => {
  it("merender tombol mundur & maju yang aktif", () => {
    const { container } = render(<Calendar mode="multiple" navLayout="around" />);

    const prev = container.querySelector(".rdp-button_previous");
    const next = container.querySelector(".rdp-button_next");

    expect(prev).not.toBeNull();
    expect(next).not.toBeNull();
    // Tanpa startMonth, bulan sebelumnya selalu tersedia (tidak disabled)
    expect(prev?.getAttribute("aria-disabled")).toBeNull();
    expect(next?.getAttribute("aria-disabled")).toBeNull();
  });
});
