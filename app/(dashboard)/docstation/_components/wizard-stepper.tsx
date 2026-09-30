"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocStationMode } from "./types";

interface WizardStepperProps {
  mode: DocStationMode;
  step: number;
  /**
   * Menampilkan stepper dalam keadaan non-aktif (placeholder) tanpa progres.
   * Dipakai pada layar pemilihan mode sebelum mode dipilih.
   */
  disabled?: boolean;
}

export function WizardStepper({ mode, step, disabled = false }: WizardStepperProps) {
  const steps =
    mode === "scan"
      ? [
          { n: 1, label: "Mode" },
          { n: 2, label: "Konfigurasi" },
          { n: 3, label: "Edit" },
          { n: 4, label: "Simpan" },
        ]
      : [
          { n: 1, label: "Mode" },
          { n: 2, label: "Unggah" },
          { n: 3, label: "Cetak" },
        ];

  return (
    <nav
      aria-label="Langkah wizard"
      aria-disabled={disabled || undefined}
      className={cn(
        "max-w-full overflow-x-auto rounded-full border border-border bg-muted/50 p-1.5",
        disabled && "opacity-60",
      )}
    >
      <ol className="flex w-max items-center gap-1.5 text-xs font-bold text-muted-foreground">
        {steps.map((s, idx) => {
          const isActive = !disabled && s.n === step;
          const isPassed = !disabled && s.n < step;
          return (
            <li key={s.n} className="flex items-center gap-1.5">
              <div
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all",
                  isActive && "bg-background shadow-sm border border-border font-bold text-foreground",
                  !isActive && "opacity-70",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold",
                    isPassed && "bg-primary/15 text-primary",
                    isActive && "bg-primary text-primary-foreground shadow-sm",
                    !isActive && !isPassed && "bg-muted text-muted-foreground",
                  )}
                >
                  {isPassed ? <Check className="h-3 w-3" /> : s.n}
                </span>
                <span>
                  {s.label}
                  {isPassed && <span className="sr-only"> (selesai)</span>}
                  {isActive && <span className="sr-only"> (langkah saat ini)</span>}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <span aria-hidden="true" className="text-border">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
