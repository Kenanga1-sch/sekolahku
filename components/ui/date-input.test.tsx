import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { DateInput } from "@/components/ui/date-input";

const inputProto = HTMLInputElement.prototype as HTMLInputElement & {
  showPicker?: () => void;
};
const originalShowPicker = inputProto.showPicker;

afterEach(() => {
  if (originalShowPicker) {
    inputProto.showPicker = originalShowPicker;
  } else {
    delete inputProto.showPicker;
  }
});

function mockShowPicker() {
  const showPicker = vi.fn();
  Object.defineProperty(inputProto, "showPicker", {
    value: showPicker,
    configurable: true,
    writable: true,
  });
  return showPicker;
}

describe("DateInput", () => {
  it("membuka picker saat badan field diklik", () => {
    const showPicker = mockShowPicker();
    const { getByLabelText } = render(<DateInput aria-label="Tanggal lahir" />);

    const input = getByLabelText("Tanggal lahir");
    expect(input).toHaveAttribute("type", "date");

    fireEvent.click(input);
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it("tidak membuka picker saat field disabled", () => {
    const showPicker = mockShowPicker();
    const { getByLabelText } = render(
      <DateInput aria-label="Tanggal lahir" disabled />
    );

    fireEvent.click(getByLabelText("Tanggal lahir"));
    expect(showPicker).not.toHaveBeenCalled();
  });

  it("tetap aman bila browser tidak mendukung showPicker", () => {
    delete inputProto.showPicker;
    const { getByLabelText } = render(<DateInput aria-label="Tanggal lahir" />);

    expect(() => fireEvent.click(getByLabelText("Tanggal lahir"))).not.toThrow();
  });

  it("meneruskan tipe picker lain dan props/ref", () => {
    const showPicker = mockShowPicker();
    const ref = { current: null as HTMLInputElement | null };
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <DateInput
        ref={ref}
        type="datetime-local"
        aria-label="Waktu"
        value="2026-10-19T08:00"
        onChange={onChange}
      />
    );

    const input = getByLabelText("Waktu") as HTMLInputElement;
    expect(input.type).toBe("datetime-local");
    expect(input.value).toBe("2026-10-19T08:00");
    expect(ref.current).toBe(input);

    fireEvent.click(input);
    expect(showPicker).toHaveBeenCalledTimes(1);
  });
});
