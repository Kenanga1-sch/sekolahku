"use client";

import { useMemo, useState } from "react";
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Variable,
  Copy,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { VariablePickerPopover } from "@/components/letter-builder/variable-picker-popover";
import {
  createBlockInstance,
  findMissingRequired,
  getBlockDefinition,
  type LetterBlockInstance,
  type LetterBlockField,
} from "@/lib/config/letter-blocks";
import { RichTextField } from "@/components/letter-builder/rich-text-field";
import { TableField } from "@/components/letter-builder/table-field";
import { BlockPalette } from "@/components/letter-builder/block-palette";
import { SortableList } from "@/components/letter-builder/sortable-list";

interface LetterBlockEditorProps {
  blocks: LetterBlockInstance[];
  onChange: (blocks: LetterBlockInstance[]) => void;
  /** Nama halaman aktif (opsional) untuk label. */
  pageName?: string;
  /**
   * Mode tata letak:
   *  - "sidebar" (default): palet ikut di dalam area scroll (dipakai tab mobile).
   *  - "compact": sembunyikan palet karena sudah dipindah ke ribbon atas (desktop).
   */
  variant?: "sidebar" | "compact";
}

/** Field editor dinamis berdasarkan definisi blok. */
function BlockFieldInput({
  field,
  value,
  onValue,
}: {
  field: LetterBlockField;
  value: unknown;
  onValue: (v: string) => void;
}) {
  const strVal = value === null || value === undefined ? "" : String(value);

  const variablePicker = field.allowVariables && (
    <div className="mt-1">
      <VariablePickerPopover
        onSelect={(token) => onValue(`${strVal}${strVal ? " " : ""}${token}`)}
      />
    </div>
  );

  if (field.type === "richtext") {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{field.label}</Label>
        <RichTextField
          value={strVal}
          onChange={onValue}
          placeholder={field.placeholder}
          allowVariables={field.allowVariables}
        />
      </div>
    );
  }

  if (field.type === "table") {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{field.label}</Label>
        <TableField value={strVal} onChange={onValue} defaultColumns={field.columns} />
      </div>
    );
  }

  if (field.type === "checkbox") {
    const checked = strVal === "true";
    return (
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onValue(e.target.checked ? "true" : "false")}
          className="h-4 w-4 rounded border-input"
        />
        {field.label}
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{field.label}</Label>
        <Textarea
          value={strVal}
          placeholder={field.placeholder}
          onChange={(e) => onValue(e.target.value)}
          className="min-h-[70px] text-sm"
        />
        {variablePicker}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{field.label}</Label>
        <Select value={strVal} onValueChange={onValue}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Pilih..." />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{field.label}</Label>
      <Input
        type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
        value={strVal}
        placeholder={field.placeholder}
        onChange={(e) => onValue(e.target.value)}
        className="h-8 text-sm"
      />
      {variablePicker}
    </div>
  );
}

/** Panel editor modular: tambah, urutkan, hapus, dan isi blok. */
export function LetterBlockEditor({
  blocks,
  onChange,
  pageName,
  variant = "sidebar",
}: LetterBlockEditorProps) {
  // Blok yang enabled namun ada field required yang kosong.
  const missingRequired = useMemo(() => {
    return new Set(findMissingRequired(blocks).map((m) => m.instanceId));
  }, [blocks]);

  const addBlock = (blockId: string) => {
    const inst = createBlockInstance(blockId);
    if (!inst) return;
    onChange([...blocks, inst]);
  };

  const duplicateBlock = (instanceId: string) => {
    const idx = blocks.findIndex((b) => b.instanceId === instanceId);
    if (idx < 0) return;
    const src = blocks[idx];
    const inst = createBlockInstance(src.blockId);
    if (!inst) return;
    const clone: LetterBlockInstance = {
      ...inst,
      enabled: src.enabled,
      data: { ...src.data },
    };
    const next = [...blocks];
    next.splice(idx + 1, 0, clone);
    onChange(next);
  };

  const updateBlock = (instanceId: string, patch: Partial<LetterBlockInstance>) => {
    onChange(blocks.map((b) => (b.instanceId === instanceId ? { ...b, ...patch } : b)));
  };

  const updateField = (instanceId: string, key: string, value: string) => {
    onChange(
      blocks.map((b) =>
        b.instanceId === instanceId ? { ...b, data: { ...b.data, [key]: value } } : b
      )
    );
  };

  const removeBlock = (instanceId: string) => {
    onChange(blocks.filter((b) => b.instanceId !== instanceId));
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {/* Blok terpasang */}
      <div className="shrink-0 border-b p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {pageName ? `Susunan — ${pageName}` : "Susunan Surat"} ({blocks.length})
        </p>
        {blocks.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Belum ada blok. Tambahkan dari daftar di bawah.
          </p>
        ) : (
          <SortableList
            items={blocks}
            getId={(b) => b.instanceId}
            onReorder={onChange}
            ariaItemLabel={(b) => `Pindahkan blok ${getBlockDefinition(b.blockId)?.label ?? ""}`}
            renderItem={(b, idx, handle) => {
              const def = getBlockDefinition(b.blockId);
              if (!def) return null;
              const hasError = missingRequired.has(b.instanceId);
              return (
                <div
                  className={`flex items-center gap-1 rounded-md border px-2 py-1.5 ${
                    hasError ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "bg-card"
                  }`}
                >
                  {handle}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {def.label}
                  </span>
                  {hasError && (
                    <span title="Ada field wajib yang belum diisi">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    </span>
                  )}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => updateBlock(b.instanceId, { enabled: !b.enabled })}
                      aria-label={b.enabled ? "Sembunyikan blok" : "Tampilkan blok"}
                      title={b.enabled ? "Sembunyikan" : "Tampilkan"}
                    >
                      {b.enabled ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === 0}
                      onClick={() => moveBlock(idx, -1)}
                      aria-label="Pindahkan blok ke atas"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === blocks.length - 1}
                      onClick={() => moveBlock(idx, 1)}
                      aria-label="Pindahkan blok ke bawah"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => duplicateBlock(b.instanceId)}
                      aria-label="Duplikat blok"
                      title="Duplikat blok"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {!def.required && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-600 hover:text-red-700"
                        onClick={() => removeBlock(b.instanceId)}
                        aria-label="Hapus blok"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Tambah blok — hanya di varian sidebar (mobile). Di desktop palet
          dipindah ke ribbon atas sehingga tidak memakan tinggi kolom. */}
      {variant === "sidebar" && (
        <div className="shrink-0 border-b p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tambah Blok
          </p>
          <BlockPalette blocks={blocks} onAdd={addBlock} layout="grid" />
        </div>
      )}

      {/* Isi field blok */}
      <div className="p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Isi Blok
        </p>
        {blocks.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Tambahkan blok untuk mulai mengisi.
          </p>
        ) : (
          <Accordion type="multiple" className="space-y-1">
            {blocks.map((b) => {
              const def = getBlockDefinition(b.blockId);
              if (!def || def.fields.length === 0) return null;
              return (
                <AccordionItem
                  key={b.instanceId}
                  value={b.instanceId}
                  className="rounded-md border px-2"
                >
                  <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                    {b.enabled ? def.label : `${def.label} (disembunyikan)`}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pb-3">
                    {def.fields.map((f) => (
                      <BlockFieldInput
                        key={f.key}
                        field={f}
                        value={b.data[f.key]}
                        onValue={(v) => updateField(b.instanceId, f.key, v)}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
