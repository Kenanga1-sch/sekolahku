"use client";

import { useMemo } from "react";
import { Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  createReportBlockInstance,
  getReportBlockDefinition,
  type ReportBlockInstance,
} from "@/lib/config/report-blocks";
import { ReportColumnsEditor } from "@/components/report-builder/report-columns-editor";
import { ReportKPIEditor } from "@/components/report-builder/report-kpi-editor";

interface Props {
  blocks: ReportBlockInstance[];
  onChange: (blocks: ReportBlockInstance[]) => void;
}

export function ReportBlockEditor({ blocks, onChange }: Props) {
  const updateBlock = (instanceId: string, patch: Partial<ReportBlockInstance>) => {
    onChange(blocks.map((b) => (b.instanceId === instanceId ? { ...b, ...patch } : b)));
  };

  const updateField = (instanceId: string, key: string, value: any) => {
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
    <div className="flex flex-col gap-3">
      {/* Susunan Blok */}
      <div className="space-y-1.5 border-b pb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Susunan Blok Laporan ({blocks.length})
        </p>
        {blocks.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Belum ada blok.</p>
        ) : (
          <div className="space-y-1">
            {blocks.map((b, idx) => {
              const def = getReportBlockDefinition(b.blockId);
              if (!def) return null;
              return (
                <div
                  key={b.instanceId}
                  className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs"
                >
                  <span className="flex-1 truncate font-medium">{def.label}</span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => updateBlock(b.instanceId, { enabled: !b.enabled })}
                      title={b.enabled ? "Sembunyikan" : "Tampilkan"}
                    >
                      {b.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === 0}
                      onClick={() => moveBlock(idx, -1)}
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
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-600 hover:text-red-700"
                      onClick={() => removeBlock(b.instanceId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Isi Field Blok */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Isi & Pengaturan Blok
        </p>
        <Accordion type="multiple" className="space-y-1">
          {blocks.map((b) => {
            const def = getReportBlockDefinition(b.blockId);
            if (!def || def.fields.length === 0) return null;
            return (
              <AccordionItem key={b.instanceId} value={b.instanceId} className="rounded-md border px-2">
                <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                  {b.enabled ? def.label : `${def.label} (disembunyikan)`}
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-3">
                  {def.fields.map((f) => {
                    const val = b.data[f.key];

                    if (f.type === "columns_config") {
                      return (
                        <ReportColumnsEditor
                          key={f.key}
                          columns={Array.isArray(val) ? val : []}
                          onChange={(nextCols) => updateField(b.instanceId, f.key, nextCols)}
                        />
                      );
                    }

                    if (f.type === "kpi_config") {
                      return (
                        <ReportKPIEditor
                          key={f.key}
                          items={Array.isArray(val) ? val : []}
                          onChange={(nextItems) => updateField(b.instanceId, f.key, nextItems)}
                        />
                      );
                    }

                    if (f.type === "textarea") {
                      return (
                        <div className="space-y-1" key={f.key}>
                          <Label className="text-xs">{f.label}</Label>
                          <Textarea
                            value={String(val || "")}
                            onChange={(e) => updateField(b.instanceId, f.key, e.target.value)}
                            className="min-h-[60px] text-xs"
                          />
                        </div>
                      );
                    }

                    if (f.type === "select") {
                      return (
                        <div className="space-y-1" key={f.key}>
                          <Label className="text-xs">{f.label}</Label>
                          <Select
                            value={String(val || "")}
                            onValueChange={(v) => updateField(b.instanceId, f.key, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Pilih..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(f.options || []).map((o) => (
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
                      <div className="space-y-1" key={f.key}>
                        <Label className="text-xs">{f.label}</Label>
                        <Input
                          type={f.type === "number" ? "number" : "text"}
                          value={String(val || "")}
                          onChange={(e) => updateField(b.instanceId, f.key, e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
