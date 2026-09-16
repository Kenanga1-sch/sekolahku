"use client";

import { Plus, Trash2, Circle, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface ChoiceListEditorProps {
  mode: "single" | "multi" | "true_false";
  value: Choice[];
  onChange: (next: Choice[]) => void;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function ChoiceListEditor({ mode, value, onChange }: ChoiceListEditorProps) {
  if (mode === "true_false") {
    return (
      <div className="space-y-2">
        <Label>Jawaban Benar</Label>
        <div className="flex gap-3">
          {["Benar", "Salah"].map((opt) => {
            const selected = value.find((c) => c.isCorrect)?.text === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  onChange([
                    { id: "1", text: "Benar", isCorrect: opt === "Benar" },
                    { id: "2", text: "Salah", isCorrect: opt === "Salah" },
                  ])
                }
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-medium transition-all",
                  selected
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-zinc-800 dark:text-zinc-400"
                )}
              >
                <Circle className="h-4 w-4" />
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const isMulti = mode === "multi";
  const Icon = isMulti ? CheckSquare : Circle;
  const canDelete = value.length > 2;

  const updateText = (id: string, text: string) =>
    onChange(value.map((c) => (c.id === id ? { ...c, text } : c)));

  const toggleCorrect = (id: string) => {
    if (isMulti) {
      onChange(value.map((c) => (c.id === id ? { ...c, isCorrect: !c.isCorrect } : c)));
    } else {
      onChange(value.map((c) => ({ ...c, isCorrect: c.id === id })));
    }
  };

  const addChoice = () => {
    if (value.length >= 6) return;
    const nextId = String(value.length + 1);
    onChange([...value, { id: nextId, text: "", isCorrect: false }]);
  };

  const removeChoice = (id: string) => {
    if (!canDelete) return;
    const filtered = value.filter((c) => c.id !== id);
    onChange(
      filtered.map((c, i) => ({
        ...c,
        id: String(i + 1),
        isCorrect: false,
      }))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Pilihan Jawaban</Label>
        <span className="text-[11px] text-muted-foreground">
          {isMulti ? "Centang semua yang benar" : "Pilih satu jawaban benar"}
        </span>
      </div>

      <div className="space-y-2">
        {value.map((c, idx) => (
          <div key={c.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCorrect(c.id)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 transition-all",
                c.isCorrect
                  ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "border-slate-200 text-slate-300 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-600"
              )}
              title={c.isCorrect ? "Jawaban benar" : "Tandai sebagai benar"}
            >
              <Icon className="h-4 w-4" />
            </button>
            <span className="flex h-9 w-7 shrink-0 items-center justify-center text-xs font-bold text-muted-foreground">
              {LETTERS[idx]}
            </span>
            <Input
              value={c.text}
              onChange={(e) => updateText(c.id, e.target.value)}
              placeholder={`Teks pilihan ${LETTERS[idx]}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive"
              disabled={!canDelete}
              onClick={() => removeChoice(c.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {value.length < 6 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addChoice}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-1" />
          Tambah Pilihan
        </Button>
      )}
    </div>
  );
}
