"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  REPORT_BLOCK_DEFINITIONS,
  REPORT_BLOCK_GROUPS,
  createReportBlockInstance,
} from "@/lib/config/report-blocks";

interface Props {
  onAdd: (blockId: string) => void;
}

export function ReportBlockPalette({ onAdd }: Props) {
  const [activeGroup, setActiveGroup] = useState<string>("semua");

  const filtered = REPORT_BLOCK_DEFINITIONS.filter(
    (b) => activeGroup === "semua" || b.group === activeGroup
  );

  return (
    <div className="space-y-2">
      {/* Group Tabs */}
      <div className="flex flex-wrap gap-1 border-b pb-1.5">
        <button
          type="button"
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            activeGroup === "semua"
              ? "bg-blue-600 text-white dark:bg-blue-500"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          onClick={() => setActiveGroup("semua")}
        >
          Semua
        </button>
        {REPORT_BLOCK_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
              activeGroup === g.id
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            onClick={() => setActiveGroup(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Block Buttons */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {filtered.map((b) => (
          <Button
            key={b.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto flex-col items-start justify-start p-2 text-left hover:border-blue-400"
            onClick={() => onAdd(b.id)}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{b.label}</span>
              <Plus className="h-3.5 w-3.5 shrink-0 text-blue-600" />
            </div>
            <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
              {b.description}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
