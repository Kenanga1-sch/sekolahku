"use client";

import { cn } from "@/lib/utils";
import type { PrinterInfo } from "./types";

interface PrinterStatusBadgeProps {
  printers: PrinterInfo[];
}

/** Badge ringkas status konektivitas printer. */
export function PrinterStatusBadge({ printers }: PrinterStatusBadgeProps) {
  const onlineCount = printers.filter((p) => p.online).length;
  const anyOnline = onlineCount > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all",
        anyOnline
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          anyOnline ? "animate-pulse bg-primary" : "bg-destructive",
        )}
      />
      <span>
        {anyOnline ? `${onlineCount} Printer Online` : "Printer Offline"}
      </span>
    </div>
  );
}
