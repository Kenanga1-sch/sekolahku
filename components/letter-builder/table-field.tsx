"use client";

import { useCallback, useMemo } from "react";
import { Plus, Trash2, Columns3, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TableColumn {
  key: string;
  label: string;
  width?: number;
}

export interface TableValue {
  columns: TableColumn[];
  rows: string[][];
}

interface Props {
  /** Nilai tersimpan (JSON string {columns, rows}). */
  value: string;
  onChange: (json: string) => void;
  /** Kolom awal bila nilai kosong (dari definisi blok). */
  defaultColumns?: TableColumn[];
  className?: string;
}

function parseValue(value: string, defaultColumns?: TableColumn[]): TableValue {
  if (value && value.trimStart().startsWith("{")) {
    try {
      const obj = JSON.parse(value);
      if (Array.isArray(obj.columns)) {
        return {
          columns: obj.columns,
          rows: Array.isArray(obj.rows) ? obj.rows : [],
        };
      }
    } catch {
      /* ignore */
    }
  }
  return { columns: defaultColumns || [], rows: [] };
}

/** Editor tabel visual: kelola kolom & baris tanpa mengetik format pipa. */
export function TableField({ value, onChange, defaultColumns, className }: Props) {
  const table = useMemo(() => parseValue(value, defaultColumns), [value, defaultColumns]);

  const commit = useCallback(
    (next: TableValue) => {
      onChange(JSON.stringify(next));
    },
    [onChange]
  );

  const addRow = () => {
    const empty = table.columns.map(() => "");
    commit({ ...table, rows: [...table.rows, empty] });
  };

  const removeRow = (idx: number) => {
    commit({ ...table, rows: table.rows.filter((_, i) => i !== idx) });
  };

  const addColumn = () => {
    const key = `k${table.columns.length + 1}_${Date.now().toString(36)}`;
    commit({
      columns: [...table.columns, { key, label: `Kolom ${table.columns.length + 1}` }],
      rows: table.rows.map((r) => [...r, ""]),
    });
  };

  const removeColumn = (idx: number) => {
    commit({
      columns: table.columns.filter((_, i) => i !== idx),
      rows: table.rows.map((r) => r.filter((_, i) => i !== idx)),
    });
  };

  const setColumnLabel = (idx: number, label: string) => {
    commit({
      ...table,
      columns: table.columns.map((c, i) => (i === idx ? { ...c, label } : c)),
    });
  };

  const setCell = (rIdx: number, cIdx: number, val: string) => {
    commit({
      ...table,
      rows: table.rows.map((r, ri) =>
        ri === rIdx ? r.map((c, ci) => (ci === cIdx ? val : c)) : r
      ),
    });
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
          <Columns3 className="h-3 w-3" /> Tabel
        </span>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={addColumn}>
            <Plus className="h-3 w-3" /> Kolom
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={addRow}>
            <Plus className="h-3 w-3" /> Baris
          </Button>
        </div>
      </div>

      {table.columns.length === 0 ? (
        <p className="rounded border border-dashed py-3 text-center text-xs text-muted-foreground">
          Belum ada kolom. Tambahkan kolom.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50">
                {table.columns.map((c, ci) => (
                  <th key={c.key} className="border p-0.5 align-top">
                    <div className="flex items-center gap-0.5">
                      <Input
                        value={c.label}
                        onChange={(e) => setColumnLabel(ci, e.target.value)}
                        className="h-6 border-0 bg-transparent px-1 text-[11px] font-semibold focus-visible:ring-0"
                      />
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeColumn(ci)}
                        title="Hapus kolom"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="w-6 border" />
              </tr>
            </thead>
            <tbody>
              {table.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={table.columns.length + 1}
                    className="border p-2 text-center text-muted-foreground"
                  >
                    Belum ada baris.
                  </td>
                </tr>
              )}
              {table.rows.map((row, ri) => (
                <tr key={ri}>
                  {table.columns.map((c, ci) => (
                    <td key={c.key} className="border p-0.5">
                      <Input
                        value={row[ci] || ""}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                        className="h-6 border-0 bg-transparent px-1 text-[11px] focus-visible:ring-0"
                      />
                    </td>
                  ))}
                  <td className="border p-0.5 text-center">
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeRow(ri)}
                      title="Hapus baris"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Rows3 className="h-3 w-3" /> {table.rows.length} baris × {table.columns.length} kolom
      </p>
    </div>
  );
}
