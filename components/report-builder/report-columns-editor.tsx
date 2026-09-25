"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportColumnConfig } from "@/lib/config/report-blocks";

interface Props {
  columns: ReportColumnConfig[];
  onChange: (cols: ReportColumnConfig[]) => void;
}

export function ReportColumnsEditor({ columns, onChange }: Props) {
  const addColumn = () => {
    const nextKey = `kolom_${columns.length + 1}`;
    onChange([
      ...columns,
      {
        key: nextKey,
        label: `Kolom ${columns.length + 1}`,
        width: 100,
        align: "left",
        format: "text",
        autoSum: false,
      },
    ]);
  };

  const updateCol = (idx: number, patch: Partial<ReportColumnConfig>) => {
    const next = [...columns];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeCol = (idx: number) => {
    onChange(columns.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Konfigurasi Kolom Tabel ({columns.length})</Label>
        <Button type="button" variant="outline" size="sm" onClick={addColumn} className="h-7 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Tambah Kolom
        </Button>
      </div>

      {columns.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">Belum ada kolom. Klik "+ Tambah Kolom".</p>
      ) : (
        <div className="space-y-2">
          {columns.map((col, idx) => (
            <div key={idx} className="flex flex-col gap-1.5 rounded-md border p-2 bg-card text-xs">
              <div className="flex items-center gap-1.5">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="Nama Header (mis. Nama Siswa)"
                  value={col.label}
                  onChange={(e) => updateCol(idx, { label: e.target.value })}
                />
                <Input
                  className="h-7 text-xs w-28 font-mono"
                  placeholder="Key (mis. nama)"
                  value={col.key}
                  onChange={(e) => updateCol(idx, { key: e.target.value })}
                  title="Kunci field JSON data"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-600 hover:text-red-700 shrink-0"
                  onClick={() => removeCol(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1 border-t">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Format Data</Label>
                  <Select
                    value={col.format || "text"}
                    onValueChange={(v) => updateCol(idx, { format: v as any })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Teks</SelectItem>
                      <SelectItem value="rupiah">Rupiah (Rp)</SelectItem>
                      <SelectItem value="number">Angka (Ribuan)</SelectItem>
                      <SelectItem value="date">Tanggal Indo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Alignment</Label>
                  <Select
                    value={col.align || "left"}
                    onValueChange={(v) => updateCol(idx, { align: v as any })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Kiri</SelectItem>
                      <SelectItem value="center">Tengah</SelectItem>
                      <SelectItem value="right">Kanan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Auto-Sum Footer</Label>
                  <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded border px-2 text-[11px] bg-background">
                    <input
                      type="checkbox"
                      checked={!!col.autoSum}
                      onChange={(e) => updateCol(idx, { autoSum: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-input"
                    />
                    <span>Total Sum</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
