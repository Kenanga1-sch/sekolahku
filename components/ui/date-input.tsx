"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PickerType = "date" | "datetime-local" | "month";

export type DateInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  type?: PickerType;
};

/**
 * Input tanggal native yang membuka kalender saat field diklik.
 *
 * Chromium hanya membuka picker lewat ikon kalender; klik di badan field
 * hanya memfokuskan segmen. showPicker() menyamakan perilaku tanpa
 * menghilangkan kemampuan mengetik manual.
 */
function DateInput({ className, onClick, type = "date", ...props }: DateInputProps) {
  const openPicker = (input: HTMLInputElement) => {
    if (input.disabled || input.readOnly) return;
    if (typeof input.showPicker !== "function") return;
    try {
      input.showPicker();
    } catch {
      // Safari/Firefox lama atau tanpa user activation: biarkan perilaku native.
    }
  };

  return (
    <Input
      type={type}
      className={cn(
        "cursor-pointer [color-scheme:light] dark:[color-scheme:dark]",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) openPicker(event.currentTarget);
      }}
      {...props}
    />
  );
}

export { DateInput };
