"use client";

import { Loader2 } from "lucide-react";

import { Progress } from "@/components/ui/progress";

interface InlineProgressProps {
  title: string;
  status?: string;
  percent?: number;
  onCancel?: () => void;
}

/** Indikator progres inline (menggantikan modal overlay DocStation lama). */
export function InlineProgress({ title, status, percent, onCancel }: InlineProgressProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-extrabold text-foreground">{title}</h3>
        {status && <p className="text-xs font-semibold text-primary">{status}</p>}
      </div>
      <Progress value={percent ?? 0} className="w-full max-w-md" />
      <div className="flex w-full max-w-md items-center justify-between text-xs font-bold text-muted-foreground">
        <span>Progres</span>
        <span>{Math.round(percent ?? 0)}%</span>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-bold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Batalkan
        </button>
      )}
    </div>
  );
}
