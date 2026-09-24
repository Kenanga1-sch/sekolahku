"use client";

import { useMemo, useState } from "react";
import { Search, Variable, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LETTER_VARIABLES } from "@/lib/config/letter-variables";

interface VariablePickerPopoverProps {
  onSelect: (variableToken: string) => void;
  triggerLabel?: string;
  triggerSize?: "sm" | "default" | "icon";
  className?: string;
}

export function VariablePickerPopover({
  onSelect,
  triggerLabel = "Variabel",
  triggerSize = "sm",
  className,
}: VariablePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");

  const categories = useMemo(
    () => ["Semua", ...Object.keys(LETTER_VARIABLES)],
    []
  );

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result: Record<string, { label: string; value: string }[]> = {};

    for (const [cat, items] of Object.entries(LETTER_VARIABLES)) {
      if (selectedCategory !== "Semua" && selectedCategory !== cat) continue;

      const matched = items.filter(
        (it) =>
          !q ||
          it.label.toLowerCase().includes(q) ||
          it.value.toLowerCase().includes(q)
      );

      if (matched.length > 0) {
        result[cat] = matched;
      }
    }

    return result;
  }, [search, selectedCategory]);

  const hasResults = Object.keys(filteredGroups).length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={triggerSize}
          className={`h-7 gap-1 px-2 text-xs ${className || ""}`}
          aria-label="Sisipkan variabel"
        >
          <Variable className="h-3.5 w-3.5 text-blue-600" />
          <span>{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 shadow-lg">
        <div className="space-y-2">
          {/* Header & Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari variabel (mis. nama, nisn)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
              autoFocus
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 border-b pb-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Variable List */}
          <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5">
            {!hasResults ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Tidak ada variabel yang sesuai.
              </p>
            ) : (
              Object.entries(filteredGroups).map(([group, items]) => (
                <div key={group} className="space-y-0.5">
                  <p className="px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </p>
                  {items.map((it) => (
                    <button
                      key={it.value}
                      type="button"
                      className="group flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      onClick={() => {
                        onSelect(it.value);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {it.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {it.value}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
