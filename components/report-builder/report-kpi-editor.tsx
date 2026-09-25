"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportKPIItemConfig } from "@/lib/config/report-blocks";

interface Props {
  items: ReportKPIItemConfig[];
  onChange: (items: ReportKPIItemConfig[]) => void;
}

export function ReportKPIEditor({ items, onChange }: Props) {
  const addItem = () => {
    onChange([
      ...items,
      {
        label: `Ringkasan ${items.length + 1}`,
        key: `total_item_${items.length + 1}`,
        format: "number",
      },
    ]);
  };

  const updateItem = (idx: number, patch: Partial<ReportKPIItemConfig>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Ringkasan KPI / Statistik ({items.length})</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Tambah Ringkasan
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">Belum ada ringkasan KPI. Klik "+ Tambah Ringkasan".</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 rounded-md border p-2 bg-card text-xs">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                className="h-7 text-xs flex-1"
                placeholder="Label (mis. Total Setoran)"
                value={item.label}
                onChange={(e) => updateItem(idx, { label: e.target.value })}
              />
              <Input
                className="h-7 text-xs w-28 font-mono"
                placeholder="Key Data"
                value={item.key}
                onChange={(e) => updateItem(idx, { key: e.target.value })}
                title="Kunci data mentah / total_items"
              />
              <Select
                value={item.format || "number"}
                onValueChange={(v) => updateItem(idx, { format: v as any })}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Angka</SelectItem>
                  <SelectItem value="rupiah">Rupiah (Rp)</SelectItem>
                  <SelectItem value="text">Teks</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:text-red-700 shrink-0"
                onClick={() => removeItem(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
