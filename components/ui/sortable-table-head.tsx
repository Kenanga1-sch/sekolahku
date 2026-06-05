"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";
import type { SortConfig, SortDirection } from "@/hooks/use-sortable-data";

interface SortableTableHeadProps
  extends React.ComponentProps<"th"> {
  /** Display label for the column header */
  label: string;
  /** The object key (supports dot notation, e.g. "kelas.nama") */
  sortKey: string;
  /** Current sort configuration from useSortableData */
  sortConfig: SortConfig;
  /** Callback to trigger sorting, from useSortableData */
  onSort: (key: string) => void;
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0 transition-transform duration-200" />;
  }
  if (direction === "desc") {
    return <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0 transition-transform duration-200" />;
  }
  return (
    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 opacity-50 group-hover:opacity-100 group-hover:text-foreground transition-all duration-200" />
  );
}

export function SortableTableHead({
  label,
  sortKey,
  sortConfig,
  onSort,
  className,
  ...props
}: SortableTableHeadProps) {
  const isActive = sortConfig.key === sortKey;
  const direction: SortDirection = isActive ? sortConfig.direction : null;

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none group hover:bg-muted/80 transition-colors duration-150",
        isActive && direction && "bg-muted/60",
        className
      )}
      onClick={() => onSort(sortKey)}
      {...props}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <SortIcon direction={direction} />
      </div>
    </TableHead>
  );
}
